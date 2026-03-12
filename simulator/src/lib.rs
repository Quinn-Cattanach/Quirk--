use std::f32::consts::SQRT_2;

use num_complex::Complex32;

pub mod gates;
pub mod representation;
pub mod state;

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
}
