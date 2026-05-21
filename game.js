const WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const cells = document.querySelectorAll(".cell");
const statusEl = document.getElementById("status");
const scoreXEl = document.getElementById("score-x");
const scoreOEl = document.getElementById("score-o");
const scoreDrawEl = document.getElementById("score-draw");
const restartBtn = document.getElementById("restart");
const resetScoresBtn = document.getElementById("reset-scores");

let board = Array(9).fill(null);
let current = "X";
let gameOver = false;
let scores = { X: 0, O: 0, draw: 0 };

function loadScores() {
  try {
    const saved = JSON.parse(localStorage.getItem("xox-scores"));
    if (saved && typeof saved === "object") scores = { ...scores, ...saved };
  } catch {
    /* ignore */
  }
  renderScores();
}

function saveScores() {
  localStorage.setItem("xox-scores", JSON.stringify(scores));
}

function renderScores() {
  scoreXEl.textContent = scores.X;
  scoreOEl.textContent = scores.O;
  scoreDrawEl.textContent = scores.draw;
}

function setStatus(text, className = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (className ? " " + className : "");
}

function checkWinner() {
  for (const [a, b, c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(Boolean)) return { winner: null, line: [] };
  return null;
}

function highlightWin(line) {
  line.forEach((i) => cells[i].classList.add("win"));
}

function endGame(result) {
  gameOver = true;
  cells.forEach((cell) => (cell.disabled = true));

  if (result.winner) {
    scores[result.winner]++;
    saveScores();
    renderScores();
    highlightWin(result.line);
    setStatus(`${result.winner} wins!`, `winner-${result.winner.toLowerCase()}`);
  } else {
    scores.draw++;
    saveScores();
    renderScores();
    setStatus("It's a draw.", "draw");
  }
}

function play(index) {
  if (gameOver || board[index]) return;

  board[index] = current;
  const cell = cells[index];
  cell.textContent = current;
  cell.classList.add(current.toLowerCase());
  cell.disabled = true;

  const result = checkWinner();
  if (result) {
    endGame(result);
    return;
  }

  current = current === "X" ? "O" : "X";
  setStatus(`${current}'s turn`);
}

function newGame() {
  board = Array(9).fill(null);
  current = "X";
  gameOver = false;
  cells.forEach((cell) => {
    cell.textContent = "";
    cell.disabled = false;
    cell.className = "cell";
  });
  setStatus("X's turn");
}

function resetScores() {
  scores = { X: 0, O: 0, draw: 0 };
  saveScores();
  renderScores();
}

cells.forEach((cell) => {
  cell.addEventListener("click", () => play(Number(cell.dataset.index)));
});

restartBtn.addEventListener("click", newGame);
resetScoresBtn.addEventListener("click", resetScores);

loadScores();
newGame();
