use std::f32::consts::SQRT_2;

use num_complex::Complex32;

pub mod gates;
pub mod representation;
pub mod state;
pub mod timeline;

pub const SQRT2_INV_COMPLEX: Complex32 = Complex32::new(1f32 / SQRT_2, 0.0);
pub const ONE_COMPLEX: Complex32 = Complex32::new(1.0, 0.0);
pub const ZERO_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);
pub const I_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        gates::Gate,
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
        assert!((f_perfect - 1.0).abs() < 1e-6, "Fidelity of identical states should be 1.0, got {}", f_perfect);

        // --- Scenario 2: Orthogonal States (0.0) ---
        // Ideal is |0>, Noisy is |1><1|
        let mut noisy_one = Density::init(n).init_state(&[PrimitiveState::Zero]);
        noisy_one.apply_single(Gate::X, 0); // Flip |0><0| to |1><1|
        
        let f_orthogonal = noisy_one.calculate_fidelity(&ideal_zero);
        assert!((f_orthogonal - 0.0).abs() < 1e-6, "Fidelity of orthogonal states should be 0.0, got {}", f_orthogonal);

        // --- Scenario 3: Superposition / Mixed State (0.5) ---
        // Ideal is |0>, Noisy is |+><+|
        // |+> = (1/sqrt2)(|0> + |1>), so |<0|+>|^2 = 0.5
        let mut noisy_plus = Density::init(n).init_state(&[PrimitiveState::Zero]);
        noisy_plus.apply_single(Gate::H, 0);
        
        let f_mixed = noisy_plus.calculate_fidelity(&ideal_zero);
        assert!((f_mixed - 0.5).abs() < 1e-6, "Fidelity between |0> and |+> should be 0.5, got {}", f_mixed);
    }
}
