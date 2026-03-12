use ndarray::{Array, Dimension, IxDyn};
use num_complex::Complex32;

use crate::representation::{primitives::PrimitiveState, vector::Vector};

pub struct Density {
    pub data: Array<Complex32, IxDyn>,
}

impl Density {
    pub fn from_pure_state(state: &Vector) -> Self {
        let n = state.data.ndim();
        let shape = vec![2; 2 * n];

        let mut density = Array::zeros(IxDyn(&shape));

        for (idx, &amp) in state.data.indexed_iter() {
            for (jdx, &amp2) in state.data.indexed_iter() {
                let mut new_idx = Vec::with_capacity(2 * n);
                new_idx.extend(idx.as_array_view().iter());
                new_idx.extend(jdx.as_array_view().iter());

                density[IxDyn(&new_idx)] = amp * amp2.conj();
            }
        }

        Self { data: density }
    }

    pub fn init(n: usize) -> Self {
        let shape = vec![2; n * 2];
        let mut data = Array::zeros(IxDyn(&shape));

        data[IxDyn(&vec![0; n * 2])] = Complex32::new(1.0, 0.0);
        Self { data }
    }

    pub fn init_state(mut self, initial_state: &[PrimitiveState]) -> Self {
        let n = initial_state.len();
        assert_eq!(
            self.data.ndim(),
            2 * n,
            "Density matrix must have twice the dimensions of the number of qbits."
        );

        let shape = vec![2; n * 2];
        let mut rho = Array::zeros(IxDyn(&shape));
        rho[IxDyn(&vec![0; n * 2])] = Complex32::new(1.0, 0.0);

        for (q, ps) in initial_state.iter().enumerate() {
            let ps_vec = ps.repr();
            let mut temp = Array::zeros(IxDyn(&shape));

            for (idx, &amp) in rho.indexed_iter() {
                for i in 0..2 {
                    for j in 0..2 {
                        let mut new_idx = idx.as_array_view().to_vec();
                        new_idx[q] = i; // row index
                        new_idx[q + n] = j; // col index
                        temp[IxDyn(&new_idx)] += amp * ps_vec[i] * ps_vec[j].conj();
                    }
                }
            }

            rho = temp;
        }

        self.data = rho;
        self
    }
}
