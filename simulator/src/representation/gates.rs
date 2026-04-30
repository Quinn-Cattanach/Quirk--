use ndarray::{Array2, array};
use num_complex::Complex32;
use serde::{Deserialize, Serialize};

use crate::{I_COMPLEX, ONE_COMPLEX, SQRT2_INV_COMPLEX, ZERO_COMPLEX};

#[derive(ts_rs::TS, Clone, Copy, Debug, Serialize, Deserialize)]
#[ts(export)]
pub enum SingleQbitGate {
    H,
    X,
    Y,
    Z,
}

impl SingleQbitGate {
    pub fn matrix(self) -> Array2<Complex32> {
        match self {
            SingleQbitGate::H => {
                array![
                    [SQRT2_INV_COMPLEX, SQRT2_INV_COMPLEX],
                    [SQRT2_INV_COMPLEX, -SQRT2_INV_COMPLEX]
                ]
            }

            SingleQbitGate::X => array![[ZERO_COMPLEX, ONE_COMPLEX], [ONE_COMPLEX, ZERO_COMPLEX]],

            SingleQbitGate::Y => array![[ZERO_COMPLEX, -I_COMPLEX], [I_COMPLEX, ZERO_COMPLEX]],

            SingleQbitGate::Z => array![[ONE_COMPLEX, ZERO_COMPLEX], [ZERO_COMPLEX, -ONE_COMPLEX]],
        }
    }
}
