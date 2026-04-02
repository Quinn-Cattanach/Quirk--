use ndarray::{Array2, array};
use num_complex::Complex32;

use crate::{I_COMPLEX, ONE_COMPLEX, SQRT2_INV_COMPLEX, ZERO_COMPLEX};

#[derive(Clone, Copy, Debug)]
pub enum Gate {
    H,
    X,
    Y,
    Z,
    CZ,
}

impl Gate {
    pub fn matrix(self) -> Array2<Complex32> {
        match self {
            Gate::H => {
                array![
                    [SQRT2_INV_COMPLEX, SQRT2_INV_COMPLEX],
                    [SQRT2_INV_COMPLEX, -SQRT2_INV_COMPLEX]
                ]
            }

            Gate::X => array![[ZERO_COMPLEX, ONE_COMPLEX], [ONE_COMPLEX, ZERO_COMPLEX]],

            Gate::Y => array![[ZERO_COMPLEX, -I_COMPLEX], [I_COMPLEX, ZERO_COMPLEX]],

            Gate::Z => array![[ONE_COMPLEX, ZERO_COMPLEX], [ZERO_COMPLEX, -ONE_COMPLEX]],

            // This function returns a 2x2 matrix but CZ is a 4x4 operation. For now, the phase-flip logic is in the State trait and below is identiy
            Gate::CZ => array![[ONE_COMPLEX, ZERO_COMPLEX], [ZERO_COMPLEX, ONE_COMPLEX]],
        }
    }
}
