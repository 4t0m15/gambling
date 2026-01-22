const balanceEl = document.getElementById("balance");
const deltaEl = document.getElementById("delta");
const outcomeEl = document.getElementById("outcome");
const spinButton = document.getElementById("spin-button");
const betInput = document.getElementById("bet-input");
const creditButton = document.getElementById("credit-button");
const slotCards = Array.from(document.querySelectorAll(".slot-card"));
const slotEls = Array.from(document.querySelectorAll("[data-slot]"));

const SYMBOL_CLASSES = ["circle", "square", "triangle"];

// Timing for sequential reel stops
const SPIN_CYCLE_INTERVAL = 60; // ms between symbol changes
const REEL_STOP_DELAYS = [800, 1400, 2000]; // when each reel stops (ms)

let balance = 999;
let spinFn = null;
let isSpinning = false;
let spinIntervals = [null, null, null];

function formatMoney(amount) {
  return `$${amount}`;
}

function setDelta(delta) {
  const sign = delta >= 0 ? "+" : "-";
  deltaEl.textContent = `${sign}${formatMoney(Math.abs(delta))}`;
  deltaEl.classList.toggle("is-positive", delta > 0);
}

function setSymbolForSlot(slotIndex, symbolIndex) {
  const slot = slotEls[slotIndex];
  SYMBOL_CLASSES.forEach((cls) => slot.classList.remove(cls));
  slot.classList.add(SYMBOL_CLASSES[symbolIndex]);
}

function setSymbols(symbols) {
  slotEls.forEach((slot, index) => {
    SYMBOL_CLASSES.forEach((cls) => slot.classList.remove(cls));
    slot.classList.add(SYMBOL_CLASSES[symbols[index]]);
  });
}

function setOutcome(outcome) {
  if (outcome === "LOSE") {
    outcomeEl.textContent = "LOSE";
  } else if (outcome === "WIN_JACKPOT") {
    outcomeEl.textContent = "JACKPOT!";
  } else if (outcome === "WIN_SMALL") {
    outcomeEl.textContent = "PUSH";
  } else {
    outcomeEl.textContent = "WIN";
  }
}

function getBet() {
  const value = Number.parseInt(betInput.value, 10);
  if (Number.isNaN(value) || value <= 0) {
    return 1;
  }
  return value;
}

function refreshSpinState() {
  const bet = getBet();
  spinButton.disabled = isSpinning || balance < bet;
  if (!isSpinning && balance < bet) {
    outcomeEl.textContent = "NO FUNDS";
  }
}

// Start rapid symbol cycling for a single reel
function startReelSpin(reelIndex) {
  let currentSymbol = 0;
  slotCards[reelIndex].classList.add("is-spinning");
  slotCards[reelIndex].classList.remove("is-landing");

  spinIntervals[reelIndex] = setInterval(() => {
    currentSymbol = (currentSymbol + 1) % 3;
    setSymbolForSlot(reelIndex, currentSymbol);
  }, SPIN_CYCLE_INTERVAL);
}

// Stop a reel and land on final symbol
function stopReelSpin(reelIndex, finalSymbol) {
  if (spinIntervals[reelIndex]) {
    clearInterval(spinIntervals[reelIndex]);
    spinIntervals[reelIndex] = null;
  }

  slotCards[reelIndex].classList.remove("is-spinning");
  slotCards[reelIndex].classList.add("is-landing");
  setSymbolForSlot(reelIndex, finalSymbol);

  // Remove landing class after animation
  setTimeout(() => {
    slotCards[reelIndex].classList.remove("is-landing");
  }, 300);
}

function startSpinAnimation() {
  isSpinning = true;
  spinButton.classList.add("is-spinning");
  spinButton.disabled = true;
  outcomeEl.textContent = "...";

  // Start all reels spinning
  for (let i = 0; i < 3; i++) {
    startReelSpin(i);
  }
}

function stopAllReels() {
  for (let i = 0; i < 3; i++) {
    if (spinIntervals[i]) {
      clearInterval(spinIntervals[i]);
      spinIntervals[i] = null;
    }
    slotCards[i].classList.remove("is-spinning", "is-landing");
  }
  spinButton.classList.remove("is-spinning");
  isSpinning = false;
}

async function setup() {
  try {
    const wasm = await import("./pkg/gambling.js");
    await wasm.default();
    spinFn = wasm.spin;
  } catch (error) {
    spinFn = null;
    console.warn("WASM not loaded, falling back to JS spin.", error);
  }
  balanceEl.textContent = formatMoney(balance);
  setDelta(-getBet());
  setOutcome("LOSE");
  refreshSpinState();

  betInput.addEventListener("input", refreshSpinState);
  creditButton.addEventListener("click", () => {
    balance += 100;
    balanceEl.textContent = formatMoney(balance);
    refreshSpinState();
  });

  spinButton.addEventListener("click", () => {
    if (isSpinning) return;

    const bet = getBet();
    if (balance < bet) return;

    // Get result immediately
    const result = spinFn ? spinFn(balance, bet) : spinFallback(balance, bet);
    const { symbols, delta, balance: nextBalance, outcome } = result;

    // Start all reels spinning
    startSpinAnimation();

    // Stop each reel one by one
    REEL_STOP_DELAYS.forEach((delay, reelIndex) => {
      setTimeout(() => {
        stopReelSpin(reelIndex, symbols[reelIndex]);

        // After last reel stops, update game state
        if (reelIndex === 2) {
          setTimeout(() => {
            spinButton.classList.remove("is-spinning");
            isSpinning = false;

            balance = nextBalance;
            balanceEl.textContent = formatMoney(balance);
            setDelta(delta);
            setOutcome(outcome);
            refreshSpinState();
          }, 350);
        }
      }, delay);
    });
  });
}

setup();

/**
 * JS fallback with realistic ~96% RTP
 * - Jackpot (2%): 3 matching, pays 12x
 * - Big Win (10%): 2 matching, pays 2x
 * - Small Win (20%): 2 matching, pays 1x
 * - Lose (68%): no match
 */
function spinFallback(balanceValue, bet) {
  const roll = Math.floor(Math.random() * 100);

  let symbols, delta, outcome;

  if (roll < 2) {
    // Jackpot
    const sym = Math.floor(Math.random() * 3);
    symbols = [sym, sym, sym];
    delta = bet * 12;
    outcome = "WIN_JACKPOT";
  } else if (roll < 12) {
    // Big win
    symbols = generateTwoMatch();
    delta = bet * 2;
    outcome = "WIN";
  } else if (roll < 32) {
    // Small win (break even)
    symbols = generateTwoMatch();
    delta = bet;
    outcome = "WIN_SMALL";
  } else {
    // Lose
    symbols = generateAllDifferent();
    delta = -bet;
    outcome = "LOSE";
  }

  return {
    symbols,
    delta,
    balance: Math.max(0, balanceValue + delta),
    outcome,
  };
}

function generateTwoMatch() {
  const matching = Math.floor(Math.random() * 3);
  const different = (matching + 1 + Math.floor(Math.random() * 2)) % 3;
  const pos = Math.floor(Math.random() * 3);

  if (pos === 0) return [different, matching, matching];
  if (pos === 1) return [matching, different, matching];
  return [matching, matching, different];
}

function generateAllDifferent() {
  const first = Math.floor(Math.random() * 3);
  const second = (first + 1) % 3;
  const third = (first + 2) % 3;

  const orders = [
    [first, second, third],
    [first, third, second],
    [second, first, third],
    [second, third, first],
    [third, first, second],
    [third, second, first],
  ];

  return orders[Math.floor(Math.random() * 6)];
}
