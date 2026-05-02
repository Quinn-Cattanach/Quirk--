use std::f32::consts::SQRT_2;

use crate::circuit::Circuit;

use log::Level;
use log::{error, info};
use num_complex::Complex32;
use serde::Deserialize;
use wasm_bindgen::prelude::*;
pub mod circuit;
pub mod gates;
pub mod noise;
pub mod representation;
pub mod simulation;
pub mod state;

pub const SQRT2_INV_COMPLEX: Complex32 = Complex32::new(1f32 / SQRT_2, 0.0);
pub const ONE_COMPLEX: Complex32 = Complex32::new(1.0, 0.0);
pub const ZERO_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);
pub const I_COMPLEX: Complex32 = Complex32::new(0.0, 1.0);

#[wasm_bindgen(start)]
pub fn main() {
    console_log::init_with_level(log::Level::Debug).expect("error initializing logger");

    info!("Logger initialized! Rust logs should now appear in console.");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        gates::Gate,
        noise::NoiseModel,
        representation::{density::Density, primitives::PrimitiveState, vector::Vector},
        state::State,
    };
    use std::iter::zip;

    #[test]
    fn hadamard_single_qbit() {
        // we should have some more real tests at some point.

        let mut qbit = representation::vector::Vector::init(1);

        println!("{}", qbit);

        qbit.apply_single(Gate::H, 0);

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

        state.apply_single(Gate::H, 0);

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

    #[test]
    fn test_calculate_fidelity() {
        let n = 1;

        // --- Scenario 1: Perfect Fidelity (1.0) ---
        // Ideal state is |0>, Noisy state is |0><0|
        let ideal_zero = Vector::init(n).init_state(&[PrimitiveState::Zero]);
        let noisy_zero = Density::init(n).init_state(&[PrimitiveState::Zero]);

        let f_perfect = noisy_zero.calculate_fidelity(&ideal_zero);
        assert!(
            (f_perfect - 1.0).abs() < 1e-6,
            "Fidelity of identical states should be 1.0, got {}",
            f_perfect
        );

        // --- Scenario 2: Orthogonal States (0.0) ---
        // Ideal is |0>, Noisy is |1><1|
        let mut noisy_one = Density::init(n).init_state(&[PrimitiveState::Zero]);
        noisy_one.apply_single(Gate::X, 0); // Flip |0><0| to |1><1|

        let f_orthogonal = noisy_one.calculate_fidelity(&ideal_zero);
        assert!(
            (f_orthogonal - 0.0).abs() < 1e-6,
            "Fidelity of orthogonal states should be 0.0, got {}",
            f_orthogonal
        );

        // --- Scenario 3: Superposition / Mixed State (0.5) ---
        // Ideal is |0>, Noisy is |+><+|
        // |+> = (1/sqrt2)(|0> + |1>), so |<0|+>|^2 = 0.5
        let mut noisy_plus = Density::init(n).init_state(&[PrimitiveState::Zero]);
        noisy_plus.apply_single(Gate::H, 0);

        let f_mixed = noisy_plus.calculate_fidelity(&ideal_zero);
        assert!(
            (f_mixed - 0.5).abs() < 1e-6,
            "Fidelity between |0> and |+> should be 0.5, got {}",
            f_mixed
        );
    }

    #[test]
    fn test_fidelity_bell_state() {
        let n = 2;
        let initial = [PrimitiveState::Zero, PrimitiveState::Zero];
        let noise = Some(NoiseModel::default()); // Use default for noise testing

        // Initialize states
        let mut ideal_vec = Vector::init(n).init_state(&initial);
        let mut noisy_rho = Density::init(n).init_state(&initial);

        println!("\n--- Starting Refactored Fidelity Test ({} Qubits) ---", n);

        // 1. Initial State Check
        let f_init = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Step 0 (Initial): Fidelity = {:.4}", f_init);
        assert!((f_init - 1.0).abs() < 1e-6);

        // 2. Evolve to Bell State
        // Ideal state stays noiseless
        ideal_vec.apply(Gate::H, 0, None);
        ideal_vec.apply_controlled(Gate::X, 0, 1, None); // Use X as the basis for CNOT

        // Noisy state evolves with the Unified Noise Model
        noisy_rho.apply(Gate::H, 0, noise);
        noisy_rho.apply_controlled(Gate::X, 0, 1, noise);

        let f_bell = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Step 1 (Bell State): Fidelity = {:.4}", f_bell);

        // If noise is Some, fidelity will be < 1.0.
        assert!(f_bell < 1.0, "Noisy evolution should show fidelity decay");

        // 3. Comparison with Orthogonal State
        let zero_state = Vector::init(n).init_state(&initial);
        let f_overlap = noisy_rho.calculate_fidelity(&zero_state);

        println!(
            "Step 2 (Overlap Check): Fidelity vs |00> = {:.4}",
            f_overlap
        );
        // Overlap will be slightly less than 0.5 due to noise
        assert!(f_overlap < 0.55 && f_overlap > 0.45);
    }

    #[test]
    fn test_fidelity_phase_gate() {
        let n = 1;
        let initial = [PrimitiveState::Plus]; // |+> state
        let noise = Some(NoiseModel::default()); // Define the noise model

        let mut ideal_vec = Vector::init(n).init_state(&initial);
        let mut noisy_rho = Density::init(n).init_state(&initial);

        println!("\n--- Refactored Phase Gate Test (|H> -> |Z> -> |-H>) ---");

        // Apply Z gate: |+> should become |->
        // Ideal state uses None to remain perfectly noiseless
        ideal_vec.apply(Gate::Z, 0, None);

        // Noisy state undergoes the unitary rotation + unified noise
        noisy_rho.apply(Gate::Z, 0, noise);

        let f_z = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Fidelity after Z gate: {:.4}", f_z);

        // Expect fidelity to be slightly less than 1.0 due to T1/T2 and gate noise
        assert!(
            f_z < 1.0 && f_z > 0.95,
            "Noisy evolution should show minor fidelity decay"
        );

        // Cross-check: Fidelity of this new state vs the original |+>
        let plus_vec = Vector::init(n).init_state(&[PrimitiveState::Plus]);
        let f_ortho = noisy_rho.calculate_fidelity(&plus_vec);

        println!(
            "Fidelity vs original |+> (should be near 0.0): {:.4}",
            f_ortho
        );

        // The overlap will not be perfectly 0.0 because depolarization mixes the state slightly
        assert!(
            f_ortho < 0.05,
            "Orthogonal state overlap should remain very low"
        );
    }

    #[test]
    fn test_fidelity_entangled_flip() {
        let n = 2;
        let initial = [PrimitiveState::Zero, PrimitiveState::Zero];
        let noise = Some(NoiseModel::default()); // Introduce noise model

        let mut ideal_vec = Vector::init(n).init_state(&initial);
        let mut noisy_rho = Density::init(n).init_state(&initial);

        // Create Bell State |00> + |11>
        // Ideal state uses None to remain perfectly noiseless
        ideal_vec.apply(Gate::H, 0, None);
        ideal_vec.apply_controlled(Gate::X, 0, 1, None);

        // Noisy state undergoes unitary rotation + unified noise
        noisy_rho.apply(Gate::H, 0, noise);
        noisy_rho.apply_controlled(Gate::X, 0, 1, noise);

        let bell_reference = Vector {
            data: ideal_vec.data.to_owned(),
        }; // Store the ideal Bell state

        println!("\n--- Refactored Entangled Bit-Flip Test ---");

        // Apply X gate to qubit 1: (|00> + |11>) becomes (|01> + |10>)
        ideal_vec.apply(Gate::X, 1, None);
        noisy_rho.apply(Gate::X, 1, noise);

        let f_flipped = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Fidelity after X flip: {:.4}", f_flipped);

        assert!(
            f_flipped < 1.0 && f_flipped > 0.90,
            "Fidelity should reflect multi-gate noise accumulation"
        );

        // Compare the flipped noisy state back to the original Bell reference
        let f_vs_bell = noisy_rho.calculate_fidelity(&bell_reference);
        println!(
            "Fidelity vs original Bell state (should be near 0.0): {:.4}",
            f_vs_bell
        );

        // The overlap will not be perfectly 0.0 because depolarization mixes the state slightly.
        assert!(
            f_vs_bell < 0.1,
            "Fidelity against orthogonal Bell state should remain very low"
        );
    }
}
