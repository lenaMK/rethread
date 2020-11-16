class PortsScene extends Scene {
  constructor() {
    super();
    this.selectedHue = 50;
    this.drawNetwork = false;
    this.drawParticles = true;
    this.sections = [];
    this.playhead = {
      sectionIndex: 0,
      countdown: 0,
      state: "before start", // "playing", "fade in", "end of movement"
    };
  }
  preload() {
    // This function is called from the p5 preload function. Use it
    // to load assets such as fonts and shaders.
    this.mistyShader = loadShader("assets/standard.vert", "assets/misty.frag");
    this.lightsShader = loadShader(
      "assets/standard.vert",
      "assets/lights.frag"
    );
  }
  setup() {
    // This function is called from the p5 setup function. Use it to init
    // all the state that requires p5 to be loaded (such as instantiating
    // p5 types like p5.Vector or createGraphics).
    this.pg = createGraphics(canvasX, canvasY);
    this.textPg = createGraphics(canvasX, canvasY);
    this.shaderCanvas = createGraphics(canvasX, canvasY, WEBGL);
    this.textPg.textAlign(CENTER, CENTER);
    this.textPg.textFont(antonFont);
    this.rows = [
      windows[0].center.copy().add(windows[1].center).x / 2,
      windows[1].center.copy().add(windows[2].center).x / 2,
    ];
    this.lines = [
      48 * subsampling,
      130 * subsampling,
      214 * subsampling,
      297 * subsampling,
    ];
  }
  draw(dt) {
    // Update state and draw. dt is the time since last frame in seconds.

    if (this.playhead.state == "before start") {
      return;
    } else if (this.playhead.state == "fade in") {
      this.playhead.countdown -= dt;
      // Will pass from the "fade in" state by play() being called externally
    } else if (this.playhead.state == "playing") {
      this.playhead.countdown -= dt;
      if (this.playhead.countdown <= 0) {
        this.playhead.sectionIndex += 1;
        if (this.playhead.sectionIndex < this.sections.length) {
          this.playhead.countdown = this.sections[
            this.playhead.sectionIndex
          ].duration;
          if (this.sections[this.playhead.sectionIndex].name == "fade out") {
            this.fadeOut();
          } else if (
            this.sections[this.playhead.sectionIndex].name == "packets"
          ) {
            this.drawNetwork = false;
            this.drawParticles = true;
            console.log("Packets sections");
          } else if (
            this.sections[this.playhead.sectionIndex].name == "network"
          ) {
            this.drawNetwork = true;
            this.drawParticles = false;
            console.log("Network section");
          }
        }
      }
    }
    if (this.playhead.state == "playing" || this.playhead.state == "fade out") {
      colorMode(HSL, 100);

      let backgroundHue = Math.min(
        (metrics.rollingTotalLen / 1000000.0 - 2.0) * 3.0,
        9.0
      );

      this.pg.background(0, 0, 100 - pow(backgroundHue, 3.0) * 0.5, 6);

      fill(75, 100, 0, 100);

      this.pg.colorMode(HSL, 100);
      this.originNode.update(dt);
      this.originNode.drawEdges(
        this.pg,
        this.fallingText.node,
        this.selectedHue,
        this.drawNetwork
      );
      this.originNode.drawNodes(this.pg, this.selectedHue);

      let pixelDensity = displayDensity();
      this.lightsShader.setUniform("iResolution", [
        canvasX * pixelDensity,
        canvasY * pixelDensity,
      ]);
      this.lightsShader.setUniform("iTime", (now - firstNow) * 0.001);
      this.lightsShader.setUniform("windows1", [
        windows[0].activity,
        windows[1].activity,
        windows[2].activity,
      ]);
      this.lightsShader.setUniform("windows2", [
        windows[3].activity,
        windows[4].activity,
        windows[5].activity,
      ]);
      this.lightsShader.setUniform("windows3", [
        windows[6].activity,
        windows[7].activity,
        windows[8].activity,
      ]);
      this.lightsShader.setUniform("windows4", [
        windows[9].activity,
        windows[10].activity,
        windows[11].activity,
      ]);
      this.lightsShader.setUniform("windows5", [
        windows[12].activity,
        windows[13].activity,
        windows[14].activity,
      ]);
      this.shaderCanvas.clear();
      this.shaderCanvas.shader(this.lightsShader);
      this.shaderCanvas.quad(-1, -1, 1, -1, 1, 1, -1, 1);
      image(this.shaderCanvas, 0, 0);

      this.textPg.colorMode(HSL, 100);
      this.textPg.noStroke();
      this.textPg.clear();
      this.fallingText.update(dt, this.labeledNodes);
      this.fallingText.draw(this.textPg, this.selectedHue);

      image(this.pg, 0, 0);
      image(this.shaderCanvas, 0, 0);
      image(this.textPg, 0, 0);
    }
  }
  reset(sections) {
    // This is called to reset the state of the Scene before it is started
    this.sections = sections;
    let allPorts = [
      443,
      80,
      23,
      53,
      9001,
      22,
      993,
      9000,
      6881,
      1194,
      4500,
      3478,
      123,
      389,
      3306,
      25,
    ];
    this.originNode = new Node(
      "ALL PACKETS",
      allPorts,
      createVector(0, 0),
      true,
      7
    );

    let leftTopNode1 = new Node(
      "",
      [1194, 23, 22],
      createVector(this.rows[0], this.lines[1]),
      false,
      -1
    );
    this.originNode.createConnection(leftTopNode1);
    let leftTopNode2 = new Node(
      "",
      [22],
      createVector(this.rows[0], this.lines[0]),
      false,
      -1
    );
    leftTopNode1.createConnection(leftTopNode2);
    let openVPNNode = new Node(
      ["Privacy", "OpenVPN"],
      [1194],
      createVector(0, 0),
      true,
      3
    );
    leftTopNode1.createConnection(openVPNNode);
    let telnetNode = new Node(
      ["Maintenance", "Telnet"],
      [23],
      createVector(0, 0),
      true,
      4
    );
    leftTopNode1.createConnection(telnetNode);
    let sshNode = new Node(
      ["Maintenance", "SSH"],
      [22],
      createVector(0, 0),
      true,
      0
    );
    leftTopNode2.createConnection(sshNode);

    let rightTopNode1 = new Node(
      "",
      [443, 80, 123, 4500, 3478],
      createVector(this.rows[1], this.lines[1]),
      false,
      -1
    );
    this.originNode.createConnection(rightTopNode1);
    let rightTopNode2 = new Node(
      "",
      [443, 80],
      createVector(this.rows[1], this.lines[0]),
      false,
      -1
    );
    rightTopNode1.createConnection(rightTopNode2);
    let httpsNode = new Node(
      ["Web", "HTTPS"],
      [443],
      createVector(0, 0),
      true,
      1
    );
    rightTopNode2.createConnection(httpsNode);
    let httpNode = new Node(["Web", "HTTP"], [80], createVector(0, 0), true, 2);
    rightTopNode2.createConnection(httpNode);
    let ntpNode = new Node(
      ["Time Sync", "NTP"],
      [123],
      createVector(0, 0),
      true,
      5
    );
    rightTopNode1.createConnection(ntpNode);
    let natTraversalNode = new Node(
      ["Infrastructure", "NAT Traversal"],
      [4500, 3478],
      createVector(0, 0),
      true,
      8
    );
    rightTopNode1.createConnection(natTraversalNode);

    let leftBottomNode1 = new Node(
      "",
      [53, 389, 993, 25],
      createVector(this.rows[0], this.lines[2]),
      false,
      -1
    );
    this.originNode.createConnection(leftBottomNode1);
    let leftBottomNode2 = new Node(
      "",
      [993, 25],
      createVector(this.rows[0], this.lines[3]),
      false,
      -1
    );
    leftBottomNode1.createConnection(leftBottomNode2);
    let dnsNode = new Node(["Web", "DNS"], [53], createVector(0, 0), true, 6);
    leftBottomNode1.createConnection(dnsNode);
    let ldapNode = new Node(
      ["Security", "LDAP"],
      [389],
      createVector(0, 0),
      true,
      9
    );
    leftBottomNode1.createConnection(ldapNode);
    let imapsNode = new Node(
      ["E-mail", "IMAPS"],
      [993],
      createVector(0, 0),
      true,
      12
    );
    leftBottomNode2.createConnection(imapsNode);
    let smtpNode = new Node(
      ["E-mail", "SMTP"],
      [25],
      createVector(0, 0),
      true,
      13
    );
    leftBottomNode2.createConnection(smtpNode);

    let rightBottomNode1 = new Node(
      "",
      [3306, 9000, 6881, 9001],
      createVector(this.rows[1], this.lines[2]),
      false,
      -1
    );
    this.originNode.createConnection(rightBottomNode1);
    let rightBottomNode2 = new Node(
      "",
      [9001],
      createVector(this.rows[1], this.lines[3]),
      false,
      -1
    );
    rightBottomNode1.createConnection(rightBottomNode2);
    let mysqlNode = new Node(
      ["Data", "MySQL"],
      [3306],
      createVector(0, 0),
      true,
      10
    );
    rightBottomNode1.createConnection(mysqlNode);
    let bittorrentNode = new Node(
      ["Transmission", "BitTorrent"],
      [9000, 6881],
      createVector(0, 0),
      true,
      11
    );
    rightBottomNode1.createConnection(bittorrentNode);
    let torNode = new Node(
      ["Privacy", "Tor"],
      [9001],
      createVector(0, 0),
      true,
      14
    );
    rightBottomNode2.createConnection(torNode);

    this.labeledNodes = [
      openVPNNode,
      telnetNode,
      sshNode,
      httpsNode,
      httpNode,
      ntpNode,
      natTraversalNode,
      dnsNode,
      ldapNode,
      imapsNode,
      smtpNode,
      mysqlNode,
      bittorrentNode,
      torNode,
    ];

    this.fallingText = {
      node: undefined,
      nodeIndex: -1,
      textSize: 13 * subsampling,
      textSizeGrowth: 20 * subsampling,
      x: canvasX / 2,
      y: canvasY + 1,
      vel: canvasY / 3.0,
      string: "",
      lines: [
        48 * subsampling,
        130 * subsampling,
        214 * subsampling,
        297 * subsampling,
      ],
      update: function (dt, labeledNodes) {
        this.y += this.vel * dt;
        this.textSize += this.textSizeGrowth * dt;
        if (this.y > canvasY * 1.3) {
          this.textSize = 11 * subsampling;
          this.y = 0;
          // this.nodeIndex = (this.nodeIndex + 1) % labeledNodes.length;
          this.nodeIndex = Math.floor(Math.random() * labeledNodes.length);
          this.setNewNode(labeledNodes[this.nodeIndex]);
          this.vel = canvasY / (2.0 * Math.random() + 2.0);
        }
      },
      setNewNode: function (newNode) {
        if (this.node != undefined) {
          this.node.selected = false;
        }
        this.node = newNode;
        this.node.selected = true;
        this.string = this.node.label;
      },
      draw: function (g, selectedHue) {
        if (this.node != undefined) {
          g.fill(
            selectedHue + 2,
            50,
            this.node.activity * 50 + 50,
            (1.0 - Math.pow(this.y / canvasY, 2.0)) * 100.0
          );
          g.noStroke();
        }

        let texts = this.string;
        g.textSize(this.textSize);
        if (typeof texts === "string" || texts instanceof String) {
          g.text(this.string, this.x, this.y);
        } else if (Array.isArray(texts)) {
          for (let i = 0; i < texts.length; i++) {
            g.text(texts[i], this.x, this.lines[i + 1]); // this.y + this.textSize * i * 1.5);
          }
        }
      },
    };

    this.playhead = {
      sectionIndex: 0,
      countdown: 0,
      state: "before start", // "playing", "fade in", "end of movement"
    };

    console.log("Reset ports");
  }
  registerPacket(internalData, country, continent) {
    if (this.originNode != undefined) {
      if (this.originNode.hasPort(internalData.local_port)) {
        // originNode.registerPort(internalData.local_port);
        this.originNode.passParticleOn(
          new ConnectionParticle(internalData.local_port, this.drawParticles)
        );
      }
      if (this.originNode.hasPort(internalData.remove_port)) {
        // originNode.registerPort(internalData.remove_port);
        this.originNode.passParticleOn(
          new ConnectionParticle(internalData.remove_port, this.drawParticles)
        );
      }
    }
  }
  fadeIn(duration) {
    // Called when the previous scene is starting to fade out
  }
  fadeOut(duration) {
    // Called from within the Scene when the "fade out" section starts
    this.playhead.state = "fade out";
    console.log("Fade out ports");
  }
  play() {
    // Called when this Scene becomes the current Scene (after teh crossfade)
    this.playhead.sectionIndex = -1;
    this.playhead.state = "playing";
    this.playhead.countdown = 0;
    console.log("Play ports");
  }
}

class Edge {
  constructor() {
    this.activity = 0.0;
    this.falloff = 0.5;
  }
  update(dt) {
    this.activity -= this.falloff * dt;
    if (this.activity < 0) {
      this.activity = 0;
    }
  }
  draw(g, p1, p2, selected, selectedHue, drawNetwork) {
    if (drawNetwork) {
      if (selected) {
        g.stroke(selectedHue + 2, 100, this.activity * 50 + 35, 100);
      } else {
        g.stroke(this.activity * 9, 100, this.activity * 50 + 50, 100);
      }
      g.strokeWeight(subsampling);
      g.line(p1.x, p1.y, p2.x, p2.y);
    }
  }
}

class Node {
  constructor(label, ports, pos, isWindow, windowIndex) {
    this.label = label;
    this.ports = ports;
    this.pos = pos;
    this.offsetPos = createVector(0, 0);
    this.vel = createVector(0, 0);
    this.isWindow = isWindow;
    this.windowIndex = windowIndex;
    this.activity = 0.0;
    this.falloff = 0.45;
    this.connections = [];
    this.selected = false;

    if (isWindow == true) {
      this.pos = createVector(
        windows[windowIndex].x + windows[windowIndex].w / 2,
        windows[windowIndex].y + windows[windowIndex].h / 2
      );
    }
  }
  update(dt) {
    this.activity -= this.falloff * dt;
    if (this.activity < 0) {
      this.activity = 0;
    }
    if (this.isWindow == false) {
      let pullBack = this.offsetPos.copy().mult(-1).normalize(); // mult of 0.001 keeps it in check
      this.vel.add(pullBack);
      this.offsetPos.add(this.vel.copy().mult(dt));
    } else {
      windows[this.windowIndex].activity = Math.pow(this.activity, 2.0);
    }
    for (let c of this.connections) {
      c.update(dt, this.pos);
    }
  }
  drawNodes(g, selectedHue) {
    g.fill(
      this.activity * 9,
      70,
      (1.0 - Math.pow(1.0 - this.activity, 2.0)) * 80,
      100
    );
    g.noStroke();
    if (this.isWindow == false && this.drawNetwork) {
      // g.ellipse(
      //   this.pos.x + this.offsetPos.x,
      //   this.pos.y + this.offsetPos.y,
      //   10 * subsampling,
      //   10 * subsampling
      // );
    } else if (this.isWindow) {
      let w = windows[this.windowIndex];
      let size = 8 * subsampling * this.activity;
      // g.rect(w.x-size, w.y-size, w.w + size + size, w.h + size + size);
      if (this.selected) {
        let size = 2 * subsampling;
        g.stroke(selectedHue + 2, 50, 60, 100);
        g.strokeWeight(subsampling * 4);
        g.noFill();
        g.rect(w.x - size, w.y - size, w.w + size + size, w.h + size + size);
      }
    }

    for (let c of this.connections) {
      c.drawNodes(g, selectedHue);
    }
  }
  drawEdges(g, selectedNode, selectedHue, drawNetwork) {
    let pos = this.pos;
    if (this.isWindow == false) {
      pos = this.pos.copy().add(this.offsetPos);
    }
    for (let c of this.connections) {
      c.drawEdges(g, pos, selectedNode, selectedHue, drawNetwork);
    }
  }
  hasPort(port) {
    for (let p of this.ports) {
      if (p == port) {
        return true;
      }
    }
    return false;
  }
  registerPort(port, previousPos) {
    // New activity on this port, let it flow through the network
    // console.log("register port " + port + " activity: " + this.activity);
    this.activity = Math.min(this.activity + (1.0 - this.activity) * 0.2, 1.0);
    if (this.isWindow == false) {
      let distSqFromOriginal =
        Math.pow(this.offsetPos.x, 2.0) + Math.pow(this.offsetPos.y, 2.0);
      let pull = this.pos
        .copy()
        .add(this.offsetPos)
        .sub(previousPos)
        .normalize()
        .mult(Math.max(Math.random() * -50.0 - distSqFromOriginal * 0.01, 0.0));
      pull.add(
        createVector(
          Math.random() * 20.02 - 10.01,
          Math.random() * 20.02 - 10.01
        )
      );
      this.vel.add(pull);
      this.vel.limit(50);
    }
    for (let c of this.connections) {
      if (c.hasPort(port)) {
        c.registerPort(port, this.pos);
      }
    }
  }
  createConnection(destinationNode) {
    let connection = new Connection(
      destinationNode,
      new Edge(this.selectedHue)
    );
    this.connections.push(connection);
  }
  passParticleOn(particle) {
    let matchFound = false;
    for (let c of this.connections) {
      if (c.hasPort(particle.port)) {
        c.addParticle(particle, this.pos);
        matchFound = true;
        break;
      }
    }
    if (matchFound == false) {
      particle.connectionId = -1;
    }
  }
}

class Connection {
  static counter = 0;
  static getNewId() {
    let oldCount = Connection.counter;
    Connection.counter += 1;
    return oldCount;
  }
  constructor(node, edge) {
    this.node = node; // the destination node
    this.edge = edge;
    this.particles = [];
    this.id = Connection.getNewId();
  }
  hasPort(port) {
    return this.node.hasPort(port);
  }
  addParticle(particle, previousNodePos) {
    particle.moveToConection(this);
    this.particles.push(particle);
    // this.node.registerPort(particle.port, previousNodePos);
  }
  update(dt, previousNodePos) {
    for (let p of this.particles) {
      p.update(dt);
      if (p.pos >= 1.0) {
        this.node.registerPort(p.port, previousNodePos);
        this.node.passParticleOn(p);
      }
    }
    this.particles = this.particles.filter((p) => p.connectionId == this.id);
    this.node.update(dt);
    this.edge.update(dt);
  }
  drawNodes(g, selectedHue) {
    this.node.drawNodes(g, selectedHue);
  }
  drawEdges(g, sourceNodePos, selectedNode, selectedHue, drawNetwork) {
    let pos = this.node.pos;
    if (this.node.isWindow == false) {
      pos = this.node.pos.copy().add(this.node.offsetPos);
    }

    let selected = false;
    if (selectedNode != undefined) {
      for (let port of this.node.ports) {
        if (selectedNode.hasPort(port)) {
          selected = true;
          break;
        }
      }
    }

    this.edge.draw(g, sourceNodePos, pos, selected, selectedHue, drawNetwork);
    for (let p of this.particles) {
      p.draw(g, sourceNodePos, pos, selectedNode, selectedHue);
    }
    this.node.drawEdges(g, selectedNode, selectedHue, drawNetwork);
  }
  registerPort(port, previousPos) {
    this.edge.activity = Math.min(this.edge.activity + 0.2, 1.0);
    // this.node.registerPort(port, previousPos);
  }
}

class ConnectionParticle {
  constructor(port, doDraw) {
    this.port = port;
    this.pos = 0;
    this.speed = 1.0;
    this.connectionId = 0;
    this.doDraw = doDraw;
  }
  moveToConection(connection) {
    this.pos = 0;
    this.connectionId = connection.id;
  }
  update(dt) {
    this.pos += this.speed * dt;
  }
  draw(g, p1, p2, selectedNode, selectedHue) {
    if (this.doDraw) {
      if (selectedNode != undefined && selectedNode.hasPort(this.port)) {
        g.fill(selectedHue + 2, 50, 60, 100);
        // g.fill(selectedHue, 100, 55, 100);
      } else {
        g.fill(2, 100, 55, 100);
      }

      g.noStroke();
      let x = p1.x + (p2.x - p1.x) * this.pos;
      let y = p1.y + (p2.y - p1.y) * this.pos;
      g.ellipse(x, y, 4 * subsampling, 4 * subsampling);
    }
  }
}
