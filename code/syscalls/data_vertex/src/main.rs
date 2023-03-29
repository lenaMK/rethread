use anyhow::Result;
use config::Config;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use futures_util::{SinkExt, StreamExt};
use log::*;
use menu::MenuItem;
use nix::errno::Errno;
use send_osc::OscSender;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fmt::Debug,
    fs::File,
    io::{Read, Write},
    time::{Duration, Instant},
};
use std::{net::SocketAddr, path::PathBuf};
use syscalls_shared::{Packet, Syscall, SyscallKind};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::mpsc::UnboundedSender,
};
use tui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Layout},
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, Cell, Gauge, Row, Table, TableState},
    Frame, Terminal,
};

mod config;
mod menu;
mod send_osc;

static SHOW_TUI: bool = true;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RecordedPackets {
    records: Vec<Record>,
}

impl RecordedPackets {
    fn new() -> Self {
        Self { records: vec![] }
    }
    fn record_packet(&mut self, packet: Packet, timestamp: Duration) {
        self.records.push(Record { packet, timestamp })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Record {
    packet: Packet,
    timestamp: Duration,
}

#[derive(Clone, Debug)]
struct RecordingPlayback {
    recorded_packets: RecordedPackets,
    /// Playback is driven by the timestamps as Duration
    current_duration: Duration,
    /// Store current packet so we don't add a packet twice
    current_packet: usize,
    playing: bool,
    last_packet_timestamp: Duration,
}

impl RecordingPlayback {
    fn new(mut recorded_packets: RecordedPackets) -> Self {
        // Sort packets because they have to be in time order
        recorded_packets
            .records
            .sort_by_key(|record| record.timestamp);
        let last_packet_timestamp = if recorded_packets.records.len() > 0 {
            recorded_packets.records.iter().last().unwrap().timestamp
        } else {
            Duration::ZERO
        };
        Self {
            recorded_packets,
            current_duration: Duration::ZERO,
            current_packet: 0,
            playing: false,
            last_packet_timestamp,
        }
    }
    fn from_file(path: &PathBuf) -> Result<Self> {
        let mut file = File::open(path)?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;
        let recorded_packets = postcard::from_bytes(&bytes)?;
        Ok(Self::new(recorded_packets))
    }
    fn progress_time(&mut self, dt: Duration) {
        if self.playing {
            self.current_duration += dt;
        }
    }
    fn next_packet(&mut self) -> Option<&Packet> {
        if !self.playing {
            return None;
        }
        if self.current_packet >= self.recorded_packets.records.len() {
            self.playing = false;
            return None;
        }
        if self.recorded_packets.records[self.current_packet].timestamp <= self.current_duration {
            let packet = &self.recorded_packets.records[self.current_packet].packet;
            self.current_packet += 1;
            return Some(packet);
        } else {
            None
        }
    }
}
struct PacketHQ {
    syscall_analyser: SyscallAnalyser,
    recording: Option<RecordedPackets>,
    recording_playback: Option<RecordingPlayback>,
    start_recording_time: Instant,
    gui_update_sender: rtrb::Producer<GuiUpdate>,
    command_receiver: rtrb::Consumer<PacketHQCommands>,
    last_update: Instant,
    osc_sender: OscSender,
}
impl PacketHQ {
    fn new(
        settings: &Config,
        gui_update_sender: rtrb::Producer<GuiUpdate>,
        command_receiver: rtrb::Consumer<PacketHQCommands>,
    ) -> Self {
        Self {
            syscall_analyser: SyscallAnalyser::new(),
            recording: None,
            start_recording_time: Instant::now(),
            gui_update_sender,
            command_receiver,
            recording_playback: None,
            last_update: Instant::now(),
            osc_sender: OscSender::new(settings),
        }
    }
    fn start_recording(&mut self) {
        self.start_recording_time = Instant::now();
        self.recording = Some(RecordedPackets::new());
    }
    fn stop_and_save_recording(&mut self, path: PathBuf) {
        let Some(recording) = self.recording.take() else { return };
        let data = postcard::to_stdvec(&recording).unwrap();
        let Ok(mut file) = File::create(path) else { error!("Couldn't open file to save data!"); return; };
        file.write_all(data.as_slice()).unwrap();
    }
    fn load_recording(&mut self, path: PathBuf) {
        let Ok(recording_playback) = RecordingPlayback::from_file(&path) else { error!("Failed to load data from path: {path:?}"); return; };
        self.recording_playback = Some(recording_playback);
    }
    fn register_packet(&mut self, packet: Packet) {
        match &packet {
            Packet::Syscall(syscall) => {
                self.syscall_analyser.register_packet(syscall);

                self.osc_sender.send_syscall(syscall);
            }
        }
        if let Some(recording) = &mut self.recording {
            recording.record_packet(packet, self.start_recording_time.elapsed());
        }
        // TODO: Send via OSC
    }
    fn update(&mut self) {
        let dt = self.last_update.elapsed();
        self.last_update = Instant::now();
        self.syscall_analyser.update();
        if let Some(rp) = &mut self.recording_playback {
            rp.progress_time(dt);
            while let Some(packet) = rp.next_packet() {
                match packet {
                    Packet::Syscall(syscall) => self.syscall_analyser.register_packet(syscall),
                }
                // TODO Send via OSC
            }
        }
        let playback_data = if let Some(rp) = &self.recording_playback {
            PlaybackData {
                current_index: rp.current_packet,
                max_index: rp.recorded_packets.records.len(),
                current_timestamp: rp.current_duration,
                max_timestamp: rp.last_packet_timestamp,
                playing: rp.playing,
            }
        } else {
            PlaybackData::default()
        };
        self.gui_update_sender
            .push(GuiUpdate {
                syscall_analyser: self.syscall_analyser.clone(),
                playback_data,
            })
            .ok();
        while let Ok(command) = self.command_receiver.pop() {
            match command {
                PacketHQCommands::StartRecording => self.start_recording(),
                PacketHQCommands::SaveRecording { path } => self.stop_and_save_recording(path),
                PacketHQCommands::LoadRecording { path } => self.load_recording(path),
                PacketHQCommands::PauseRecordingPlayback => {
                    if let Some(recording) = &mut self.recording_playback {
                        recording.playing = false;
                    }
                }
                PacketHQCommands::StartRecordingPlayback => {
                    if let Some(rp) = &mut self.recording_playback {
                        rp.playing = true;
                    }
                }
            }
        }
    }
}

#[derive(Clone, Debug)]
struct GuiUpdate {
    syscall_analyser: SyscallAnalyser,
    playback_data: PlaybackData,
}
#[derive(Clone, Debug)]
struct PlaybackData {
    current_index: usize,
    max_index: usize,
    current_timestamp: Duration,
    max_timestamp: Duration,
    playing: bool,
}
impl Default for PlaybackData {
    fn default() -> Self {
        Self {
            current_index: 0,
            max_index: 0,
            current_timestamp: Duration::ZERO,
            max_timestamp: Duration::ZERO,
            playing: false,
        }
    }
}
enum PacketHQCommands {
    StartRecording,
    SaveRecording { path: PathBuf },
    LoadRecording { path: PathBuf },
    PauseRecordingPlayback,
    StartRecordingPlayback,
}

#[derive(Clone, Debug)]
struct SyscallAnalyser {
    pub num_packets_total: usize,
    pub num_errors_total: usize,
    pub packets_per_kind: HashMap<SyscallKind, u64>,
    pub packets_last_second: Vec<(Syscall, Instant)>,
    pub errors_last_second: Vec<(Errno, Instant)>,
    pub num_packets_last_second: usize,
    pub num_errors_last_second: usize,
    last_second: Instant,
}
impl SyscallAnalyser {
    pub fn new() -> Self {
        Self {
            packets_per_kind: HashMap::new(),
            packets_last_second: Vec::new(),
            errors_last_second: Vec::new(),
            num_packets_last_second: 0,
            num_errors_last_second: 0,
            last_second: Instant::now(),
            num_packets_total: 0,
            num_errors_total: 0,
        }
    }
    pub fn register_packet(&mut self, syscall: &Syscall) {
        *self.packets_per_kind.entry(syscall.kind).or_insert(0) += 1;
        self.num_packets_last_second += 1;
        let errno = Errno::from_i32(syscall.return_value);
        if !matches!(errno, Errno::UnknownErrno) {
            self.errors_last_second.push((errno, Instant::now()));
            self.num_errors_last_second += 1;
        }
    }
    pub fn update(&mut self) {
        if self.last_second.elapsed() >= Duration::from_secs(1) {
            self.num_packets_last_second = 0;
            self.num_errors_last_second = 0;
            self.last_second = Instant::now();
        }
        // let mut i = 0;
        // while i < self.packets_last_second.len() {
        //     if self.packets_last_second[i].1.elapsed().as_secs() > 0 {
        //         self.packets_last_second.remove(i);
        //     } else {
        //         i += 1;
        //     }
        // }
        // let mut i = 0;
        // while i < self.errors_last_second.len() {
        //     if self.errors_last_second[i].1.elapsed().as_secs() > 0 {
        //         self.errors_last_second.remove(i);
        //     } else {
        //         i += 1;
        //     }
        // }
    }
    pub fn packets_per_kind_rows<'a, 'b>(&'a self) -> Vec<Row<'b>> {
        let rows = self
            .packets_per_kind
            .iter()
            .map(|(key, number)| {
                let cells = vec![
                    Cell::from(format!("{key:?}")).style(Style::default().fg(Color::Cyan)),
                    Cell::from(format!("{number}")),
                ];
                Row::new(cells).height(1).bottom_margin(0)
            })
            .collect();
        rows
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env = env_logger::Env::default()
        .filter_or("MY_LOG_LEVEL", "info")
        .write_style_or("MY_LOG_STYLE", "always");

    env_logger::init_from_env(env);
    let settings = if let Ok(settings) = Config::load_from_file() {
        settings
    } else {
        error!("Failed to load configuration");
        Config::empty()
    };

    let (gui_update_sender, gui_update_receiver) = rtrb::RingBuffer::new(100);
    let (packet_hq_sender, packet_hq_receiver) = rtrb::RingBuffer::new(100);
    let packet_hq = PacketHQ::new(&settings, gui_update_sender, packet_hq_receiver);

    if SHOW_TUI {
        {
            tokio::spawn(start_network_communication(packet_hq));
        }
        // setup terminal
        enable_raw_mode()?;
        let mut stdout = std::io::stdout();
        execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
        let backend = CrosstermBackend::new(stdout);
        let mut terminal = Terminal::new(backend)?;
        // create app and run it
        let app = App {
            gui_update_receiver,
            packet_hq_sender,
            syscall_analyser: None,
            table_state: TableState::default(),
            menu_table_state: TableState::default(),
            is_recording: false,
            playback_data: None,
        };
        let res = run_app(&mut terminal, app);

        // restore terminal
        disable_raw_mode()?;
        execute!(
            terminal.backend_mut(),
            LeaveAlternateScreen,
            DisableMouseCapture
        )?;
        terminal.show_cursor()?;

        if let Err(err) = res {
            println!("{:?}", err)
        }
    } else {
        start_network_communication(packet_hq).await?;
    }

    Ok(())
}

pub struct App {
    syscall_analyser: Option<SyscallAnalyser>,
    playback_data: Option<PlaybackData>,
    gui_update_receiver: rtrb::Consumer<GuiUpdate>,
    packet_hq_sender: rtrb::Producer<PacketHQCommands>,
    table_state: TableState,
    menu_table_state: TableState,
    is_recording: bool,
}

fn run_app<B: Backend>(terminal: &mut Terminal<B>, mut app: App) -> anyhow::Result<()> {
    let mut last_tick = Instant::now();
    let tick_rate = Duration::from_millis(16);
    loop {
        terminal.draw(|f| ui(f, &mut app))?;
        while let Ok(gui_update) = app.gui_update_receiver.pop() {
            app.syscall_analyser = Some(gui_update.syscall_analyser);
            app.playback_data = Some(gui_update.playback_data);
        }

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));
        if crossterm::event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Down => {
                        if let Some(selected) = app.menu_table_state.selected() {
                            app.menu_table_state.select(Some(
                                (selected + 1) % enum_iterator::cardinality::<MenuItem>(),
                            ));
                        } else {
                            app.menu_table_state.select(Some(0));
                        }
                    }
                    KeyCode::Up => {
                        if let Some(selected) = app.menu_table_state.selected() {
                            app.menu_table_state.select(Some(
                                (selected - 1) % enum_iterator::cardinality::<MenuItem>(),
                            ));
                        } else {
                            app.menu_table_state
                                .select(Some(enum_iterator::cardinality::<MenuItem>() - 1));
                        }
                    }
                    KeyCode::Enter => {
                        let selected = app.menu_table_state.selected().unwrap_or(0);
                        match MenuItem::try_from(selected as u8).unwrap() {
                            MenuItem::LoadRecordedData => {
                                if let Some(path) = rfd::FileDialog::new().pick_file() {
                                    app.is_recording = false;
                                    app.packet_hq_sender
                                        .push(PacketHQCommands::LoadRecording { path })?;
                                }
                            }
                            MenuItem::RecordData => {
                                app.is_recording = true;
                                app.packet_hq_sender
                                    .push(PacketHQCommands::StartRecording)?;
                            }
                            MenuItem::StopAndSaveRecording => {
                                if let Some(path) = rfd::FileDialog::new().save_file() {
                                    app.is_recording = false;
                                    app.packet_hq_sender
                                        .push(PacketHQCommands::SaveRecording { path })?;
                                }
                            }
                            MenuItem::StartPlayback => {
                                app.packet_hq_sender
                                    .push(PacketHQCommands::StartRecordingPlayback)?;
                            }
                            MenuItem::PausePlayback => {
                                app.packet_hq_sender
                                    .push(PacketHQCommands::PauseRecordingPlayback)?;
                            }
                        }
                    }
                    KeyCode::Char('q') => return Ok(()),
                    _ => {}
                }
            }
        }
        if last_tick.elapsed() >= tick_rate {
            // app.on_tick();
            last_tick = Instant::now();
        }
    }
}

fn ui<B: Backend>(f: &mut Frame<B>, app: &mut App) {
    let rects = Layout::default()
        .direction(tui::layout::Direction::Vertical)
        .constraints([Constraint::Percentage(90), Constraint::Min(5)].as_ref())
        .split(f.size());
    let progress_bar = rects[1];
    let rects = Layout::default()
        .direction(tui::layout::Direction::Horizontal)
        .constraints([Constraint::Percentage(25), Constraint::Percentage(75)].as_ref())
        .margin(5)
        .split(rects[0]);
    let data_rects = Layout::default()
        .direction(tui::layout::Direction::Vertical)
        .constraints([Constraint::Percentage(25), Constraint::Percentage(75)])
        .margin(5)
        .split(rects[1]);
    let menu_rect = rects[0];

    if let Some(pd) = &app.playback_data {
        render_progress_bar(f, progress_bar, pd);
    }

    if let Some(sa) = &app.syscall_analyser {
        let (packets_per_kind_rows, syscalls_last_second, errors_last_second) = {
            let packets_per_kind_rows = sa.packets_per_kind_rows();
            (
                packets_per_kind_rows,
                sa.num_packets_last_second,
                sa.num_errors_last_second,
            )
        };
        render_packets_per_kind(f, packets_per_kind_rows, data_rects[1], app);
        render_general(
            f,
            syscalls_last_second,
            errors_last_second,
            data_rects[0],
            app,
        );
    }
    menu::menu_ui(f, app, menu_rect);
}
fn render_progress_bar<B: Backend>(
    f: &mut Frame<B>,
    rect: tui::layout::Rect,
    playback_data: &PlaybackData,
) {
    let g = Gauge::default()
        .block(Block::default().borders(Borders::ALL).title(format!(
            "Playback progress: {} / {} | {} / {}",
            playback_data.current_index,
            playback_data.max_index,
            humantime::format_duration(playback_data.current_timestamp),
            humantime::format_duration(playback_data.max_timestamp),
        )))
        .gauge_style(
            Style::default()
                .fg(if playback_data.playing {
                    Color::Green
                } else {
                    Color::White
                })
                .bg(Color::Black)
                .add_modifier(Modifier::ITALIC),
        )
        .percent(
            ((playback_data.current_timestamp.as_secs_f64()
                / playback_data.max_timestamp.as_secs_f64())
                * 100.) as u16,
        );

    f.render_widget(g, rect);
}
fn render_packets_per_kind<B: Backend>(
    f: &mut Frame<B>,
    packets_per_kind_rows: Vec<Row>,
    rect: tui::layout::Rect,
    app: &mut App,
) {
    let selected_style = Style::default().add_modifier(Modifier::REVERSED);
    let normal_style = Style::default().bg(Color::Blue);
    let header_cells = ["Kind", "Num events"]
        .iter()
        .map(|h| Cell::from(*h).style(Style::default().fg(Color::Black)));
    let header = Row::new(header_cells)
        .style(normal_style)
        .height(1)
        .bottom_margin(1);
    let t = Table::new(packets_per_kind_rows)
        .header(header)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Syscall events per kind total"),
        )
        .highlight_style(selected_style)
        .highlight_symbol(">> ")
        .widths(&[
            Constraint::Percentage(50),
            Constraint::Length(30),
            Constraint::Min(10),
        ]);
    f.render_stateful_widget(t, rect, &mut app.table_state);
}
fn render_general<B: Backend>(
    f: &mut Frame<B>,
    syscalls_last_second: usize,
    errors_last_second: usize,
    rect: tui::layout::Rect,
    app: &mut App,
) {
    let selected_style = Style::default().add_modifier(Modifier::REVERSED);
    let normal_style = Style::default().bg(Color::Blue);
    let header_cells = ["Kind", "Num"]
        .iter()
        .map(|h| Cell::from(*h).style(Style::default().fg(Color::Black)));
    let header = Row::new(header_cells)
        .style(normal_style)
        .height(1)
        .bottom_margin(1);
    let kind_style = Style::default().fg(Color::LightCyan);
    let rows = vec![
        Row::new(vec![
            Cell::from("syscalls last second").style(kind_style),
            Cell::from(format!("{syscalls_last_second}")),
        ]),
        Row::new(vec![
            Cell::from("errors last second").style(kind_style),
            Cell::from(format!("{errors_last_second}")),
        ]),
    ];
    let t = Table::new(rows)
        .header(header)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Running average data"),
        )
        .highlight_style(selected_style)
        .highlight_symbol(">> ")
        .widths(&[
            Constraint::Percentage(50),
            Constraint::Length(30),
            Constraint::Min(10),
        ]);
    f.render_stateful_widget(t, rect, &mut app.table_state);
}
async fn start_network_communication(mut packet_hq: PacketHQ) -> Result<()> {
    let addr = "127.0.0.1:3012";
    let listener = TcpListener::bind(&addr).await.expect("Can't listen");
    let (packet_sender, mut packet_receiver) = tokio::sync::mpsc::unbounded_channel();

    {
        tokio::spawn(async move {
            loop {
                while let Ok(packet) = packet_receiver.try_recv() {
                    packet_hq.register_packet(packet);
                }
                packet_hq.update();
            }
        });
    }
    loop {
        let (socket, _) = listener.accept().await?;
        let packet_sender = packet_sender.clone();
        let peer = socket
            .peer_addr()
            .expect("connected streams should have a peer address");
        info!("Peer address: {}", peer);
        tokio::spawn(async move {
            handle_client(peer, socket, packet_sender).await.unwrap();
        });
    }

    Ok(())
}
async fn handle_client(
    peer: SocketAddr,
    stream: TcpStream,
    packet_sender: UnboundedSender<Packet>,
) -> anyhow::Result<()> {
    let mut ws_stream = tokio_tungstenite::accept_async(stream)
        .await
        .expect("Failed to accept");

    info!("New WebSocket connection: {}", peer);
    while let Some(msg) = ws_stream.next().await {
        match msg? {
            tokio_tungstenite::tungstenite::Message::Text(text) => info!("ws message: {text}"),
            tokio_tungstenite::tungstenite::Message::Binary(data) => {
                match postcard::from_bytes(&data) {
                    Ok(packet) => packet_sender.send(packet)?,
                    Err(e) => error!("Failed to parse binary packet as postcard: {e}"),
                }
            }
            tokio_tungstenite::tungstenite::Message::Ping(_) => todo!(),
            tokio_tungstenite::tungstenite::Message::Pong(_) => todo!(),
            tokio_tungstenite::tungstenite::Message::Close(_) => todo!(),
            tokio_tungstenite::tungstenite::Message::Frame(_) => todo!(),
        }
    }

    Ok(())

    // old

    // let settings = protocol::Settings {
    //     byte_order: protocol::ByteOrder::LittleEndian,
    //     ..Default::default()
    // };
    // let mut connection: Connection<Packet, TcpStream> = protocol::wire::stream::Connection::new(
    //     stream,
    //     protocol::wire::middleware::pipeline::default(),
    //     settings,
    // );

    // loop {
    //     if let Some(response) = connection.receive_packet().unwrap() {
    //         match response {
    //             Packet::Syscall(syscall) => {
    //                 let mut analyser = syscall_analyser.lock().unwrap();
    //                 analyser.register_packet(syscall);
    //             }
    //             _ => (),
    //         }
    //     }
    // }
    // Ok(())
}
