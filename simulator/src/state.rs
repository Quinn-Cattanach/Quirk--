use crate::gates::Gate;
use crate::noise::NoiseModel;
use crate::representation::{density::Density, vector::Vector};
use crate::ZERO_COMPLEX;
use ndarray::{Array, Dimension, IxDyn};
use num_complex::{Complex32};

pub trait State {
    fn n_qbit(&self) -> usize;
    fn data(&self) -> &Array<Complex32, IxDyn>;
    fn data_mut(&mut self) -> &mut Array<Complex32, IxDyn>;

    fn apply_single(&mut self, gate: Gate, q: usize);
    fn apply_cnot(&mut self, control: usize, target: usize);

    fn apply(&mut self, gate: Gate, target: usize, noise: Option<NoiseModel>);
    fn apply_swap(&mut self, q1: usize, q2: usize, noise: Option<NoiseModel>);
    fn apply_controlled(&mut self, gate: Gate, control: usize, target: usize, noise: Option<NoiseModel>);

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

    fn apply(&mut self, gate: Gate, target: usize, _noise: Option<NoiseModel>) {
        let u = gate.matrix();
        let mut new_data = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let r = idx[target]; // current row index of the target qubit

            for i in 0..2 {
                let mut next_idx = idx.as_array_view().to_vec();
                next_idx[target] = i;
                
                // Pure state update: |psi'> = U |psi>
                new_data[IxDyn(&next_idx)] += u[[i, r]] * amp;
            }
        }
        self.data = new_data;
    }

    /// Swaps the states of two qubits.
    fn apply_swap(&mut self, q1: usize, q2: usize, _noise: Option<NoiseModel>) {
        let mut next_data = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let mut next_idx = idx.as_array_view().to_vec();
            
            // Swap the indices for the two qubits
            next_idx.swap(q1, q2);

            next_data[IxDyn(&next_idx)] = amp;
        }
        self.data = next_data;
    }

    /// Applies a controlled unitary operation.
    fn apply_controlled(&mut self, gate: Gate, control: usize, target: usize, _noise: Option<NoiseModel>) {
        let u = gate.matrix();
        let mut new_data = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let mut next_idx = idx.as_array_view().to_vec();
            
            // If the control qubit is |1>, apply the gate to the target
            if idx[control] == 1 {
                let r = idx[target];
                for i in 0..2 {
                    next_idx[target] = i;
                    new_data[IxDyn(&next_idx)] += u[[i, r]] * amp;
                }
            } else {
                // If control is |0>, the amplitude transfers directly
                new_data[idx.clone()] += amp;
            }
        }
        self.data = new_data;
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

    fn apply(&mut self, gate: Gate, target: usize, noise: Option<NoiseModel>) {
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

    fn apply_swap(&mut self, q1: usize, q2: usize, noise: Option<NoiseModel>) {
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

    fn apply_controlled(&mut self, gate: Gate, control: usize, target: usize, noise: Option<NoiseModel>) {
        let u = gate.matrix(); 
        let n = self.n_qbit();
        let mut new_data = Array::zeros(self.data.raw_dim());

        for (idx, &amp) in self.data.indexed_iter() {
            if amp == ZERO_COMPLEX { continue; }

            let r_ctrl = idx[control];
            let c_ctrl = idx[control + n];
            let r_targ = idx[target];
            let c_targ = idx[target + n];

            // Evaluate row and column application independently
            let apply_row = r_ctrl == 1;
            let apply_col = c_ctrl == 1;

            for i in 0..2 {
                for j in 0..2 {
                    // Row action: U if control is 1, else Identity
                    let row_factor = if apply_row { 
                        u[[i, r_targ]] 
                    } else { 
                        if i == r_targ { crate::ONE_COMPLEX } else { ZERO_COMPLEX } 
                    };
                    
                    // Column action: U_dag if control is 1, else Identity
                    let col_factor = if apply_col { 
                        u[[j, c_targ]].conj() 
                    } else { 
                        if j == c_targ { crate::ONE_COMPLEX } else { ZERO_COMPLEX } 
                    };

                    let factor = row_factor * col_factor;
                    
                    if factor != ZERO_COMPLEX {
                        let mut next_idx = idx.as_array_view().to_vec();
                        next_idx[target] = i;
                        next_idx[target + n] = j;
                        
                        // Controlled-U: U * rho * U_dag (accounting for coherences)
                        new_data[IxDyn(&next_idx)] += factor * amp;
                    }
                }
            }
        }
        self.data = new_data;

        if let Some(m) = noise {
            self.apply_gate_noise_and_decoherence(Some(control), target, m);
        }
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
