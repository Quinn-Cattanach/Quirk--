use crate::gates::Gate;
use crate::representation::{density::Density, vector::Vector};
use ndarray::{Array, Dimension, IxDyn};
use num_complex::Complex32;

pub trait State {
    fn n_qbit(&self) -> usize;
    fn data(&self) -> &Array<Complex32, IxDyn>;
    fn data_mut(&mut self) -> &mut Array<Complex32, IxDyn>;

    fn apply_single(&mut self, gate: Gate, q: usize);
    fn apply_cnot(&mut self, control: usize, target: usize);
    fn apply_cz(&mut self, control: usize, target: usize);
}

impl State for Vector {
    fn n_qbit(&self) -> usize {
        self.data.ndim()
    }

    fn data(&self) -> &Array<Complex32, IxDyn> {
        &self.data
    }

    fn data_mut(&mut self) -> &mut Array<Complex32, IxDyn> {
        &mut self.data
    }

    fn apply_single(&mut self, gate: Gate, q: usize) {
        let u = gate.matrix();
        let shape = vec![2; self.n_qbit()];
        let mut new = Array::zeros(IxDyn(&shape));

        for (idx, &amp) in self.data.indexed_iter() {
            let base = idx.slice().to_vec();

            for i in 0..2 {
                let mut new_idx = base.clone();
                new_idx[q] = i;

                new[IxDyn(&new_idx)] += u[[i, base[q]]] * amp;
            }
        }

        self.data = new;
    }

    fn apply_cnot(&mut self, control: usize, target: usize) {
        let shape = vec![2; self.n_qbit()];
        let mut new = Array::zeros(IxDyn(&shape));

        for (idx, &amp) in self.data.indexed_iter() {
            let mut new_idx = idx.slice().to_vec();

            if new_idx[control] == 1 {
                new_idx[target] ^= 1;
            }

            new[IxDyn(&new_idx)] += amp;
        }

        self.data = new;
    }

    fn apply_cz(&mut self, control: usize, target: usize) {
        for (idx, amp) in self.data.indexed_iter_mut() {
            if idx[control] == 1 && idx[target] == 1 {
                *amp *= -1.0;
            }
        }
    }
}

impl State for Density {
    fn n_qbit(&self) -> usize {
        self.data.ndim() / 2
    }

    fn data(&self) -> &Array<Complex32, IxDyn> {
        &self.data
    }

    fn data_mut(&mut self) -> &mut Array<Complex32, IxDyn> {
        &mut self.data
    }

    fn apply_single(&mut self, gate: Gate, q: usize) {
        let u = gate.matrix();
        let n = self.n_qbit();
        let shape = vec![2; 2 * n];
        let mut new = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            let base = idx.slice().to_vec();

            let r = base[q];
            let c = base[q + n];

            for i in 0..2 {
                for j in 0..2 {
                    let mut new_idx = idx.as_array_view().to_vec();
                    new_idx[q] = i;
                    new_idx[q + n] = j;

                    new[IxDyn(&new_idx)] += u[[i, r]] * amp * u[[j, c]].conj();
                }
            }
        }

        self.data = new;
    }

    fn apply_gate_noise_and_decoherence(&mut self, ctrl: Option<usize>, target: usize, m: NoiseModel) {
        self.noise = Some(m);
        self.apply_depolarizing_noise(target);
        if let Some(c) = ctrl { self.apply_depolarizing_noise(c); }

        let n_total = self.n_qbit();
        for i in 0..n_total {
            self.apply_decoherence(i);
            self.apply_phase_damping(i);
        }
    }

    pub fn apply(&mut self, gate: Gate, target: usize, noise: Option<NoiseModel>) {
        // Since Gate::SWAP is handled by a separate function, we 
        // focus on the 2x2 unitaries for H, X, Y, and Z.
        let u = gate.matrix();
        let n = self.n_qbit();
        let mut next_rho = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let r = idx[target];
            let c = idx[target + n];

            for i in 0..2 {
                for j in 0..2 {
                    let mut next_idx = idx.as_array_view().to_vec();
                    next_idx[target] = i;
                    next_idx[target + n] = j;

                    // Standard Unitary Update: rho' = U * rho * U_dag
                    next_rho[IxDyn(&next_idx)] += u[[i, r]] * amp * u[[j, c]].conj();
                }
            }
        }
        self.data = next_rho;

        // Apply noise scaling
        if let Some(m) = noise {
            self.apply_gate_noise_and_decoherence(None, target, m);
        }
    }

    pub fn apply_swap(&mut self, q1: usize, q2: usize, noise: Option<NoiseModel>) {
        let n = self.n_qbit();
        let mut next_rho = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let mut next_idx = idx.as_array_view().to_vec();
            
            // Physical SWAP: exchange the row and column indices
            next_idx.swap(q1, q2);
            next_idx.swap(q1 + n, q2 + n);

            next_rho[IxDyn(&next_idx)] = amp;
        }
        self.data = next_rho;

        // Apply noise scaling to both participating qubits
        if let Some(m) = noise {
            self.apply_gate_noise_and_decoherence(Some(q1), q2, m);
        }
    }

    pub fn apply_controlled(&mut self, gate: Gate, control: usize, target: usize, noise: Option<NoiseModel>) {
        let u = gate.matrix(); // Get the 2x2 matrix for the gate
        let n = self.n_qbit();
        let mut new_data = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let mut next_idx = idx.as_array_view().to_vec();
            
            // Logic: If control qubit is |1>, apply rotation to target
            if idx[control] == 1 && idx[control + n] == 1 {
                let r = idx[target];
                let c = idx[target + n];

                for i in 0..2 {
                    for j in 0..2 {
                        next_idx[target] = i;
                        next_idx[target + n] = j;
                        // Controlled-U: U * rho * U_dag
                        new_data[IxDyn(&next_idx)] += u[[i, r]] * amp * u[[j, c]].conj();
                    }
                }
            } else {
                // If control is |0>, state remains unchanged (Identity)
                new_data[idx.clone()] += amp;
            }
        }
        self.data = new_data;

        // Apply noise scaling
        if let Some(m) = noise {
            self.apply_gate_noise_and_decoherence(Some(control), target, m);
        }
    }

    fn apply_cnot(&mut self, control: usize, target: usize) {
        let n = self.n_qbit();
        let shape = vec![2; 2 * n];
        let mut new = Array::zeros(IxDyn(&shape));

        for (idx, &amp) in self.data.indexed_iter() {
            let mut new_idx = idx.slice().to_vec();

            if new_idx[control] == 1 {
                new_idx[target] ^= 1;
            }

            if new_idx[control + n] == 1 {
                new_idx[target + n] ^= 1;
            }

            new[IxDyn(&new_idx)] += amp;
        }

        self.data = new;
    }

    // fn apply_cz(&mut self, control: usize, target: usize) {
    //     let n = self.n_qbit();
    //     for (idx, amp) in self.data.indexed_iter_mut() {
    //         let row_flip = idx[control] == 1 && idx[target] == 1;
    //         let col_flip = idx[control + n] == 1 && idx[target + n] == 1;

    //         if row_flip != col_flip {
    //             *amp *= -1.0;
    //         }
    //     }
    // }
}
