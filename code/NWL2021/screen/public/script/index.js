var socket = io("/screen");
socket.on("setup", (data) => {
  start(data);
});

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const config = {
  dotSize: { small: 4, big: 8 },
  answerSize: { small: "60px", big: "100px" },
};

let gamePage = "demo";
let demoInterval = null;
function updateGamePage(gameState) {
  if (
    gameState == null ||
    !gameState.players ||
    gameState.players.length == 0
  ) {
    gamePage = "demo";
    if (demoInterval == null) demoInterval = setInterval(runDemoEngine, 900, dummyGameState);
  } else {
    if (gamePage == "result" || gamePage == "question") {
      clearInterval(demoInterval);
      demoInterval = null;
      return;
    }
    gamePage = "play";
    clearInterval(demoInterval);
    demoInterval = null;
  }
}

function runDemoEngine(gameState) {
  for (const player of gameState.players) {
    moveDummyPlayer(player);
  }
}


socket.on("gameStateUpdate", (data) => {
  if (gameState == null) {
    drawAnswers(data.question);
    gameState = "play";
  }
  gameState = data;
  updateGamePage(gameState);
  updateGameState();
});

let timerInterval = null;
socket.on("question", ({ question, endDate }) => {
  gamePage = "question";
  updateGamePage(gameState);
  gameState.question = question;
  setTimeout(() => {
    gamePage = "play";
    updateGamePage(gameState);
    updateGameState();
  }, 4000);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const time = new Date(endDate) - new Date().getTime();
    document.querySelector(".timer").innerHTML = Math.round(time / 1000);
  }, 500);

  updateAnswer(gameState.question);
});

socket.on("answer", ({ question, answer }) => {
  gamePage = "result";
  updateGamePage(gameState);
  updateGameState();
});

const emotes = {};
const emojis = {};
socket.on("emote", ({ playerId, emoji }) => {
  emojis[playerId] = emoji;
  clearTimeout(emotes[playerId]);
  emotes[playerId] = setTimeout(() => {
    delete emotes[playerId];
    delete emojis[playerId]
  }, 1000);
});

const imgs = {};
const shadows = {};
let gameCycle = true;
let setup, gameState;

function getAngle(playerStatus) {
  switch (playerStatus) {
    case "left":
      return -Math.PI / 4;
    case "right":
      return Math.PI / 4;
    case "up" || "down" || "iddle":
      return 0;
    case "hit":
      return Math.PI;
    default:
      return 0;
  }
}

function drawDialogue(players) {
  if (!players) return;

  const scale = 1; // gameCycle ? 1 : 0.8;
  // draw players
  Object.keys(players).forEach((playerId) => {
    let player = players[playerId];
    if (imgs[player.laureate.dialogue] && player.inAnswer) {
      renderImage(
        player.x * setup.unitSize + setup.unitSize / 2,
        player.y * setup.unitSize + setup.unitSize / 2,
        setup.unitSize,
        setup.unitSize,
        0,
        scale,
        imgs[player.laureate.dialogue]
      );
    } else {
      imgs[player.laureate.dialogue] = new Image(
        setup.unitSize,
        setup.unitSize
      );
      // Load an image of intrinsic size 300x227 in CSS pixels
      imgs[player.laureate.dialogue].src = "/img/dialogue.png";
      imgs[player.laureate.dialogue].onload = function () {
        if (player.inAnswer) {
          renderImage(
            player.x * setup.unitSize + setup.unitSize / 2,
            player.y * setup.unitSize + setup.unitSize / 2,
            setup.unitSize,
            setup.unitSize,
            0,
            scale,
            imgs[player.laureate.dialogue]
          );
        }
      };
    }
  });
}

function drawPlayers(players) {
  if (!players) return;

  let scale = 1; //gameCycle ? 1 : 0.8;
  // draw players

  for (const player of players) {
    let size = setup.unitSize;

    if (imgs[player.laureate.imagePath]) {
      const angle = getAngle(player.status);
      renderImage(
        player.x * setup.unitSize + setup.unitSize / 2,
        player.y * setup.unitSize + setup.unitSize / 2,
        size,
        size,
        angle,
        scale,
        imgs[player.laureate.imagePath]
      );
    } else {
      imgs[player.laureate.imagePath] = new Image(
        setup.unitSize,
        setup.unitSize
      );
      // Load an image of intrinsic size 300x227 in CSS pixels
      imgs[
        player.laureate.imagePath
      ].src = `/img/laureates/${player.laureate.imagePath}`;

      imgs[player.laureate.imagePath].onload = function () {
        renderImage(
          player.x * setup.unitSize + setup.unitSize / 2,
          player.y * setup.unitSize + setup.unitSize / 2,
          size,
          size,
          0,
          scale,
          imgs[player.laureate.imagePath]
        );
      };
    }
    if (emotes[player.id]) drawEmoji(player);
  }
}

function drawEmoji(player) {
  const emoji = emojis[player.id];
  const angle = getAngle(player.status);
  const x = player.x * setup.unitSize + setup.unitSize / 2;
  const y = player.y * setup.unitSize + setup.unitSize / 2;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `${!gameCycle ? '70px' : '90px'} serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderImage(x, y, width, height, angle, scale = 1, image) {
  const centerX = width / 2.0;
  const centerY = height / 2.0;

  ctx.translate(x, y);

  ctx.rotate(angle);
  ctx.scale(scale, scale);
  // ctx.translate(x,y);
  ctx.drawImage(image, -centerX, -centerY, width, height);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawPlayersShadow(players) {
  if (!players) return;
  const boardState = gameCycle ? 1 : -1;
  // draw players
  Object.keys(players).forEach((playerId) => {
    let player = players[playerId];

    if (shadows[player.laureate.shadowImg]) {
      Object.keys(players).forEach((playerId) => {
        let player = players[playerId];
        let positions = player.previousPositions;
        if (positions.length == 0) return;
        for (let i = 0; i < positions.length; i++) {
          const x = positions[i].x * setup.unitSize + setup.unitSize / 2;
          const y = positions[i].y * setup.unitSize + setup.unitSize / 2;
          const widthHeight = setup.unitSize;
          const side = i % 2 == 0 ? 1 : -1;
          const angle = (Math.PI / 4) * side * boardState;
          renderImage(
            x,
            y,
            widthHeight,
            widthHeight,
            angle,
            0.8,
            shadows[player.laureate.shadowImg]
          );
        }
      });
    } else {
      shadows[player.laureate.shadowImg] = new Image(
        setup.unitSize,
        setup.unitSize
      );
      // Load an image of intrinsic size 300x227 in CSS pixels
      shadows[player.laureate.shadowImg].src = "/img/laureateShadow.png";
      shadows[player.laureate.shadowImg].onload = function () {
        Object.keys(players).forEach((playerId) => {
          let player = players[playerId];
          let positions = player.previousPositions;
          if (positions.length == 0) return;
          for (let i = 0; i < positions.length; i++) {
            const x = positions[i].x * setup.unitSize + setup.unitSize / 2;
            const y = positions[i].y * setup.unitSize + setup.unitSize / 2;
            const widthHeight = setup.unitSize;
            const side = i % 2 == 0 ? 1 : -1;
            const angle = (Math.PI / 4) * side * boardState;
            renderImage(
              x,
              y,
              widthHeight,
              widthHeight,
              angle,
              0.8,
              shadows[player.laureate.shadowImg]
            );
          }
        });
      };
    }
  });
}

function drawPreviousPosition(players) {
  if (!players) return;
  Object.keys(players).forEach((playerId) => {
    let player = players[playerId];
    let positions = player.previousPositions;
    if (positions.length == 0) return;

    //DRAW LINE PATH
    ctx.beginPath();
    ctx.lineWidth = !gameCycle ? "4" : "2";
    ctx.strokeStyle = player.laureate.color;
    ctx.moveTo(
      positions[0].x * setup.unitSize + setup.unitSize / 2,
      positions[0].y * setup.unitSize + setup.unitSize / 2
    );
    for (let i = 1; i < positions.length; i++) {
      ctx.lineTo(
        positions[i].x * setup.unitSize + setup.unitSize / 2,
        positions[i].y * setup.unitSize + setup.unitSize / 2
      );
    }
    ctx.lineTo(
      player.x * setup.unitSize + setup.unitSize / 2,
      player.y * setup.unitSize + setup.unitSize / 2
    );
    ctx.stroke();

    //DRAW PREVIOUS POSITION POINTS
    for (let i = 0; i < positions.length; i++) {
      ctx.fillStyle = player.laureate.color;
      ctx.beginPath();
      ctx.arc(
        positions[i].x * setup.unitSize + setup.unitSize / 2,
        positions[i].y * setup.unitSize + setup.unitSize / 2,
        !gameCycle ? config.dotSize.big : config.dotSize.small,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  });
}

function drawQuestion(question) {
  if (!question) return;
  const size = 2.5;
  //draw the mid point

  for (let i = 0; i < setup.questionPosition.width + 1; i++) {
    for (let j = 0; j < setup.questionPosition.height + 1; j++) {

      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineWidth = "4";
      if (i % 2 == 0) {
        if (gameCycle) {
          ctx.moveTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize / 2
            , setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j + setup.unitSize / size);
          ctx.lineTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize / 2
            , setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j +
            setup.unitSize - setup.unitSize / size
          );
        } else {
          ctx.moveTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize / size
            , setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j + setup.unitSize / 2);
          ctx.lineTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize - setup.unitSize / size,
            setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j + setup.unitSize / 2
          );
        }
      } else {
        if (gameCycle) {
          ctx.moveTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize / size
            , setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j + setup.unitSize / 2);
          ctx.lineTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize - setup.unitSize / size,
            setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j + setup.unitSize / 2
          );
        } else {
          ctx.moveTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize / 2
            , setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j + setup.unitSize / size);
          ctx.lineTo(
            setup.questionPosition.x * setup.unitSize +
            setup.unitSize * i +
            setup.unitSize / 2
            , setup.questionPosition.y * setup.unitSize +
            setup.unitSize * j +
            setup.unitSize - setup.unitSize / size
          );

        }
      }

      ctx.stroke();
      // ctx.arc(
      //   setup.questionPosition.x * setup.unitSize +
      //   setup.unitSize * i +
      //   setup.unitSize / 2,
      //   setup.questionPosition.y * setup.unitSize +
      //   setup.unitSize * j +
      //   setup.unitSize / 2,
      //   gameCycle ? config.dotSize.small : config.dotSize.big,
      //   0,
      //   2 * Math.PI
      // );
      // ctx.fill();
    }
  }
}

function updateAnswer(question) {
  if (!question) return;

  const questionE = document.querySelector(".question");
  questionE.innerHTML = question.text;
  questionE.style.top = `${setup.questionPosition.y * setup.unitSize}px`;
  questionE.style.left = `${setup.questionPosition.x * setup.unitSize}px`;
  questionE.style.width = `${(setup.questionPosition.width + 1) * setup.unitSize
    }px`;
  questionE.style.height = `${(setup.questionPosition.height + 1) * setup.unitSize
    }px`;
  questionE.style.fontSize =
    question.text.length < 10 ? config.answerSize.big : config.answerSize.small;

  for (let i = 0; i < question.answers.length; i++) {
    const answer = question.answers[i];
    const position = setup.answersPositions[i];

    const answerE = document.querySelector(".answer" + (i + 1));
    answerE.innerHTML = answer.text;

    answerE.style.top = `${position.y * setup.unitSize}px`;
    answerE.style.left = `${position.x * setup.unitSize}px`;
    answerE.style.width = `${(position.width + 1) * setup.unitSize}px`;
    answerE.style.height = `${(position.height + 1) * setup.unitSize}px`;
    answerE.style.fontSize =
      answer.text.length < 8 ? config.answerSize.big : config.answerSize.small;
  }
}

function drawAnswers(question) {
  if (!question) return;

  for (let k = 0; k < question.answers.length; k++) {
    const position = setup.answersPositions[k];

    const size = k % 2 == 0 ? gameCycle ? config.dotSize.small : config.dotSize.big : gameCycle ? config.dotSize.big : config.dotSize.small;
    //draw the mid point
    for (let i = 0; i < position.width + 1; i++) {
      for (let j = 0; j < position.height + 1; j++) {
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(
          position.x * setup.unitSize + setup.unitSize * i + setup.unitSize / 2,
          position.y * setup.unitSize + setup.unitSize * j + setup.unitSize / 2,
          size,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }
  }
}

function showAnswers(_show) {
  const answerE1 = document.querySelector(".answer1");
  const answerE2 = document.querySelector(".answer2");
  answerE1.style.display = _show ? null : "none";
  answerE2.style.display = _show ? null : "none";
}

function showResults(_show) {
  const results = document.querySelector(".result");
  results.style.display = _show ? null : "none";
}

function showQuestion(_show) {
  const results = document.querySelector(".question");
  results.style.display = _show ? null : "none";
}

function showDemo(_show) {
  const results = document.querySelector(".demo");
  results.style.display = _show ? null : "none";
}

function showTimer(_show) {
  const results = document.querySelector(".timer");
  results.style.display = _show ? null : "none";
}

function getCBoardClass() {
  return gameCycle ? "chess1" : "chess2";
}

function drawBoard() {
  const game = document.getElementById("game");
  game.classList.remove(getCBoardClass());
  game.classList.add(getCBoardClass());
}

function moveDummyPlayer(player) {
  player.previousPositions.push({ x: player.x, y: player.y });
  if (player.previousPositions.length > 4) {
    player.previousPositions.shift();
  }
  switch (player.status) {
    case "up":
      isValidPosition({ x: player.x, y: player.y - 1 }) ? player.y = player.y - 1 : player.status = "right";
      break;
    case "down":
      isValidPosition({ x: player.x, y: player.y + 1 }) ? player.y = player.y + 1 : player.status = "left";
      break;
    case "right":
      isValidPosition({ x: player.x + 1, y: player.y }) ? player.x = player.x + 1 : player.status = "down";
      break;
    case "left":
      isValidPosition({ x: player.x - 1, y: player.y }) ? player.x = player.x - 1 : player.status = "up";
      break;
    default:
      isValidPosition({ x: player.x + 1, y: player.y }) ? player.x = player.x + 1 : player.status = "down";
      break;
  }
}

function isValidPosition(position) {
  if (position.x < 0 || position.x >= setup.width) {
    return false;
  }
  if (position.y < 0 || position.y >= setup.height) {
    return false;
  }
  return true;
}

setInterval(() => {
  gameCycle = !gameCycle;
}, 1000);

window.requestAnimationFrame(gameLoop);
function gameLoop() {
  updateGameState();
  window.requestAnimationFrame(gameLoop);
}

function updateGameState() {
  if (!gameState) gameState = {};
  //clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  switch (gamePage) {
    case "demo":
      showResults(false);
      showAnswers(false);
      showQuestion(false);
      showDemo(true);
      showTimer(false);
      renderDemo();
      break;
    case "play":
      showAnswers(true);
      showDemo(false);
      showQuestion(true);
      showResults(false);
      showTimer(true);
      renderGame();
      break;
    case "question":
      showAnswers(false);
      showResults(false);
      showQuestion(true);
      showDemo(false);
      showTimer(false);
      drawQuestion(gameState.question);
      break;
    case "result":
      showAnswers(false);
      showResults(true);
      showQuestion(false);
      showDemo(false);
      showTimer(false);
      renderResult();
      break;
  }
}

const mapPlayerToHtmlImg = (p, i) => {
  const rotation = gameCycle ? (i % 2 == 0 ? 45 : -45) : i % 2 == 0 ? -45 : 45;
  return `<div class="player">
      <img style="transform: rotate(${rotation}deg);" src="${"/img/laureates/" + p.laureate.imagePath
    }" alt="${p.laureate.firstname}">
    </div>`;
};

function filterAnswer(_correct) {
  return (p) => p.inAnswer == _correct;
}

function renderResult() {
  if (gameState.question == undefined) return;
  const question = document.querySelector(".result .q");
  question.innerHTML = gameState.question.text;

  const correctPlayers = [];
  const wrongPlayers = [];

  for (let i = 0; i < gameState.question.answers.length; i++) {
    const position = setup.answersPositions[i];
    const answer = gameState.question.answers[i];
    if (!answer.isCorrect) continue;

    document.querySelector(".result .a").innerHTML = answer.text;

    for (const p of gameState.players.filter(filterAnswer(true))) {
      if (
        p.x >= position.x &&
        p.x <= position.x + position.width &&
        p.y >= position.y &&
        p.y <= position.y + position.height
      ) {
        correctPlayers.push(p);
      } else {
        wrongPlayers.push(p);
      }
    }
  }

  const correctGroup = document.querySelector(".correct");
  const wrongGroup = document.querySelector(".wrong");

  correctGroup.innerHTML = correctPlayers.map(mapPlayerToHtmlImg).join(" ");
  wrongGroup.innerHTML = wrongPlayers.map(mapPlayerToHtmlImg).join(" ");
}

function renderDemo() {
  if (!setup) return;
  drawPlayersShadow(dummyGameState.players);
  drawPreviousPosition(dummyGameState.players);
  drawPlayers(dummyGameState.players);
}

function renderGame() {
  drawPlayersShadow(gameState.players);
  drawPreviousPosition(gameState.players);
  drawAnswers(gameState.question);
  drawQuestion(gameState.question);
  drawPlayers(gameState.players);
  drawDialogue(gameState.players);
}

function start(s) {
  setup = s;
  gameState = null;

  dummyPlayer2.x = setup.width - 1;
  dummyPlayer2.y = setup.height - 1;
  //canvas initial setup
  canvas.width = setup.unitSize * setup.width;
  canvas.height = setup.unitSize * setup.height;
  document.querySelector(".board").style.width = `${canvas.width}px`;
  document.querySelector(".board").style.height = `${canvas.height}px`;
}


let dummyPlayer1 = {
  id: "78O5X5iNGlH0883fAAAE",
  inAnswer: false,
  status: "right",
  x: 0,
  y: 0,
  laureate: {
    color: "#C4FFFF",
    imagePath: "14th-Dalai Lama_.png",
  },
  previousPositions: [],
}
let dummyPlayer2 = {
  id: "78O5X5iNGlH0883fAAAE",
  inAnswer: false,
  status: "left",
  x: 0,
  y: 0,
  laureate: {
    color: "#7325F0",
    imagePath: "Elinor_Ostrom.png",
  },
  previousPositions: [],
}

let dummyGameState = {
  players: [dummyPlayer1, dummyPlayer2],
  question: {}
}