use ndarray::{Array2, array};
use num_complex::Complex32;
use serde::{Deserialize, Serialize};

use crate::{I_COMPLEX, ONE_COMPLEX, SQRT2_INV_COMPLEX, ZERO_COMPLEX};

#[derive(ts_rs::TS, Clone, Copy, Debug, Serialize, Deserialize)]
#[ts(export)]
pub enum Gate {
    H,
    X,
    Y,
    Z,
    SWAP,
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

            Gate::SWAP => Array2::from_shape_vec(
                (4, 4),
                vec![
                    ONE_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ONE_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ONE_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    ONE_COMPLEX,
                ],
            )
            .unwrap(),
        }
    }
}
