use js_sys::Math;
use serde::Serialize;
use wasm_bindgen::prelude::*;

const GRID_SIZE: usize = 10;
const TOTAL_SLOTS: usize = GRID_SIZE * GRID_SIZE;

/// Line-based slot machine with realistic payouts
/// Wins when 3+ consecutive matching symbols appear in a row

#[derive(Serialize)]
struct SpinResult {
    symbols: Vec<u8>,
    delta: i32,
    balance: i32,
    outcome: String,
    winning_cells: Vec<usize>,
    lines_won: u32,
}

fn random_symbol() -> u8 {
    (Math::random() * 3.0).floor() as u8
}

fn generate_random() -> Vec<u8> {
    (0..TOTAL_SLOTS).map(|_| random_symbol()).collect()
}

/// Find all winning lines and return (total_multiplier, winning_cell_indices, lines_count)
fn find_winning_lines(symbols: &[u8]) -> (f64, Vec<usize>, u32) {
    let mut total_multiplier = 0.0;
    let mut winning_cells: Vec<usize> = Vec::new();
    let mut lines_won = 0u32;

    // Check each row for horizontal matches
    for row in 0..GRID_SIZE {
        let row_start = row * GRID_SIZE;
        let mut col = 0;

        while col < GRID_SIZE {
            let current_sym = symbols[row_start + col];
            let mut run_length = 1;

            // Count consecutive matching symbols
            while col + run_length < GRID_SIZE
                && symbols[row_start + col + run_length] == current_sym
            {
                run_length += 1;
            }

            // Award based on run length (3+ matches)
            if run_length >= 3 {
                let multiplier = match run_length {
                    3 => 0.2,   // 3 in a row
                    4 => 0.5,   // 4 in a row
                    5 => 1.0,   // 5 in a row
                    6 => 2.0,   // 6 in a row
                    7 => 4.0,   // 7 in a row
                    8 => 8.0,   // 8 in a row
                    9 => 16.0,  // 9 in a row
                    10 => 50.0, // Full line!
                    _ => 0.0,
                };
                total_multiplier += multiplier;
                lines_won += 1;

                // Mark winning cells
                for i in 0..run_length {
                    winning_cells.push(row_start + col + i);
                }
            }

            col += run_length;
        }
    }

    (total_multiplier, winning_cells, lines_won)
}

#[wasm_bindgen]
pub fn spin(balance: i32, bet: i32) -> JsValue {
    let bet = bet.max(1);

    // Generate random symbols
    let symbols = generate_random();

    // Find winning lines
    let (multiplier, winning_cells, lines_won) = find_winning_lines(&symbols);

    // Calculate delta (win - bet)
    let winnings = (bet as f64 * multiplier).floor() as i32;
    let delta = winnings - bet;

    let outcome = if lines_won == 0 {
        "LOSE"
    } else if multiplier >= 10.0 {
        "WIN_JACKPOT"
    } else if multiplier >= 2.0 {
        "WIN"
    } else {
        "WIN_SMALL"
    };

    let new_balance = (balance + delta).max(0);

    let result = SpinResult {
        symbols,
        delta,
        balance: new_balance,
        outcome: outcome.to_string(),
        winning_cells,
        lines_won,
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}
