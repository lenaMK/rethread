class CaptureScene {
  webcam = null;
  canvas = null;
  name = "capture";

  constructor(canvas, cb) {
    this.canvas = canvas;
    this.cb = cb;
  }

  async init(width = 720, height = 0) {
    if (window.socket) window.socket.on("capture", this.onCapture);

    this.webcam = new Webcam(width, height);
    await this.webcam.init();

    this.onKeydown = (e) => {
      if (e.key == "r") {
        this.trigger();
      }
    };
    window.addEventListener("keydown", this.onKeydown);

    let o = `<div id="welcome">
  <div class="title">for|each</div>  
  <div class="hand-wheel">
    <img src="./img/CrankWheel.svg" />
  </div>
</div>`;
    document.getElementById("content").innerHTML = o;
    return this;
  }

  async unload() {
    clearInterval(this.triggerInterval);
    this.webcam.stop();
    if (window.socket) window.socket.removeListener("capture", this.onCapture);
    window.removeEventListener("keydown", this.onKeydown);
    return this;
  }

  onCapture = (data) => {
    this.trigger();
  };

  async trigger() {
    console.log("TRIGGER");
    clearInterval(this.triggerInterval);
    let timer = 3;
    const timerE = document.createElement("div");
    timerE.id = "timer";
    document.getElementById("content").appendChild(timerE);
    timerE.innerText = timer;
      if (window.socket) window.socket.emit("timer", timer);
    this.triggerInterval = setInterval(() => {
      timerE.innerText = --timer;
      if (window.socket) window.socket.emit("timer", timer);
      if (timer == 0) {
        document.getElementById("content").removeChild(timerE);
        clearInterval(this.triggerInterval);
        const picture = this.webcam.snap();
        loadImage(picture).then((img) => {
          if (window.socket) window.socket.emit("picture", picture);
          if (this.cb) this.cb(img);
        });
      }
    }, 1000);
  }

  async render() {
    const webcamImage = await loadImage(this.webcam.snap());
    const zoomImage = new ZoomImage(webcamImage, this.canvas);

    new ZoomImage(webcamImage, this.canvas).zoom(35).center().render({
      lines: false,
      values: false,
      subPixels: true,
      picture: false,
      clear: true,
    });

    zoomImage.zoom(1).center().render({ clear: false });
    return this;
  }
}