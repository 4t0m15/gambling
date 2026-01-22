const balanceEl = document.getElementById("balance");
const deltaEl = document.getElementById("delta");
const outcomeEl = document.getElementById("outcome");
const spinButton = document.getElementById("spin-button");
const betInput = document.getElementById("bet-input");
const creditButton = document.getElementById("credit-button");
const slotsGrid = document.getElementById("slots-grid");
const slotsPanel = document.querySelector(".slots-panel");
const flashOverlay = document.getElementById("flash-overlay");
const confettiCanvas = document.getElementById("confetti-canvas");
const ctx = confettiCanvas.getContext("2d");

const SYMBOL_CLASSES = ["circle", "square", "triangle"];
const COLS = 12;
const ROWS = 8;
const TOTAL_SLOTS = COLS * ROWS;

const SPIN_CYCLE_INTERVAL = 55;
const COLUMN_STOP_BASE_DELAY = 200;
const COLUMN_STOP_INCREMENT = 100;

let balance = 1000;
let isSpinning = false;
let spinIntervals = [];
let slotCards = [];
let slotEls = [];

// Particles
let particles = [];
let animationId = null;

function resizeCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

class ShapeParticle {
  constructor(fromLeft) {
    this.x = fromLeft ? -20 : confettiCanvas.width + 20;
    this.y = Math.random() * confettiCanvas.height;
    this.size = Math.random() * 8 + 4;
    this.speedX = (fromLeft ? 1 : -1) * (Math.random() * 10 + 5);
    this.speedY = Math.random() * 4 - 2;
    this.hue = Math.random() * 60 + 30;
    this.life = 1;
    this.decay = 0.025;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.life -= this.decay;
    this.speedX *= 0.98;
  }

  draw() {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = `hsl(${this.hue}, 100%, 50%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isDead() { return this.life <= 0; }
}

function spawnParticles(amount) {
  for (let i = 0; i < amount / 2; i++) {
    particles.push(new ShapeParticle(true));
    particles.push(new ShapeParticle(false));
  }
  if (!animationId) animateParticles();
}

function animateParticles() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  particles = particles.filter(p => !p.isDead());
  for (const p of particles) { p.update(); p.draw(); }
  animationId = particles.length > 0 ? requestAnimationFrame(animateParticles) : null;
}

function createGrid() {
  slotsGrid.innerHTML = "";
  slotCards = [];
  slotEls = [];

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const card = document.createElement("div");
    card.className = "slot-card";

    const symbol = document.createElement("div");
    symbol.className = "symbol circle";

    card.appendChild(symbol);
    slotsGrid.appendChild(card);

    slotCards.push(card);
    slotEls.push(symbol);
  }

  spinIntervals = new Array(TOTAL_SLOTS).fill(null);
}

function formatMoney(amount) {
  return `$${amount.toLocaleString()}`;
}

function setDelta(delta) {
  deltaEl.textContent = delta === 0 ? "$0" : `${delta > 0 ? "+" : ""}${formatMoney(delta)}`;
  deltaEl.classList.toggle("is-positive", delta > 0);
}

function setSymbol(idx, symIdx) {
  slotEls[idx].className = `symbol ${SYMBOL_CLASSES[symIdx]}`;
}

function clearEffects() {
  slotCards.forEach(c => c.classList.remove("is-winner", "is-jackpot-winner"));
  slotsPanel.classList.remove("is-winning", "is-jackpot");
  outcomeEl.classList.remove("is-winning", "is-jackpot");
  flashOverlay.classList.remove("is-flashing", "is-jackpot-flashing");
}

function highlightWinners(cells, isJackpot) {
  const cls = isJackpot ? "is-jackpot-winner" : "is-winner";
  cells.forEach(i => slotCards[i].classList.add(cls));
}

function triggerEffects(outcome, cells, lines) {
  const isJackpot = outcome === "WIN_JACKPOT";
  const isWin = outcome !== "LOSE";

  if (isWin) {
    slotsPanel.classList.add(isJackpot ? "is-jackpot" : "is-winning");
    outcomeEl.classList.add(isJackpot ? "is-jackpot" : "is-winning");
    highlightWinners(cells, isJackpot);
    flashOverlay.classList.add(isJackpot ? "is-jackpot-flashing" : "is-flashing");
    spawnParticles(isJackpot ? 40 : Math.min(lines * 5, 25));

    setTimeout(() => {
      slotsPanel.classList.remove("is-winning", "is-jackpot");
      flashOverlay.classList.remove("is-flashing", "is-jackpot-flashing");
    }, isJackpot ? 500 : 350);
  }
}

function setOutcome(outcome, lines) {
  if (outcome === "LOSE") {
    outcomeEl.textContent = "TRY AGAIN";
  } else if (outcome === "WIN_JACKPOT") {
    outcomeEl.textContent = `🔥 MEGA WIN! 🔥\n${lines} LINES`;
  } else if (outcome === "WIN_SMALL") {
    outcomeEl.textContent = `${lines} LINE${lines > 1 ? "S" : ""}`;
  } else {
    outcomeEl.textContent = `WIN!\n${lines} LINES`;
  }
}

function getBet() {
  const v = parseInt(betInput.value, 10);
  return isNaN(v) || v <= 0 ? 1 : v;
}

function refreshState() {
  const bet = getBet();
  spinButton.disabled = isSpinning || balance < bet;
  if (!isSpinning && balance < bet) outcomeEl.textContent = "ADD CREDITS";
}

function getColIndices(col) {
  const arr = [];
  for (let row = 0; row < ROWS; row++) arr.push(row * COLS + col);
  return arr;
}

function startSpin(idx) {
  let sym = 0;
  slotCards[idx].classList.add("is-spinning");
  slotCards[idx].classList.remove("is-landing", "is-winner", "is-jackpot-winner");
  spinIntervals[idx] = setInterval(() => {
    sym = (sym + 1) % SYMBOL_CLASSES.length;
    setSymbol(idx, sym);
  }, SPIN_CYCLE_INTERVAL);
}

function stopSpin(idx, finalSym) {
  if (spinIntervals[idx]) {
    clearInterval(spinIntervals[idx]);
    spinIntervals[idx] = null;
  }
  slotCards[idx].classList.remove("is-spinning");
  slotCards[idx].classList.add("is-landing");
  setSymbol(idx, finalSym);
  setTimeout(() => slotCards[idx].classList.remove("is-landing"), 150);
}

function stopCol(col, symbols) {
  getColIndices(col).forEach(i => stopSpin(i, symbols[i]));
}

function startAnimation() {
  isSpinning = true;
  spinButton.classList.add("is-spinning");
  spinButton.disabled = true;
  spinButton.textContent = "...";
  outcomeEl.textContent = "";
  clearEffects();
  for (let i = 0; i < TOTAL_SLOTS; i++) startSpin(i);
}

function setup() {
  createGrid();
  spinButton.textContent = "SPIN";
  balanceEl.textContent = formatMoney(balance);
  setDelta(0);
  refreshState();

  betInput.addEventListener("input", refreshState);
  creditButton.addEventListener("click", () => {
    balance += 500;
    balanceEl.textContent = formatMoney(balance);
    refreshState();
  });

  spinButton.addEventListener("click", () => {
    if (isSpinning) return;
    const bet = getBet();
    if (balance < bet) return;

    const result = spin(balance, bet);
    startAnimation();

    for (let col = 0; col < COLS; col++) {
      setTimeout(() => {
        stopCol(col, result.symbols);
        if (col === COLS - 1) {
          setTimeout(() => {
            spinButton.classList.remove("is-spinning");
            spinButton.textContent = "SPIN";
            isSpinning = false;
            balance = result.balance;
            balanceEl.textContent = formatMoney(balance);
            setDelta(result.delta);
            setOutcome(result.outcome, result.lines_won);
            triggerEffects(result.outcome, result.winning_cells, result.lines_won);
            refreshState();
          }, 200);
        }
      }, COLUMN_STOP_BASE_DELAY + col * COLUMN_STOP_INCREMENT);
    }
  });
}

setup();

function findWins(symbols) {
  let mult = 0;
  const cells = [];
  let lines = 0;

  for (let row = 0; row < ROWS; row++) {
    const start = row * COLS;
    let col = 0;
    while (col < COLS) {
      const sym = symbols[start + col];
      let run = 1;
      while (col + run < COLS && symbols[start + col + run] === sym) run++;

      if (run >= 3) {
        const m = { 3: 0.3, 4: 0.8, 5: 1.5, 6: 3, 7: 6, 8: 12, 9: 25, 10: 50, 11: 75, 12: 150 };
        mult += m[run] || 0;
        lines++;
        for (let i = 0; i < run; i++) cells.push(start + col + i);
      }
      col += run;
    }
  }

  return { mult, cells, lines };
}

function spin(bal, bet) {
  const symbols = Array.from({ length: TOTAL_SLOTS }, () => Math.floor(Math.random() * SYMBOL_CLASSES.length));
  const { mult, cells, lines } = findWins(symbols);
  const win = Math.floor(bet * mult);
  const delta = win - bet;

  let outcome = "LOSE";
  if (lines > 0) {
    outcome = mult >= 20 ? "WIN_JACKPOT" : mult >= 4 ? "WIN" : "WIN_SMALL";
  }

  return {
    symbols,
    delta,
    balance: Math.max(0, bal + delta),
    outcome,
    winning_cells: cells,
    lines_won: lines,
  };
}
