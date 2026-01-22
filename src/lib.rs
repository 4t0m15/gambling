use js_sys::Math;
use serde::Serialize;
use wasm_bindgen::prelude::*;

/// Realistic slot machine with ~96% RTP (Return To Player)
/// 
/// Payout structure:
/// - Jackpot (2%): 3 matching symbols, pays 12x bet
/// - Big Win (10%): 2 matching symbols, pays 2x bet  
/// - Small Win (20%): 2 matching symbols, pays 1x bet (break even)
/// - Lose (68%): no matches, loses bet
///
/// Expected value: 0.02*12 + 0.10*2 + 0.20*1 - 0.68*1 = -0.04 per unit = 96% RTP

#[derive(Serialize)]
struct SpinResult {
    symbols: [u8; 3],
    delta: i32,
    balance: i32,
    outcome: String,
}

fn random_symbol() -> u8 {
    (Math::random() * 3.0).floor() as u8
}

fn random_percent() -> u8 {
    (Math::random() * 100.0).floor() as u8
}

fn generate_two_match() -> [u8; 3] {
    let matching = random_symbol();
    let different = (matching + 1 + (Math::random() * 2.0).floor() as u8) % 3;
    
    // Randomly choose which position is different
    let pos = (Math::random() * 3.0).floor() as u8;
    match pos {
        0 => [different, matching, matching],
        1 => [matching, different, matching],
        _ => [matching, matching, different],
    }
}

fn generate_all_different() -> [u8; 3] {
    let first = random_symbol();
    let second = (first + 1) % 3;
    let third = (first + 2) % 3;
    
    // Shuffle positions
    let order = (Math::random() * 6.0).floor() as u8;
    match order {
        0 => [first, second, third],
        1 => [first, third, second],
        2 => [second, first, third],
        3 => [second, third, first],
        4 => [third, first, second],
        _ => [third, second, first],
    }
}

#[wasm_bindgen]
pub fn spin(balance: i32, bet: i32) -> JsValue {
    let bet = bet.max(1);
    let roll = random_percent();
    
    let (symbols, delta, outcome) = if roll < 2 {
        // Jackpot: 2% chance, pays 12x
        let sym = random_symbol();
        ([sym, sym, sym], bet * 12, "WIN_JACKPOT")
    } else if roll < 12 {
        // Big win: 10% chance, pays 2x
        (generate_two_match(), bet * 2, "WIN")
    } else if roll < 32 {
        // Small win: 20% chance, pays 1x (break even)
        (generate_two_match(), bet, "WIN_SMALL")
    } else {
        // Lose: 68% chance
        (generate_all_different(), -bet, "LOSE")
    };

    let balance = (balance + delta).max(0);
    let result = SpinResult {
        symbols,
        delta,
        balance,
        outcome: outcome.to_string(),
    };

    serde_wasm_bindgen::to_value(&result).unwrap()
}
