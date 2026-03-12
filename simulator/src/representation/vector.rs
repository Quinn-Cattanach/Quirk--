use ndarray::{Array, Dimension, IxDyn};
use num_complex::Complex32;

use crate::representation::primitives::PrimitiveState;

pub struct Vector {
    pub data: Array<Complex32, IxDyn>,
}

impl Vector {
    pub fn init(n: usize) -> Self {
        let shape = vec![2; n];
        let mut data = Array::zeros(IxDyn(&shape));
        data[IxDyn(&vec![0; n])] = Complex32::new(1.0, 0.0);
        Self { data }
    }

    pub fn init_state(mut self, initial_state: &[PrimitiveState]) -> Self {
        let n = initial_state.len();

        assert_eq!(
            self.data.ndim(),
            n,
            "The dimensionality of the initial state must match that of the target state."
        );

        let shape = vec![2; n];
        let mut new_data = Array::zeros(IxDyn(&shape));

        new_data[IxDyn(&vec![0; n])] = Complex32::new(1.0, 0.0);

        for (q, ps) in initial_state.iter().enumerate() {
            let ps_vec = ps.repr();
            let mut temp = Array::zeros(IxDyn(&shape));

            for (idx, &amp) in new_data.indexed_iter() {
                for i in 0..2 {
                    let mut new_idx = idx.as_array_view().to_vec();
                    new_idx[q] = i;
                    temp[IxDyn(&new_idx)] += amp * ps_vec[i];
                }
            }

            new_data = temp;
        }

        self.data = new_data;

        self
    }
}
