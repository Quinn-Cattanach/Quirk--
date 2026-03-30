use std::f32::consts::SQRT_2;

use crate::circuit::Circuit;

use log::Level;
use log::{error, info};
use num_complex::Complex32;
use serde::Deserialize;
use wasm_bindgen::prelude::*;
pub mod circuit;
pub mod gates;
pub mod representation;
pub mod state;

pub const SQRT2_INV_COMPLEX: Complex32 = Complex32::new(1f32 / SQRT_2, 0.0);
pub const ONE_COMPLEX: Complex32 = Complex32::new(1.0, 0.0);
pub const ZERO_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);
pub const I_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);

#[wasm_bindgen(start)]
pub fn main() {
    console_log::init_with_level(log::Level::Debug).expect("error initializing logger");

    info!("Logger initialized! Rust logs should now appear in console.");
}

#[wasm_bindgen]
pub fn greet(circuit: JsValue) {
    info!("Hello from rust!");

    let circuit = serde_wasm_bindgen::from_value::<Circuit>(circuit);

    if let Ok(circuit) = circuit {
        info!(
            "Received a {} qbit circuit with {} gates:",
            circuit.n_qbits,
            circuit.gates.len()
        );

        for gate in circuit.gates {
            match gate {
                circuit::Gate::SingleQbit(single_qbit_gate, position) => {
                    info!("{:?} - target: {}", single_qbit_gate, position)
                }
                circuit::Gate::CNot(control, target) => {
                    info!("CNOT - control: {}, target: {}", control, target)
                }
            }
        }
    } else {
        error!("Failed to deserialize the passed circuit!");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        gates::SingleQbitGate,
        representation::{density::Density, primitives::PrimitiveState, vector::Vector},
        state::State,
    };
    use std::iter::zip;

    #[test]
    fn hadamard_single_qbit() {
        // we should have some more real tests at some point.

        let mut qbit = representation::vector::Vector::init(1);

        println!("{}", qbit);

        qbit.apply_single(SingleQbitGate::H, 0);

        println!("{}", qbit);

        assert!(
            zip(qbit.data, [SQRT2_INV_COMPLEX, SQRT2_INV_COMPLEX])
                .fold(true, |p, (a, b)| p && a == b)
        )
    }

    #[test]
    fn two_qbit_cnot() {
        // we should have some more real tests at some point.

        let mut state = representation::vector::Vector::init(2);

        println!("{}", state);

        state.apply_single(SingleQbitGate::H, 0);

        println!("{}", state);

        state.apply_cnot(0, 1);

        println!("{}", state);

        assert!(
            zip(
                state.data,
                [
                    SQRT2_INV_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    SQRT2_INV_COMPLEX
                ]
            )
            .fold(true, |p, (a, b)| p && a == b)
        )
    }

    #[test]
    fn pure_state_density() {
        let pure = Vector::init(1).init_state(&[PrimitiveState::One]);

        let density = Density::from_pure_state(&pure);

        println!("{}", density);

        assert!(
            zip(
                density.data.flatten(),
                [ZERO_COMPLEX, ZERO_COMPLEX, ZERO_COMPLEX, ONE_COMPLEX]
            )
            .fold(true, |p, (a, b)| p && a == b)
        )
    }
}
