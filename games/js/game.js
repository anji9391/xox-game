(function () {
  "use strict";

  const PLAY = 22;
  const GRID = PLAY;
  const BASE_TICK = 140;
  const MIN_TICK = 55;
  const SPEED_STEP = 5;
  const STORAGE_KEY = "snake-best";

  const FRUITS = [
    { id: "apple", color: "#e74c3c", particle: "#ff6b6b" },
    { id: "orange", color: "#f39c12", particle: "#ffb347" },
    { id: "grape", color: "#9b59b6", particle: "#c39bd3" },
    { id: "cherry", color: "#c0392b", particle: "#ff7979" },
    { id: "banana", color: "#f1c40f", particle: "#ffe066" },
    { id: "watermelon", color: "#2ecc71", particle: "#58d68d" },
  ];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const boardWrap = document.getElementById("board-wrap");
  const gameApp = document.querySelector(".game-app");
  const gameMain = document.querySelector(".game-main");
  const touchPad = document.getElementById("touch-pad");
  const scoreEl = document.getElementById("score-display");
  const bestEl = document.getElementById("best-display");
  const speedEl = document.getElementById("speed-display");
  const speedPanel = document.getElementById("speed-panel");
  const hintEl = document.getElementById("game-hint");
  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  const btnReset = document.getElementById("btn-reset");

  const FRUIT_SCALE = 0.52;

  const COLORS = {
    gridLight: "#d0eab8",
    gridDark: "#b8dc98",
    snake: "#4676e8",
    snakeDark: "#2e4a9e",
    snakeHighlight: "#6b92f0",
    eyeWhite: "#ffffff",
    eyePupil: "#1a1a2e",
  };

  let cellSize = 0;
  let boardW = 0;
  let boardH = 0;
  let playOriginX = 0;
  let playOriginY = 0;
  let playSizePx = 0;
  let mouthOpen = 0;
  let showNewRecord = false;
  let snake = [];
  let stomach = [];
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let score = 0;
  let best = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
  let speedLevel = 1;
  let tickMs = BASE_TICK;
  let lastTick = 0;
  let animProgress = 0;
  let prevSnake = [];
  let particles = [];
  let eatBursts = [];
  let screenFlash = 0;
  let wallHitFlash = 0;
  let state = "idle"; // idle | playing | paused | gameover
  let rafId = null;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playEatSound() {
    const ac = ensureAudio();
    const t = ac.currentTime;

    const master = ac.createGain();
    master.gain.setValueAtTime(0.45, t);
    master.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    master.connect(ac.destination);

    const tone = ac.createOscillator();
    const toneGain = ac.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(640, t);
    tone.frequency.exponentialRampToValueAtTime(920, t + 0.07);
    toneGain.gain.setValueAtTime(0.22, t);
    toneGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    tone.connect(toneGain);
    toneGain.connect(master);
    tone.start(t);
    tone.stop(t + 0.12);

    const pop = ac.createOscillator();
    const popGain = ac.createGain();
    pop.type = "triangle";
    pop.frequency.setValueAtTime(220, t);
    pop.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    popGain.gain.setValueAtTime(0.18, t);
    popGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);
    pop.connect(popGain);
    popGain.connect(master);
    pop.start(t);
    pop.stop(t + 0.1);

    const len = Math.floor(ac.sampleRate * 0.06);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.12));
    }
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
    noise.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(t);
  }

  function unlockAudio() {
    ensureAudio();
  }

  function playHitSound() {
    const ac = ensureAudio();
    const t = ac.currentTime;

    const master = ac.createGain();
    master.gain.setValueAtTime(0.55, t);
    master.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
    master.connect(ac.destination);

    const thud = ac.createOscillator();
    const thudGain = ac.createGain();
    thud.type = "sine";
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    thudGain.gain.setValueAtTime(0.35, t);
    thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    thud.connect(thudGain);
    thudGain.connect(master);
    thud.start(t);
    thud.stop(t + 0.18);

    const knock = ac.createOscillator();
    const knockGain = ac.createGain();
    knock.type = "triangle";
    knock.frequency.setValueAtTime(320, t);
    knock.frequency.exponentialRampToValueAtTime(90, t + 0.06);
    knockGain.gain.setValueAtTime(0.2, t);
    knockGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    knock.connect(knockGain);
    knockGain.connect(master);
    knock.start(t);
    knock.stop(t + 0.1);

    const len = Math.floor(ac.sampleRate * 0.05);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.08));
    }
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.28, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    noise.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(t);
  }

  function triggerWallHit() {
    playHitSound();
    wallHitFlash = 1;
    if (boardWrap) {
      boardWrap.classList.remove("wall-hit");
      void boardWrap.offsetWidth;
      boardWrap.classList.add("wall-hit");
    }
  }

  function cellCenter(gx, gy) {
    return {
      x: playOriginX + (gx + 0.5) * cellSize,
      y: playOriginY + (gy + 0.5) * cellSize,
    };
  }

  const touchUiMq = window.matchMedia(
    "(hover: none) and (pointer: coarse), (max-width: 768px)"
  );

  function usesTouchUi() {
    return touchUiMq.matches;
  }

  function syncTouchUiClass() {
    if (!gameMain) return;
    gameMain.classList.toggle("game-main--touch", usesTouchUi());
  }

  function getBoardDimensions() {
    const wrap = boardWrap;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      const side = Math.floor(Math.min(rect.width, rect.height));
      if (side > 0) return { w: side, h: side };
    }
    const main = gameMain || document.body;
    const mainH = main.clientHeight || window.innerHeight;
    const mainW = main.clientWidth || window.innerWidth;
    const side = Math.min(mainW, mainH) - 16;
    const size = Math.max(200, Math.floor(side));
    return { w: size, h: size };
  }

  function updatePlayLayout(w, h) {
    const minSide = Math.min(w, h);
    playSizePx = minSide;
    playOriginX = (w - playSizePx) / 2;
    playOriginY = (h - playSizePx) / 2;
    cellSize = playSizePx / PLAY;
  }

  function updateUI() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(best);
    if (speedEl) speedEl.textContent = String(speedLevel);
    if (speedPanel) speedPanel.hidden = state !== "playing" && state !== "paused";

    if (btnPlay) {
      const playLabel =
        state === "paused"
          ? "Resume"
          : state === "playing"
            ? "Playing"
            : "Play";
      btnPlay.querySelector(".btn-text").textContent = playLabel;
      btnPlay.disabled = state === "playing";
      btnPlay.setAttribute(
        "aria-label",
        state === "paused" ? "Resume game" : "Start game"
      );
    }
    if (btnPause) {
      btnPause.disabled = state !== "playing";
      btnPause.setAttribute("aria-pressed", state === "paused" ? "true" : "false");
    }
    if (btnReset) {
      btnReset.disabled = state === "idle";
    }
    if (hintEl) {
      const touch = usesTouchUi();
      const hints = touch
        ? {
            idle: "Tap Play or the board to start · Swipe or use the pad to move",
            playing: "Swipe or use the pad to move · Tap Pause to freeze",
            paused: "Tap Play to resume",
            gameover: "Tap Play or Reset to try again",
          }
        : {
            idle: "Press Play or click the board to start · Arrow keys or WASD to move",
            playing: "Arrow keys or WASD to move · Space or Pause to freeze",
            paused: "Press Play or Space to resume",
            gameover: "Press Play or Reset to try again",
          };
      hintEl.textContent = hints[state] || hints.idle;
    }
  }

  function resize() {
    syncTouchUiClass();
    const { w, h } = getBoardDimensions();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    boardW = w;
    boardH = h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updatePlayLayout(w, h);
    if (state !== "playing") draw();
  }

  let resizeRaf = 0;
  function scheduleResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resize();
    });
  }

  function randomFood() {
    const occupied = new Set(snake.map((s) => s.x + "," + s.y));
    let x, y;
    do {
      x = Math.floor(Math.random() * PLAY);
      y = Math.floor(Math.random() * PLAY);
    } while (occupied.has(x + "," + y));
    const type = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    food = { x, y, type };
  }

  function initGame() {
    const mid = Math.floor(PLAY / 2);
    snake = [
      { x: mid - 2, y: mid },
      { x: mid - 1, y: mid },
      { x: mid, y: mid },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    speedLevel = 1;
    tickMs = BASE_TICK;
    particles = [];
    eatBursts = [];
    stomach = [];
    screenFlash = 0;
    wallHitFlash = 0;
    mouthOpen = 0;
    randomFood();
    prevSnake = snake.map((s) => ({ ...s }));
    animProgress = 1;
  }

  function setDirection(dx, dy) {
    if (state !== "playing" && state !== "paused") return;
    const opposite = direction.x + dx === 0 && direction.y + dy === 0;
    if (opposite) return;
    nextDirection = { x: dx, y: dy };
  }

  function spawnParticles(x, y, color) {
    const pos = cellCenter(x, y);
    const cx = pos.x;
    const cy = pos.y;
    const particleColor = color || "#3dff9a";

    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.4;
      const speed = 4 + Math.random() * 6;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        size: 3 + Math.random() * 5,
        color: particleColor,
        gravity: 0.18,
        spin: (Math.random() - 0.5) * 0.3,
        rot: Math.random() * Math.PI * 2,
      });
    }
  }

  function triggerEatEffect(gridX, gridY, fruitType) {
    playEatSound();
    screenFlash = 1;
    mouthOpen = 1;

    const { x: cx, y: cy } = cellCenter(gridX, gridY);

    eatBursts.push({
      x: cx,
      y: cy,
      start: performance.now(),
      fruit: fruitType,
    });

    if (boardWrap) {
      boardWrap.classList.remove("eat-pulse");
      void boardWrap.offsetWidth;
      boardWrap.classList.add("eat-pulse");
    }

    spawnParticles(gridX, gridY, fruitType.particle);
  }

  function tick() {
    prevSnake = snake.map((s) => ({ ...s }));
    direction = { ...nextDirection };

    const head = {
      x: snake[snake.length - 1].x + direction.x,
      y: snake[snake.length - 1].y + direction.y,
    };

    if (head.x < 0 || head.x >= PLAY || head.y < 0 || head.y >= PLAY) {
      triggerWallHit();
      gameOver();
      return;
    }

    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        gameOver();
        return;
      }
    }

    snake.push(head);
    animProgress = 0;

    if (head.x === food.x && head.y === food.y) {
      const eaten = { ...food.type };
      score++;
      stomach.push(eaten);
      triggerEatEffect(food.x, food.y, eaten);

      if (score % SPEED_STEP === 0 && tickMs > MIN_TICK) {
        speedLevel++;
        tickMs = Math.max(MIN_TICK, BASE_TICK - (speedLevel - 1) * 12);
      }
      updateUI();

      randomFood();
    } else {
      snake.shift();
      if (stomach.length) stomach.shift();
    }
  }

  function gameOver() {
    state = "gameover";
    showNewRecord = false;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, String(best));
      showNewRecord = true;
    }
    updateUI();
  }

  function startGame() {
    unlockAudio();
    initGame();
    state = "playing";
    showNewRecord = false;
    lastTick = performance.now();
    updateUI();
    if (!rafId) loop(performance.now());
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    updateUI();
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    lastTick = performance.now();
    updateUI();
  }

  function togglePause() {
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
  }

  function resetGame() {
    unlockAudio();
    initGame();
    state = "idle";
    showNewRecord = false;
    animProgress = 1;
    updateUI();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function updateMouth() {
    if (!snake.length) return;
    const head = snake[snake.length - 1];
    const dist =
      Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
    const facingFood =
      (direction.x === 1 && food.x > head.x && food.y === head.y) ||
      (direction.x === -1 && food.x < head.x && food.y === head.y) ||
      (direction.y === 1 && food.y > head.y && food.x === head.x) ||
      (direction.y === -1 && food.y < head.y && food.x === head.x);
    const nearFood = dist === 1 && facingFood;
    const eating = eatBursts.some(
      (b) => performance.now() - b.start < 400
    );
    const target = nearFood || eating ? 1 : 0;
    mouthOpen += (target - mouthOpen) * 0.28;
  }

  function getSnakePixels(t) {
    const len = snake.length;
    const grew = prevSnake.length > 0 && len === prevSnake.length + 1;
    const points = [];

    for (let i = 0; i < len; i++) {
      const curr = snake[i];
      let gx, gy;

      if (animProgress < 1 && i === len - 1 && prevSnake.length) {
        const prev = prevSnake[prevSnake.length - 1];
        gx = lerp(prev.x + direction.x, curr.x, t);
        gy = lerp(prev.y + direction.y, curr.y, t);
      } else if (animProgress < 1 && !grew && prevSnake[i + 1]) {
        gx = lerp(prevSnake[i + 1].x, curr.x, t);
        gy = lerp(prevSnake[i + 1].y, curr.y, t);
      } else if (animProgress < 1 && grew && prevSnake[i]) {
        gx = lerp(prevSnake[i].x, curr.x, t);
        gy = lerp(prevSnake[i].y, curr.y, t);
      } else {
        gx = curr.x;
        gy = curr.y;
      }

      const c = cellCenter(gx, gy);
      points.push({ x: c.x, y: c.y });
    }
    return points;
  }

  function drawBoard() {
    for (let y = 0; y < PLAY; y++) {
      for (let x = 0; x < PLAY; x++) {
        const even = (x + y) % 2 === 0;
        const cx = playOriginX + x * cellSize;
        const cy = playOriginY + y * cellSize;
        const sz = cellSize + 0.5;
        const grad = ctx.createLinearGradient(cx, cy, cx + sz, cy + sz);
        if (even) {
          grad.addColorStop(0, "#deefc4");
          grad.addColorStop(1, COLORS.gridLight);
        } else {
          grad.addColorStop(0, COLORS.gridDark);
          grad.addColorStop(1, "#a8d078");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(cx, cy, sz, sz);
      }
    }
  }

  function drawPlayGreenTint() {
    const px = playOriginX;
    const py = playOriginY;
    const pw = playSizePx;
    const ph = playSizePx;
    const cx = px + pw / 2;
    const cy = py + ph / 2;
    const tint = ctx.createRadialGradient(cx, cy, 0, cx, cy, pw * 0.7);
    tint.addColorStop(0, "rgba(150, 230, 100, 0.14)");
    tint.addColorStop(0.6, "rgba(120, 200, 80, 0.08)");
    tint.addColorStop(1, "rgba(90, 170, 60, 0.02)");
    ctx.fillStyle = tint;
    ctx.fillRect(px, py, pw, ph);
  }

  function drawCenterMessage(title, subtitle) {
    const cx = boardW / 2;
    const cy = boardH / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, boardW, boardH);

    const titleSize = Math.max(22, cellSize * 0.9);
    const subSize = Math.max(14, cellSize * 0.45);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${titleSize}px Outfit, sans-serif`;
    ctx.fillText(title, cx, cy - subSize);
    if (subtitle) {
      ctx.font = `500 ${subSize}px Outfit, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText(subtitle, cx, cy + titleSize * 0.45);
    }
    ctx.restore();
  }

  function drawStomachFruit(cx, cy, fruit) {
    const r = cellSize * 0.2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, fruit.particle || fruit.color);
    grad.addColorStop(1, fruit.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `bold ${Math.max(8, r * 1.1)}px Outfit, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icons = {
      apple: "🍎",
      orange: "🍊",
      grape: "🍇",
      cherry: "🍒",
      banana: "🍌",
      watermelon: "🍉",
    };
    ctx.fillText(icons[fruit.id] || "●", cx, cy + 1);
    ctx.restore();
  }

  function drawStomach(points) {
    const bodyEnd = points.length - 1;
    const n = stomach.length;
    if (!n || bodyEnd < 1) return;

    const startSeg = Math.max(0, bodyEnd - n);
    for (let j = 0; j < n; j++) {
      const segIdx = startSeg + j;
      if (segIdx < bodyEnd) {
        drawStomachFruit(points[segIdx].x, points[segIdx].y, stomach[j]);
      }
    }
  }

  function drawDropShadow(cx, cy, rx, ry) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + cellSize * 0.08, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSnakeBody(points) {
    if (points.length < 1) return;
    if (points.length === 1) {
      const width = cellSize * 0.82;
      ctx.save();
      ctx.fillStyle = COLORS.snake;
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const width = cellSize * 0.82;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    const grad = ctx.createLinearGradient(
      points[0].x,
      points[0].y,
      points[points.length - 1].x,
      points[points.length - 1].y
    );
    grad.addColorStop(0, COLORS.snakeHighlight);
    grad.addColorStop(1, COLORS.snake);

    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const mx = (curr.x + next.x) * 0.5;
        const my = (curr.y + next.y) * 0.5;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSnakeHead(cx, cy, dir, open) {
    const r = cellSize * 0.44;
    const angle = Math.atan2(dir.y, dir.x);
    const munching = eatBursts.some(
      (b) => performance.now() - b.start < 250
    );
    const munch = munching
      ? Math.sin((performance.now() % 120) / 120 * Math.PI * 2) * 0.08
      : 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + munch, 1 - munch * 0.5);
    ctx.rotate(angle);

    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    const headGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    headGrad.addColorStop(0, COLORS.snakeHighlight);
    headGrad.addColorStop(1, COLORS.snake);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const eyeY = -r * 0.18;
    const eyeX = r * 0.22;
    const eyeR = r * 0.22;
    const pupilR = r * 0.11;

    [-1, 1].forEach((side) => {
      ctx.fillStyle = COLORS.eyeWhite;
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.eyePupil;
      ctx.beginPath();
      ctx.arc(side * eyeX + r * 0.06, eyeY, pupilR, 0, Math.PI * 2);
      ctx.fill();
    });

    const mouthR = r * (0.42 + open * 0.28);
    ctx.fillStyle = COLORS.snakeDark;
    ctx.beginPath();
    ctx.moveTo(r * 0.15, 0);
    ctx.arc(r * 0.2, 0, mouthR, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawFruit(cx, cy, size, fruit, pulse) {
    const s = size * pulse;
    const id = fruit.id;

    drawDropShadow(cx, cy + s * 0.15, s * 0.75, s * 0.2);

    ctx.save();
    ctx.translate(cx, cy);

    if (id === "apple") {
      const grad = ctx.createRadialGradient(-s * 0.2, -s * 0.25, 0, 0, 0, s);
      grad.addColorStop(0, "#ff5252");
      grad.addColorStop(0.7, "#e53935");
      grad.addColorStop(1, "#c62828");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#66bb6a";
      ctx.beginPath();
      ctx.ellipse(s * 0.15, -s * 0.82, s * 0.4, s * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#6d4c41";
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.6);
      ctx.quadraticCurveTo(s * 0.15, -s * 0.95, s * 0.1, -s * 1.1);
      ctx.stroke();
    } else if (id === "orange") {
      const grad = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s);
      grad.addColorStop(0, "#ffb347");
      grad.addColorStop(1, "#e67e22");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(211, 84, 0, 0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos((i / 8) * Math.PI * 2) * s * 0.7, Math.sin((i / 8) * Math.PI * 2) * s * 0.7);
        ctx.stroke();
      }
      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.95, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === "grape") {
      const dots = [
        [0, -s * 0.35],
        [-s * 0.35, 0],
        [s * 0.35, 0],
        [-s * 0.55, s * 0.45],
        [0, s * 0.45],
        [s * 0.55, s * 0.45],
      ];
      dots.forEach(([dx, dy], i) => {
        const grad = ctx.createRadialGradient(dx - 2, dy - 2, 0, dx, dy, s * 0.38);
        grad.addColorStop(0, "#bb8fce");
        grad.addColorStop(1, "#7d3c98");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(dx, dy, s * 0.36, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = "#27ae60";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.75);
      ctx.lineTo(0, -s * 1.05);
      ctx.stroke();
    } else if (id === "cherry") {
      ctx.strokeStyle = "#5d4037";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 0.9);
      ctx.quadraticCurveTo(0, -s * 1.15, s * 0.35, -s * 0.9);
      ctx.stroke();
      [-s * 0.38, s * 0.38].forEach((ox) => {
        const grad = ctx.createRadialGradient(ox - 2, s * 0.1, 0, ox, s * 0.15, s * 0.42);
        grad.addColorStop(0, "#ff6b6b");
        grad.addColorStop(1, "#922b21");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, s * 0.15, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (id === "banana") {
      ctx.rotate(-0.35);
      const grad = ctx.createLinearGradient(-s, 0, s, 0);
      grad.addColorStop(0, "#f9e79f");
      grad.addColorStop(0.5, "#f4d03f");
      grad.addColorStop(1, "#d4ac0d");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, s * 0.15);
      ctx.quadraticCurveTo(0, -s * 0.95, s * 0.85, s * 0.05);
      ctx.quadraticCurveTo(0, s * 0.75, -s * 0.75, s * 0.15);
      ctx.fill();
      ctx.strokeStyle = "rgba(180, 140, 20, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (id === "watermelon") {
      ctx.fillStyle = "#27ae60";
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.95, s * 0.5, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2ecc71";
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a252f";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * s * 0.35, s * 0.05 + Math.sin(a) * s * 0.35, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawEatEffects(now) {
    const fruitDrawSize = cellSize * FRUIT_SCALE;

    for (let i = eatBursts.length - 1; i >= 0; i--) {
      const b = eatBursts[i];
      const elapsed = now - b.start;
      const dur = 520;
      if (elapsed > dur) {
        eatBursts.splice(i, 1);
        continue;
      }

      const p = elapsed / dur;
      const color = b.fruit.color;

      for (let r = 0; r < 3; r++) {
        const ringP = Math.max(0, (p - r * 0.08) / 0.85);
        const radius = cellSize * (0.25 + ringP * 1.4);
        ctx.globalAlpha = (1 - ringP) * 0.55;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 - r * 0.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const popIn = Math.min(1, p / 0.25);
      const popOut = p > 0.25 ? 1 - (p - 0.25) / 0.75 : 1;
      const scale = popIn * (1.4 + popIn * 0.6) * popOut;
      ctx.globalAlpha = popOut * 0.9;
      drawFruit(b.x, b.y, fruitDrawSize * scale, b.fruit, 1);
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.font = `700 ${Math.round(14 + popIn * 10)}px Outfit, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.snake;
      ctx.shadowColor = "rgba(70,118,232,0.5)";
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 1 - p * 0.85;
      ctx.fillText("+1", b.x, b.y - 18 - p * 28);
      ctx.restore();
    }
  }

  function draw() {
    const now = performance.now();
    const dpr = window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1;
    const w = boardW || canvas.width / dpr;
    const h = boardH || canvas.height / dpr;

    updateMouth();
    ctx.clearRect(0, 0, w, h);
    drawBoard();
    drawPlayGreenTint();

    const t = easeInOutCubic(animProgress);
    const points = getSnakePixels(t);

    const pulse = 0.96 + 0.04 * Math.sin(now / 400);
    const bob = Math.sin(now / 550) * cellSize * 0.03;
    const fruitPos = cellCenter(food.x, food.y);
    const fx = fruitPos.x;
    const fy = fruitPos.y + bob;
    const fruitSize = cellSize * FRUIT_SCALE;

    if (food.type) {
      drawFruit(fx, fy, fruitSize, food.type, pulse);
    }

    if (points.length >= 1) {
      drawSnakeBody(points);
      drawStomach(points);
      const head = points[points.length - 1];
      drawSnakeHead(head.x, head.y, direction, mouthOpen);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.vx *= 0.98;
      p.life -= 0.028;
      if (p.rot !== undefined) p.rot += p.spin || 0;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color || "#3dff9a";
      ctx.translate(p.x, p.y);
      if (p.rot !== undefined) ctx.rotate(p.rot);
      const sz = p.size * p.life;
      if (i % 3 === 0) {
        ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    drawEatEffects(now);

    if (screenFlash > 0) {
      screenFlash = Math.max(0, screenFlash - 0.08);
      ctx.fillStyle = `rgba(255, 255, 255, ${screenFlash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (wallHitFlash > 0) {
      wallHitFlash = Math.max(0, wallHitFlash - 0.1);
      ctx.fillStyle = `rgba(180, 60, 50, ${wallHitFlash * 0.28})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (state === "idle") {
      drawCenterMessage("Snake", "Press Play or tap the board");
    } else if (state === "paused") {
      drawCenterMessage("Paused", "Press Play or Space to resume");
    } else if (state === "gameover") {
      const sub = showNewRecord
        ? `New record! · Press Play to retry`
        : `Press Play or Reset to try again`;
      drawCenterMessage("Game Over", sub);
    }
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    if (state === "playing") {
      if (now - lastTick >= tickMs) {
        tick();
        lastTick = now;
      }
      const elapsed = now - lastTick;
      animProgress = Math.min(1, elapsed / tickMs);
    } else if (state === "paused" || state === "gameover") {
      animProgress = 1;
    }

    draw();
  }

  // Input
  const keyMap = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    w: [0, -1],
    s: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    W: [0, -1],
    S: [0, 1],
    A: [-1, 0],
    D: [1, 0],
  };

  document.addEventListener("keydown", (e) => {
    if (keyMap[e.key]) {
      e.preventDefault();
      const [dx, dy] = keyMap[e.key];
      setDirection(dx, dy);
    }
    if (e.key === " " || e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (state === "idle") startGame();
      else togglePause();
    }
    if (e.key === "Enter" && state === "idle") startGame();
  });

  canvas.addEventListener("click", () => {
    if (state === "idle" || state === "gameover") startGame();
    else if (state === "paused") resumeGame();
  });

  if (btnPlay) {
    btnPlay.addEventListener("click", () => {
      if (state === "idle" || state === "gameover") startGame();
      else if (state === "paused") resumeGame();
    });
  }
  if (btnPause) {
    btnPause.addEventListener("click", () => {
      if (state === "playing") pauseGame();
    });
  }
  if (btnReset) {
    btnReset.addEventListener("click", resetGame);
  }

  // Swipe
  let touchStart = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (state === "idle" || state === "gameover") {
        startGame();
        return;
      }
      if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      if (!touchStart || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = Math.max(20, Math.min(40, cellSize * 0.85));
      if (Math.max(absX, absY) < threshold) return;
      if (absX > absY) setDirection(dx > 0 ? 1 : -1, 0);
      else setDirection(0, dy > 0 ? 1 : -1);
      touchStart = null;
    },
    { passive: true }
  );

  if (touchPad) {
    touchPad.querySelectorAll(".pad-btn").forEach((btn) => {
      const dx = parseInt(btn.dataset.dx, 10);
      const dy = parseInt(btn.dataset.dy, 10);
      const press = (e) => {
        e.preventDefault();
        unlockAudio();
        if (state === "idle" || state === "gameover") startGame();
        setDirection(dx, dy);
      };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("click", (e) => e.preventDefault());
    });
  }

  ["click", "keydown", "touchstart"].forEach((ev) => {
    document.addEventListener(ev, unlockAudio, { passive: true });
  });

  if (touchUiMq.addEventListener) {
    touchUiMq.addEventListener("change", () => {
      scheduleResize();
      updateUI();
    });
  } else if (touchUiMq.addListener) {
    touchUiMq.addListener(() => {
      scheduleResize();
      updateUI();
    });
  }

  window.addEventListener("resize", scheduleResize);
  window.addEventListener("orientationchange", scheduleResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleResize);
    window.visualViewport.addEventListener("scroll", scheduleResize);
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(scheduleResize);
    if (gameApp) ro.observe(gameApp);
    if (gameMain) ro.observe(gameMain);
    if (boardWrap) ro.observe(boardWrap);
  }
  syncTouchUiClass();
  resize();
  requestAnimationFrame(resize);
  initGame();
  state = "idle";
  updateUI();
  loop(performance.now());
})();
