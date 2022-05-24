let encoder = {
  x: 0,
  y: 0,
  rotation: 0,
  touch_angle: 0,
  pull_rotation: 0,
  size: 200,
  dip_size: 30,
  dip_offset: 0.8,
  update_rotation: function (x, y) {
    // calculate the angle of the mouse position and change rotation the amount of the difference since the last angle
    let new_touch_angle = atan2(this.x - x, y - this.y);
    let change = new_touch_angle - this.touch_angle;
    // Keep the change within -PI >= change >= PI so that there isn't a sudden jump
    // in the sign of the change. This avoids discontinuities.
    if (change > PI) {
      change -= TAU;
    }
    if (change < -PI) {
      change += TAU;
    }
    let step = TAU / 30;
    if (change > step) {
      this.rotation += step * Math.floor(change / step);
      this.touch_angle = step * Math.floor(new_touch_angle / step);
      this.pull_rotation = 0;
      socket.emit("step");
    } else if (change > 0) {
      this.pull_rotation = change * 0.5;
    }
  },
  draw: function () {
    noStroke();
    fill(200);
    ellipse(this.x, this.y, this.size * 1.05, this.size * 1.05);
    stroke(0);

    push();
    let num_outer_lines = 30;
    translate(this.x, this.y);
    let outer_rotation = TAU / num_outer_lines;
    for (let i = 0; i < num_outer_lines; i++) {
      rotate(outer_rotation);
      line(this.size * 0.5, 0, this.size * 0.525, 0);
    }
    pop();

    fill(255);
    ellipse(this.x, this.y, this.size, this.size);
    let dip_offset = this.size * this.dip_offset * 0.5;
    let rotation = this.rotation + this.pull_rotation;
    let dip_x = this.x + cos(rotation) * dip_offset;
    let dip_y = this.y + sin(rotation) * dip_offset;
    fill(10);
    ellipse(dip_x, dip_y, this.dip_size, this.dip_size);
    ellipse(this.x, this.y, this.size * 0.01, this.size * 0.01);
    push();
    let num_lines = 12;
    translate(this.x, this.y);
    rotate(rotation);
    let option_rotation = TAU / num_lines;
    for (let i = 0; i < num_lines; i++) {
      rotate(option_rotation);
      line(this.size * 0.4, 0, this.size * 0.5, 0);
    }
    pop();
  },
};

let setting_wheel = {
  x: 0,
  y: 0,
  rotation: 0,
  pull_rotation: 0,
  touch_angle: 0,
  size: 200,
  dip_size: 20,
  dip_offset: 0.8,
  num_options: 6,
  option_names: [
    "contrast",
    "saturation",
    "invert",
    "brightness",
    "sepia",
    "colorFilter",
  ],
  update_rotation: function (x, y) {
    // calculate the angle of the mouse position and change rotation the amount of the difference since the last angle
    let new_touch_angle = atan2(this.x - x, y - this.y);
    let change = new_touch_angle - this.touch_angle;
    // Keep the change within -PI >= change >= PI so that there isn't a sudden jump
    // in the sign of the change
    if (change > PI) {
      change -= TAU;
    }
    if (change < -PI) {
      change += TAU;
    }
    let option_rotation = TAU / this.num_options;
    if (abs(change) > option_rotation) {
      this.rotation += max(min(change, option_rotation), -option_rotation);
      this.rotation %= TAU;
      this.touch_angle = new_touch_angle;
      let option =
        Math.round((this.rotation * this.num_options) / TAU) % this.num_options;
      while (option < 0) {
        option += this.num_options;
      }
      this.pull_rotation = 0;
      console.log("option: " + option + this.option_names[option]);
      socket.emit("filter", this.option_names[option]);
    } else {
      this.pull_rotation = change * 0.2;
    }
  },
  draw: function () {
    noStroke();
    fill(200);
    ellipse(this.x, this.y, this.size * 1.05, this.size * 1.05);
    fill(255);
    stroke(0);
    strokeWeight(1);
    ellipse(this.x, this.y, this.size, this.size);
    let rotation = this.rotation + this.pull_rotation;
    let arrow_offset = this.size * this.dip_offset * 0.5;
    let dir = createVector(cos(rotation), sin(rotation));
    let arrow_x1 = this.x + dir.x * arrow_offset * 0.5;
    let arrow_y1 = this.y + dir.y * arrow_offset * 0.5;
    let arrow_x2 = this.x + dir.x * arrow_offset;
    let arrow_y2 = this.y + dir.y * arrow_offset;
    strokeWeight(3);
    line(arrow_x1, arrow_y1, arrow_x2, arrow_y2);
    let dir_back = createVector(cos(rotation - 0.2), sin(rotation - 0.2));
    let dir_front = createVector(cos(rotation + 0.2), sin(rotation + 0.2));
    let arrow_x3 = this.x + dir_back.x * arrow_offset * 0.8;
    let arrow_y3 = this.y + dir_back.y * arrow_offset * 0.8;
    let arrow_x4 = this.x + dir_front.x * arrow_offset * 0.8;
    let arrow_y4 = this.y + dir_front.y * arrow_offset * 0.8;
    line(arrow_x2, arrow_y2, arrow_x3, arrow_y3);
    line(arrow_x2, arrow_y2, arrow_x4, arrow_y4);
    fill(10);
    strokeWeight(1);
    ellipse(this.x, this.y, this.size * 0.01, this.size * 0.01);
    push();
    translate(this.x, this.y);
    stroke(255);
    fill(255);
    let option_rotation = TAU / this.num_options;
    for (let i = 0; i < this.num_options; i++) {
      stroke(255);
      line(this.size * 0.6, 0, this.size * 0.8, 0);
      textSize(20);
      noStroke();
      push();
      let text_x = this.size * 0.8;
      if (
        option_rotation * i >= Math.PI * 0.75 &&
        option_rotation * i <= Math.PI * 1.2
      ) {
        text_x += textWidth(this.option_names[i]);
      }
      translate(text_x, 0);
      rotate(-option_rotation * i);
      if (i == 2 || i == 4) {
        translate(-textWidth(this.option_names[i]), 0);
      }
      text(this.option_names[i], 0, 0);
      pop();
      rotate(option_rotation);
    }
    pop();
  },
};

let fader = {
  x: 0,
  y: 0,
};

function setup() {
  createCanvas(window.innerWidth, window.innerHeight);
  encoder.size = height * 0.7;
  encoder.dip_size = encoder.size * 0.1;
  encoder.x = width * 0.73;
  encoder.y = height / 2;
  setting_wheel.size = height * 0.2;
  setting_wheel.x = width * 0.25;
  setting_wheel.y = height * 0.6;
}

function draw() {
  clear();
  //background(255, 5);

  encoder.draw();
  setting_wheel.draw();
}

function mousePressed() {
  console.log("touch started");
  if (abs(dist(encoder.x, encoder.y, mouseX, mouseY)) < encoder.size * 0.5) {
    console.log("pressed encoder");
    encoder.pressed = true;
    encoder.touch_angle = atan2(encoder.x - mouseX, mouseY - encoder.y);
    // prevent default
    return false;
  }
  if (
    abs(dist(setting_wheel.x, setting_wheel.y, mouseX, mouseY)) <
    setting_wheel.size * 0.5
  ) {
    console.log("pressed setting_wheel");
    setting_wheel.pressed = true;
    setting_wheel.touch_angle = atan2(
      setting_wheel.x - mouseX,
      mouseY - setting_wheel.y
    );
    // prevent default
    return false;
  }
  return true;
}
function touchStarted() {
  mousePressed();
}
function touchMoved() {
  if (encoder.pressed) {
    encoder.update_rotation(mouseX, mouseY);
    // prevent default
    return false;
  }
  if (setting_wheel.pressed) {
    setting_wheel.update_rotation(mouseX, mouseY);
    // prevent default
    return false;
  }
  fill(0, 255, 0, 100);
  noStroke();
  ellipse(mouseX, mouseY, 20, 20);
  return true;
}
function touchEnded() {
  console.log("touch ended");
  encoder.pressed = false;
  encoder.pull_rotation = 0;
  setting_wheel.pressed = false;
  setting_wheel.pull_rotation = 0;
}
function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
  encoder.size = height * 0.7;
  encoder.x = width * 0.7;
  encoder.y = height / 2;
  setting_wheel.size = height * 0.2;
  setting_wheel.x = width * 0.2;
  setting_wheel.y = height / 2;
}
