use std::f64::consts::PI;
// use std::f32::consts::PI;
use nannou::rand::random;
use dasp::signal::{NoiseSimplex, Signal};

// Performance: Reusing one wavetable seems to double the performance looking at jack's DSP meter

// Wavetable player as Signal (use Phase)
// Wavetable generator to create wavetable buffers (sine, saw, custom wavetables, look at SC for inspiration)
// synth using the wavetable and some filters. Connect to some reverb.

pub type Sample = f64;

pub trait LocalSig {
    fn next(&mut self, resources: &WavetableArena) -> Sample;
}

pub struct Wavetable {
    buffer: Vec<Sample>, // Box<[Sample; 131072]>,
    // Store the size as an f64 to find fractional indexes without typecasting
    size: Sample,
}

impl Wavetable {
    fn new(wavetable_size: usize) -> Self {
        let w_size = if !is_power_of_2(wavetable_size) {
            // Make a power of two by taking the log2 and discarding the fractional part of the answer and then squaring again
            ((wavetable_size as f64).log2() as usize).pow(2)
        } else {
            wavetable_size
        };
        let buffer = vec![0.0; w_size];
        Wavetable {
            buffer,
            size: w_size as Sample,
        }
    }
    pub fn sine(wavetable_size: usize) -> Self {
        let mut wt = Wavetable::new(wavetable_size);
        // Fill buffer with a sine
        for i in 0..wavetable_size {
            wt.buffer[i] = ((i as Sample / wt.size) * PI * 2.0).sin();
        }
        wt
    }
    pub fn multi_sine(wavetable_size: usize, num_harmonics: usize) -> Self {
        let mut wt = Wavetable::new(wavetable_size);
        for n in 0..num_harmonics {
            let start_phase = random::<f64>() * 2.0 * PI * n as f64;
            let harmonic_amp = match n {
                0 => 1.0,
                _ => random::<f64>() * 0.05 + 0.001
            };
            for i in 0..wavetable_size {
                wt.buffer[i] += ((i as Sample / wt.size) * PI * 2.0 * (n+1) as f64 + start_phase).sin() * harmonic_amp;
            }
        }
        wt.add_noise(0.95);
        wt.normalize();
        wt
    }
    pub fn add_noise(&mut self, probability: f64) {
        for sample in &mut self.buffer {
            if random::<f64>() > probability {
                *sample += random::<f64>() - 0.5;
                if *sample > 1.0 {
                    *sample -= 1.0;
                }
                if *sample < -1.0 {
                    *sample += 1.0;
                }
            }
        }
    }
    pub fn normalize(&mut self) {
        // Find highest absolute value
        let mut loudest_sample = 0.0;
        for sample in &self.buffer {
            if sample.abs() > loudest_sample {
                loudest_sample = sample.abs();
            }
        }
        // Scale buffer
        let scaler = 1.0 / loudest_sample;
        for sample in &mut self.buffer {
            *sample *= scaler;
        }
    }

    /// Linearly interpolate between the value in between which the phase points.
    /// The phase is assumed to be 0 <= phase < 1
    #[inline]
    fn get_linear_interp(&self, phase: Sample) -> Sample {
        let index = self.size * phase;
        let mix = index.fract();
        self.buffer[index.floor() as usize] * (1.0-mix) + self.buffer[index.ceil() as usize % self.buffer.len()] * mix
    }

    /// Get the closest sample with no interpolation
    #[inline]
    fn get(&self, phase: Sample) -> Sample {
        let index = (self.size * phase) as usize;
        // self.buffer[index]
        unsafe{ *self.buffer.get_unchecked(index) }
    }
}

fn is_power_of_2(num: usize) -> bool {
    return num > 0 && num&(num-1) == 0;
}

pub struct SinglePitch {
    amp: Sample,
    target_amp: Sample,
    sensitivity: Sample,
    sensitivity_recovery: Sample,
    lpf_coeff: Sample,
    decay_coeff: Sample,
    oscillator: Oscillator,
    pan: Pan2,
    pan_signal: LFNoise1,
    lpf: LowPassFilter,
}

impl SinglePitch {
    pub fn new(freq: Sample, wavetable: WavetableIndex, sample_rate: Sample, decay_time: Sample, pan: Sample) -> Self {
        let duration_in_samples = decay_time * sample_rate;
        println!("Sensitivity rec: {}", (1.0 / (decay_time * 2.0)) / sample_rate);
        SinglePitch {
            amp: 0.0,
            target_amp: 0.0,
            sensitivity: 1.0,
            sensitivity_recovery: (1.0 / (decay_time * 0.9)) / sample_rate,
            lpf_coeff: 0.9,
            decay_coeff: (0.001_f64).powf(1.0/duration_in_samples),
            oscillator: Oscillator::from_freq(wavetable, sample_rate, freq, 1.0),
            pan: Pan2::new(pan),
            pan_signal: LFNoise1::new(3.0, -1.0, 1.0, sample_rate),
            lpf: LowPassFilter::new(0.0)
        }
    }

    pub fn add_energy(&mut self, energy: Sample) {
        self.target_amp += self.sensitivity * 0.005 * energy;
        self.target_amp = self.target_amp.max(0.0).min(0.1);
        self.sensitivity = (self.sensitivity - energy*0.002).max(0.0);
    }

    #[inline]
    fn next(&mut self, wavetable_arena: &WavetableArena) -> [Sample; 2] {
        self.pan.set_pan(self.pan_signal.next(wavetable_arena));
        self.lpf.alpha = (0.9 - (self.amp * 9.0).powi(3)).min(1.0); 
        // self.lpf.alpha = 1.0 - self.sensitivity;
        self.amp = self.amp * self.lpf_coeff + self.target_amp * (1.0 - self.lpf_coeff);
        self.target_amp *= self.decay_coeff;
        self.sensitivity = (self.sensitivity + self.sensitivity_recovery).min(1.0);
        self.pan.next(self.lpf.next(self.oscillator.next(wavetable_arena)) * self.amp)
    }
}

pub struct ExponentialDecay {
    value: Sample,
    target_value: Sample,
    sample_rate: f64,
    decay_scaler: f64,
    attack_lin_scaler: Sample,
    attack_time: Sample,
    duration: Sample,
}

impl ExponentialDecay {
    pub fn new(duration: f64, sample_rate: f64) -> Self {
        let mut s = ExponentialDecay {
            value: 0.0,
            target_value: 0.0,
            sample_rate,
            decay_scaler: 1.0,
            attack_lin_scaler: 0.0,
            attack_time: 0.002,
            duration: 0.0,
        };
        s.set_duration(duration);
        s
    }
    pub fn set_duration(&mut self, duration: f64) {
        // From the SC XLine implementation: growth = pow(end / start, 1.0 / counter);
        let duration_in_samples = duration * self.sample_rate;
        // 0.001 = -60dB
        self.decay_scaler = (0.001_f64).powf(1.0/duration_in_samples);
    }
    // TODO: The linear attack sometimes blows up, why?
    pub fn trigger(&mut self, value: Sample) {
        self.target_value = value;
        // Take the absolute so that we never end up with negative amp values
        self.attack_lin_scaler = ((self.target_value - self.value) / (self.attack_time*self.sample_rate)).abs();
    }
    pub fn next(&mut self) -> Sample {
        if self.target_value > self.value {
            self.value += self.attack_lin_scaler;
            if self.value >= self.target_value {
                self.target_value = 0.0;
            }
        } else {
            self.value *= self.decay_scaler;
        }
        self.value
    }
}

struct Phase {
    value: Sample,
    step: Sample,
}

impl Phase {
    fn new() -> Self {
        Phase {
            value: 0.0,
            step: 0.0,
        }
    }
    fn from_freq(freq: Sample, sample_rate: Sample) -> Self {
        let mut phase = Phase::new();
        phase.set_freq(freq, sample_rate);
        phase
    }
    fn set_freq(&mut self, freq: Sample, sample_rate: Sample) {
        self.step = freq / sample_rate;
    }
    #[inline]
    fn next(&mut self) -> Sample {
        // Use the phase to index into the wavetable
        let out = self.value;
        self.value = (self.value + self.step) % 1.0;
        out
    }
}

struct LFNoise1 {
    value: Sample,
    target: Sample,
    step: Sample,
    reset_counter: usize,
    steps_between: usize,
    min: Sample,
    max: Sample,
}

impl LFNoise1 {
    pub fn new(time_between: Sample, min: Sample, max: Sample, sample_rate: Sample) -> Self {
        LFNoise1 {
            value: 0.0,
            target: 0.0,
            step: 0.0,
            reset_counter: 0,
            steps_between: (time_between * sample_rate) as usize,
            min,
            max
        }
    }
}

impl LocalSig for LFNoise1 {
    fn next(&mut self, resources: &WavetableArena) -> Sample {
        if self.reset_counter <= 0 {
            self.target = random::<f64>() * (self.max - self.min) + self.min;
            self.step = (self.target - self.value) / self.steps_between as f64;
            self.reset_counter = self.steps_between;
        } else {
            self.reset_counter -= 1;
        }
        self.value += self.step;
        self.value
    }
}

// It seems very hard to keep Oscillator being Signal **and** have it fetch the wavetable from
// a WavetableArena every call to next() since next() provides no state. The state has to be in the
// Signal. We could put the Wavetable inside the Osciallator, and be unable to share it between oscillators 
// or modify it. We could also put an Rc<Wavetable> in the Oscillator, but this is not Send unless we're resorting to unsafe.
pub struct Oscillator {
    step: Sample,
    phase: Sample,
    wavetable: WavetableIndex,
    amp: Sample,
    
}

impl Oscillator
{
    pub fn new(wavetable: WavetableIndex, sample_rate: Sample) -> Self {
        Oscillator {
            step: 0.0,
            phase: 0.0,
            wavetable,
            amp: 1.0,
        }
    }
    pub fn from_freq(wavetable: WavetableIndex, sample_rate: Sample, freq: Sample, amp: Sample) -> Self {
        let mut osc = Oscillator::new(wavetable, sample_rate);
        osc.amp = amp;
        osc.set_freq(freq, sample_rate);
        osc
    }
    pub fn set_freq(&mut self, freq: Sample, sample_rate: Sample) {
        self.step = freq/sample_rate;
    }
    pub fn reset_phase(&mut self) {
        self.phase = 0.0;
    }
}
impl LocalSig for Oscillator {
    #[inline]
    fn next(&mut self, wavetable_arena: &WavetableArena) -> Sample {
        let temp_phase = self.phase;
        self.phase += self.step;
        while self.phase >= 1.0 {
            self.phase -= 1.0;
        }
        // Use the phase to index into the wavetable
        match wavetable_arena.get(self.wavetable) {
            Some(wt) => wt.get(temp_phase) * self.amp,
            None => 0.0
        }
    }
}

pub struct TriggeredOscillator {
    oscillator: Oscillator,
    env: ExponentialDecay,
}

impl TriggeredOscillator {
    pub fn new(wavetable: WavetableIndex, sample_rate: Sample) -> Self {
        TriggeredOscillator {
            oscillator: Oscillator::new(wavetable, sample_rate),
            env: ExponentialDecay::new(0.5, sample_rate),
        }
    }
    pub fn from_freq(wavetable: WavetableIndex, sample_rate: Sample, freq: Sample, amp: Sample) -> Self {
        let mut osc = Oscillator::new(wavetable, sample_rate);
        osc.amp = amp;
        osc.set_freq(freq, sample_rate);
        TriggeredOscillator {
            oscillator: osc,
            env: ExponentialDecay::new(0.5, sample_rate),
        }
    }
    pub fn trigger(&mut self, amp: Sample, decay: Sample) {
        self.oscillator.reset_phase();
        self.env.set_duration(decay);
        self.env.trigger(amp);
    }
    fn set_freq(&mut self, freq: Sample, sample_rate: Sample) {
        self.oscillator.set_freq(freq, sample_rate);
    }

    #[inline]
    fn next(&mut self, wavetable_arena: &WavetableArena) -> Sample {
        self.oscillator.next(&wavetable_arena) * self.env.next()
    }
}

/// Group of oscillators for a certain frequency range
struct SynthesisGroup {
    min_freq: Sample,
    max_freq: Sample,
    oscillators: Vec<TriggeredOscillator>,
    next_oscillator: usize,
    sample_rate: Sample,
}

impl SynthesisGroup {
    pub fn new(sine_wt: WavetableIndex, 
        min_freq: Sample, 
        max_freq: Sample,
        sample_rate: Sample,
        num_oscillators: usize
    ) -> Self {
        let mut oscillators: Vec<TriggeredOscillator> = Vec::new();
        
        for n in 0..num_oscillators {
            let sig = TriggeredOscillator::from_freq(
                sine_wt, 
                sample_rate, 
                200.0,
                0.005
            );
            oscillators.push(
                sig
            );
        }
        SynthesisGroup {
            min_freq,
            max_freq,
            oscillators,
            next_oscillator: 0,
            sample_rate,
        }
    }
    pub fn trigger_oscillator(&mut self, freq: Sample, amp: Sample, decay: Sample) {
        self.oscillators[self.next_oscillator].set_freq(freq, self.sample_rate);
        self.oscillators[self.next_oscillator].trigger(amp, decay);
        self.next_oscillator += 1;
        if self.next_oscillator >= self.oscillators.len() {
            self.next_oscillator = 0;
        }
    }
    pub fn contains_freq(&self, freq: Sample) -> bool {
        freq >= self.min_freq && freq <= self.max_freq
    }
}

impl LocalSig for SynthesisGroup {
    #[inline]
    fn next(&mut self, wavetable_arena: &WavetableArena) -> Sample {
        let mut amp = 0.0;
        for osc in &mut self.oscillators {
            amp += osc.next(wavetable_arena);
        }
        amp
    }
}

/// Group of oscillators for a certain frequency range
struct TextureGroup {
    min_freq: Sample,
    oscillators: Vec<TriggeredOscillator>,
    num_oscillators: usize,
    sample_rate: Sample,
}

impl TextureGroup {
    pub fn new(
        sine_wt: WavetableIndex, 
        min_freq: Sample, 
        ratio: Sample,
        sample_rate: Sample,
        num_oscillators: usize
    ) -> Self {
        let mut oscillators: Vec<TriggeredOscillator> = Vec::new();
        
        for n in 0..num_oscillators {
            let sig = TriggeredOscillator::from_freq(
                sine_wt, 
                sample_rate, 
                min_freq * ratio.powi(n as i32),
                0.125 / num_oscillators as f64
            );
            oscillators.push(
                sig
            );
        }
        TextureGroup {
            min_freq,
            oscillators,
            num_oscillators,
            sample_rate,
        }
    }
    pub fn trigger_oscillator(&mut self, index: usize, amp: Sample, decay: Sample) {
        self.oscillators[index % self.num_oscillators].trigger(amp, decay);
    }
}

impl LocalSig for TextureGroup {
    #[inline]
    fn next(&mut self, wavetable_arena: &WavetableArena) -> Sample {
        let mut amp = 0.0;
        for osc in &mut self.oscillators {
            amp += osc.next(wavetable_arena);
        }
        // Return a soft clipped amp
        (amp * 2.0).tanh() * 0.125
    }
}

struct BassSynthesis {
    freq: Sample,
    oscillators: Vec<TriggeredOscillator>,
    sample_rate: Sample,
    next_oscillator: usize,
}

impl BassSynthesis {
    pub fn new(sine_wt: WavetableIndex, 
        freq: Sample,
        sample_rate: Sample,
        num_oscillators: usize
    ) -> Self {
        let mut oscillators: Vec<TriggeredOscillator> = Vec::new();
        
        for n in 0..num_oscillators {
            let sig = TriggeredOscillator::from_freq(
                sine_wt, 
                sample_rate, 
                freq * (n*2+1) as Sample,
                0.05 / (n+1) as Sample
            );
            oscillators.push(
                sig
            );
        }
        BassSynthesis {
            freq,
            oscillators,
            sample_rate,
            next_oscillator: 0
        }
    }
    pub fn trigger(&mut self, amp: Sample, decay: Sample, index: usize) {
        let len = self.oscillators.len();
        self.oscillators[self.next_oscillator].trigger(amp, decay);
        self.next_oscillator = (random::<usize>()) % self.oscillators.len();
    }
    pub fn set_freq(&mut self, freq: Sample) {
        for (i, osc) in self.oscillators.iter_mut().enumerate() {
            osc.set_freq(freq * (i+1) as Sample, self.sample_rate)
        }
    }
}

impl LocalSig for BassSynthesis {
    #[inline]
    fn next(&mut self, wavetable_arena: &WavetableArena) -> Sample {
        let mut amp = 0.0;
        for osc in &mut self.oscillators {
            amp += osc.next(wavetable_arena);
        }
        amp
    }
}

/// A fixed size circular buffer delay
/// ```
/// # use ftrace_sonifier::Delay;
/// let mut delay = Delay::new(20, 1).unwrap();
/// for i in 1..16 {
///     assert_eq!(delay.next(i as f64), (i-1) as f64);
/// }
/// delay.set_delay_samples(0);
/// // When the delay is 0 the input and output should be the same.
/// assert_eq!(delay.next(100.0), 100.0);
/// ```
pub struct Delay {
    buffer: Vec<f64>,
    write_ptr: usize,
    read_ptr: usize,
}

impl Delay {
    pub fn new(length: usize, delay_samples: usize) -> Result<Self, String> {
        if delay_samples <= length {
            Ok(Delay{
                // create a Vec of length+1 samples in order to support both a delay of 0 and of
                // `length` without too much confusion i.e. `length` and `delay_samples` can be
                // the same value
                buffer: vec![0.0; length+1],
                write_ptr: 0,
                read_ptr: length+1 - delay_samples, // initialise read position to the 
            })
        } else {
            Err("Delay supplied was longer than the length of the buffer".to_owned())
        }
    }
    pub fn set_delay_samples(&mut self, delay_samples: usize) {
        if delay_samples < self.buffer.len() {
            // Set the read_ptr to the desired distance from the write_ptr and make sure it's within bounds
            self.read_ptr = (self.write_ptr - delay_samples + self.buffer.len()) % self.buffer.len();
        }
    }
    pub fn next(&mut self, input: Sample) -> Sample {
        // First write to the buffer. If the delay is zero the read_ptr should read the current input.
        self.buffer[self.write_ptr] = input;
        let output = self.buffer[self.read_ptr];

        // Increment pointers
        self.write_ptr = (self.write_ptr + 1) % self.buffer.len();
        self.read_ptr = (self.read_ptr + 1) % self.buffer.len();

        output
    }
}

struct Pan2 {
    pan: Sample,
    amps: [Sample; 2],
}

impl Pan2 {
    pub fn new(pan: Sample) -> Self {
        let mut amps = [0.0; 2];
        amps[0] = pan * -0.5 + 0.5;
        amps[1] = pan * 0.5 + 0.5;
        Pan2 {
            pan,
            amps
        }
    }

    pub fn set_pan(&mut self, pan: Sample) {
        // TODO: implement pan law
        self.amps[0] = pan * -0.5 + 0.5;
        self.amps[1] = pan * 0.5 + 0.5;
    }

    pub fn next(&mut self, input: Sample) -> [Sample; 2] {
        [input * self.amps[0], input * self.amps[1]]
    }
}

struct StereoDelay {
    delays: Vec<Delay>,
    amps: [Sample; 2],
    output: [Sample; 2],
    sample_rate: usize,
}

impl StereoDelay {
    pub fn new(sample_rate: usize) -> Self {
        let mut delays = vec![];
        for n in 0..2 {
            delays.push(Delay::new(sample_rate, 0).unwrap());
        }
        StereoDelay {
            delays,
            amps: [1.0; 2],
            output: [0.0; 2],
            sample_rate
        }
    }
    pub fn set_pan(&mut self, pan: f64) {
        let del1 = (pan*-0.05).max(0.0);
        let del2 = (pan*0.05).max(0.0);
        self.delays[0].set_delay_samples((self.sample_rate as f64 * del1) as usize);
        self.delays[1].set_delay_samples((self.sample_rate as f64 * del2) as usize);
    }
    pub fn next(&mut self, input: Sample) -> [Sample; 2] {
        self.output[0] = self.delays[0].next(input);
        self.output[1] = self.delays[1].next(input);
        self.output
    }
}

// We could later turn WavetableIndex into a generational index if we'd want
type WavetableIndex = usize;
pub struct WavetableArena {
    wavetables: Vec<Option<Wavetable>>,
    next_free_index: WavetableIndex,
    freed_indexes: Vec<WavetableIndex>,
}

impl WavetableArena {
    fn new() -> Self {
        let mut wavetables = Vec::with_capacity(100);
        for i in 0..100 {
            wavetables.push(None);
        }
        WavetableArena {
            wavetables,
            next_free_index: 0,
            freed_indexes: vec![]
        }
    }
    fn get(&self, index: WavetableIndex) -> &Option<Wavetable> {
        &self.wavetables[index]
    }
    fn add(&mut self, wavetable: Wavetable) -> WavetableIndex {
        // TODO: In order to do this safely in an audio thread we should pass the old value on to a helper thread for deallocation
        // since dropping it here would probably deallocate it.
        let old_wavetable = self.wavetables[self.next_free_index].replace(wavetable);
        let index = self.next_free_index;
        self.next_free_index += 1;
        // TODO: Check that the next free index is within the bounds of the wavetables Vec or else use the indexes that have been freed
        index
    }

}

pub struct SynthesisEngine {
    wavetable_arena: WavetableArena,
    sample_rate: Sample,
    synthesis_groups: Vec<SynthesisGroup>,
    texture_groups: Vec<TextureGroup>,
    single_pitches: Vec<SinglePitch>,
    bass_synthesis: BassSynthesis,
    output_frame: [Sample; 2],
}

impl SynthesisEngine {
    pub fn new(sample_rate: Sample) -> Self {
        let mut wavetable_arena = WavetableArena::new();
        // Add a wavetable to the arena
        let sine_wt = wavetable_arena.add(Wavetable::sine(131072));
        let multi_sine_wt = wavetable_arena.add(Wavetable::multi_sine(131072, 15));
        let mut synthesis_groups = vec![];
        let mid_group = SynthesisGroup::new(
            sine_wt,
            100.0,
            300.0,
            sample_rate,
            200
        );
        let mid_high_group = SynthesisGroup::new(
            sine_wt,
            300.0,
            800.0,
            sample_rate,
            200
        );
        let high_group = SynthesisGroup::new(
            sine_wt,
            800.0,
            2000.0,
            sample_rate,
            200
        );
        let high_high_group = SynthesisGroup::new(
            sine_wt,
            200.0,
            10000.0,
            sample_rate,
            200
        );
        let air_group = SynthesisGroup::new(
            sine_wt,
            1000.0,
            20000.0,
            sample_rate,
            200
        );
        synthesis_groups.push(mid_group);
        synthesis_groups.push(mid_high_group);
        synthesis_groups.push(high_group);
        synthesis_groups.push(high_high_group);
        synthesis_groups.push(air_group);

        // The ratio between pitches in a TextureGroup
        let texture_ratio = 2_f64.powf(1.0/159.0);

        let mut texture_groups = Vec::new();

        for n in 0..3 {
            texture_groups.push(TextureGroup::new(
                sine_wt,
                100.0 * 2_f64.powi(n*2+1),
                texture_ratio,
                sample_rate,
                159 * 1
            ));
        }

        let mut single_pitches = Vec::new();

        let ratio53 = 2_f64.powf(1.0/53.0);
        let chord: Vec<f64> = [ 0, 9, 14, 31, 40, 53, 62, 67, 84, 93, 106, 115, 120, 137, 146, 159, 168, 173, 190, 199, 212, 221, 226, 243, 252, 265, 274, 279, 296, 305, 318, 327 ].iter().map(|degree| 40.0 * ratio53.powi(*degree)).collect();
        for freq in chord {
            single_pitches.push(SinglePitch::new(freq, multi_sine_wt, sample_rate, 5.0, random::<f64>() * 2.0 - 1.0));
        }
        
        

        let bass_synthesis = BassSynthesis::new(
            multi_sine_wt,
            50.0,
            sample_rate,
            16,
        );

        SynthesisEngine {
            wavetable_arena,
            sample_rate,
            synthesis_groups,
            bass_synthesis,
            single_pitches,
            texture_groups,
            output_frame: [0.0; 2],
        }
    }

    pub fn trigger_oscillator(&mut self, freq: Sample, amp: Sample, decay: Sample) {
        for synth_group in &mut self.synthesis_groups {
            if synth_group.contains_freq(freq) {
                synth_group.trigger_oscillator(freq, amp, decay);
                break;
            }
        }
    }

    pub fn trigger_texture(&mut self, texture_index: usize, index: usize, amp: Sample, decay: Sample) {
        self.texture_groups[texture_index].trigger_oscillator(index, amp, decay);
    }

    pub fn trigger_bass(&mut self, amp: Sample, decay: Sample, index: usize) {
        self.bass_synthesis.trigger(amp, decay, index);
    }

    pub fn add_energy_to_pitch(&mut self, index: usize, energy: Sample) {
        self.single_pitches[index].add_energy(energy);
    }

    pub fn next(&mut self) -> [Sample; 2] {
        let mut amp = 0.0;
        self.output_frame = [0.0; 2];
        
        for group in &mut self.synthesis_groups {
            amp += group.next(&self.wavetable_arena);
        }
        amp += self.bass_synthesis.next(&self.wavetable_arena);
        for texture in &mut self.texture_groups {
            amp += texture.next(&self.wavetable_arena);
        }
        self.output_frame[0] += amp;
        self.output_frame[1] += amp;
        for pitch in &mut self.single_pitches {
            let frame = pitch.next(&self.wavetable_arena);
            self.output_frame[0] += frame[0];
            self.output_frame[1] += frame[1];
        }

        self.output_frame
    }

    pub fn num_textures(&self) -> usize {
        self.texture_groups.len()
    }

    pub fn num_single_pitches(&self) -> usize {
        self.single_pitches.len()
    }
}


#[derive(Copy, Clone)]
pub struct Sine {
    pub sample_rate: f64,
    pub phase: f64,
    pub freq: f64,
    pub amp: f64,
    pub add: f64,
}

impl Sine {
    pub fn new() -> Self {
        Sine {
            phase: 0.0,
            freq: 220.0,
            amp: 0.0,
            add: 0.0,
            sample_rate: 44100.0,
        }
    }

    pub fn from(freq: f64, amp: f64, add: f64, phase: f64, sample_rate: f64) -> Self {
        Sine {
            phase,
            freq,
            amp,
            add,
            sample_rate,
        }
    }

    pub fn set_range(&mut self, min: f64, max: f64) {
        self.amp = ((max - min)/2.0).abs();
        self.add = (max + min)/2.0;
    }

    pub fn next(&mut self) -> f64 {
        let sine_amp = (2.0 * PI * self.phase).sin();
        self.phase += self.freq / self.sample_rate;
        self.phase %= self.sample_rate;
        return (sine_amp * self.amp) + self.add;
    }
}

pub struct Metronome {
    tick_duration: usize,
    sample_counter: usize,
    ticks_per_bar: usize,
    current_tick: usize,
    exponential_decay: ExponentialDecay,
    synth: Sine,
}


impl Metronome {
    pub fn new(bpm: usize, ticks_per_bar: usize, sample_rate: usize) -> Self {
        let mut m = Metronome{
            tick_duration: 60 * sample_rate / bpm,
            sample_counter: 0,
            ticks_per_bar,
            current_tick: 0,
            exponential_decay: ExponentialDecay::new(0.5, sample_rate as f64),
            synth: Sine::from(2000.0, 0.1, 0.0, 0.0, sample_rate as f64),
        };
        m.exponential_decay.trigger(1.0);
        m
    }
    pub fn next(&mut self) -> Sample {
        // Progress state machine
        self.sample_counter += 1;
        if self.sample_counter >= self.tick_duration {
            self.exponential_decay.trigger(1.0);
            self.sample_counter = 0;
            self.current_tick += 1;
            if self.current_tick >= self.ticks_per_bar {
                self.synth.freq = 2000.0;
                self.current_tick = 0;
            } else {
                self.synth.freq = 1000.0;
            }
        }

        self.synth.next() * self.exponential_decay.next()
    }
}

#[derive(Copy, Clone)]
pub struct LowPassFilter {
    last_output: Sample,
    alpha: Sample,
}

impl LowPassFilter {
    pub fn new(alpha: Sample) -> Self {
        LowPassFilter{ last_output: 0.0, alpha }
    }

    pub fn next(&mut self, input: Sample) -> Sample {
        let value = self.last_output * self.alpha + (1.0-self.alpha) * input;
        self.last_output = value;
        value
    }
}

#[derive(Copy, Clone)]
pub struct FMSynth {
    pub sample_rate: f64,
    pub freq: f64,
    pub m_ratio: f64,
    pub c_ratio: f64,
    pub m_index: f64,
    pub c_phase: f64,
    pub c_phase_step: f64,
    pub m_phase: f64,
    pub m_phase_step: f64,
    c_sample: f64,
    m_sample: f64,
    pub lfo_freq: f64,
    pub lfo_amp: f64,
    pub lfo_add: f64,
    pub lfo_phase: f64,
    lfo_val: f64,
    pub amp: f64,
    pub number_of_triggers: f64,
}

impl FMSynth {
    pub fn new(sample_rate: f64, freq: f64, amp: f64, m_ratio: f64, c_ratio: f64, m_index: f64) -> Self {

        // let mod_freq = signal::gen(|| [freq * m_ratio]);
        // let modulator = signal::rate(sample_rate).hz(mod_freq).sine();
        // let car_freq = signal::gen(|| [freq * c_ratio]).add_amp(modulator);
        // let carrier = signal::rate(sample_rate).hz(car_freq).sine();

        let mut synth = FMSynth {
            sample_rate,
            freq,
            m_ratio,
            c_ratio,
            m_index,
            c_phase: 0.0,
            c_phase_step: 0.0,
            m_phase: 0.0,
            m_phase_step: 0.0,
            c_sample: 0.0,
            m_sample: 0.0,
            lfo_freq: 3.0,
            lfo_amp: 4.0,
            lfo_add: 5.0,
            lfo_phase: 0.0,
            lfo_val: 0.0,
            amp,
            number_of_triggers: 0.0,
        };
        synth
    }
    pub fn next_stereo(&mut self) -> [f64; 2] {
        // LFO
        self.lfo_phase += (2.0 * std::f64::consts::PI * self.lfo_freq) / self.sample_rate;
        self.lfo_val = self.lfo_phase.sin() * self.lfo_amp + self.lfo_add;
        self.m_index = self.lfo_val;

        // Modulator
        self.m_phase_step = (2.0 * std::f64::consts::PI * self.freq * self.m_ratio) / self.sample_rate;
        self.m_phase += self.m_phase_step;
        self.m_sample = self.m_phase.sin() * self.freq * self.m_index;

        // Carrier
        // The frequency depends on the modulator so the phase step has to be calculated every step
        // let c_freq = self.freq * self.c_ratio + self.m_sample;
        self.c_phase_step = (2.0 * std::f64::consts::PI * self.freq * self.c_ratio + self.m_sample * self.c_ratio) / self.sample_rate;
        self.c_phase += self.c_phase_step;

        // The carrier output is the output of the synth
        self.c_sample = self.c_phase.sin() * self.amp;

        // Reset number of triggers
        self.number_of_triggers = 0.0;
        
        [self.c_sample, self.c_sample]
    }
    pub fn set_freq(&mut self, freq: f64) {
        self.freq = freq;
    }
    pub fn control_rate_update(&mut self) {
        self.amp *= 0.92;
    }
    pub fn trigger(&mut self, freq: f64, amp: f64) {
        self.number_of_triggers += 1.0;
        // Set the new frequencymp: f64
        // Set it so that it is an average of all triggers
        self.freq = (self.freq * (self.number_of_triggers-1.0)/self.number_of_triggers) + 
                    (freq * (1.0/self.number_of_triggers));
                    
        // Setting the amplitude triggers an attack
        self.amp = amp;
        // Reset all phases
        // self.lfo_phase = 0.0; // You may or may not want to reset the lfo phase based on how you use it
        // self.m_phase = 0.0;
        // self.c_phase = 0.0;
    }
}