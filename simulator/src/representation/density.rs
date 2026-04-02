use ndarray::{Array, Array2, Dimension, IxDyn};
use num_complex::Complex32;

use crate::representation::{primitives::PrimitiveState, vector::Vector};
use crate::noise::NoiseModel;
use crate::gates::Gate;
use crate::state::State;

pub struct Density {
    pub data: Array<Complex32, IxDyn>,
    pub noise: Option<NoiseModel>,
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

        Self { 
            data: density,
            noise: None
        }
    }

    pub fn init(n: usize) -> Self {
        let shape = vec![2; n * 2];
        let mut data = Array::zeros(IxDyn(&shape));

        data[IxDyn(&vec![0; n * 2])] = Complex32::new(1.0, 0.0);
        Self {
            data,
            noise: None
        }
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

    pub fn init_with_noise(n: usize, noise: NoiseModel) -> Self {
        let mut density = Self::init(n);
        density.noise = Some(noise);
        density
    }

    pub fn calculate_fidelity(&self, pure_state: &Vector) -> f32 {
        let n = pure_state.data.ndim();
        let mut fidelity = Complex32::new(0.0, 0.0);

        // F = <psi| rho |psi> = sum_{i,j} conj(psi_i) * rho_ij * psi_j
        for (idx, &amp_i) in pure_state.data.indexed_iter() {
            for (jdx, &amp_j) in pure_state.data.indexed_iter() {
                let mut rho_idx = Vec::with_capacity(2 * n);
                rho_idx.extend(idx.as_array_view().iter());
                rho_idx.extend(jdx.as_array_view().iter());

                let rho_val = self.data[IxDyn(&rho_idx)];
                fidelity += amp_i.conj() * rho_val * amp_j;
            }
        }

        // Fidelity is physically constrained to be real and between 0 and 1
        fidelity.re.clamp(0.0, 1.0)
    }

    pub fn apply_kraus_map(&mut self, q: usize, operators: &[Array2<Complex32>]) {
        let n = self.data.ndim() / 2;
        let shape = vec![2; 2 * n];
        let mut next_rho = Array::zeros(IxDyn(&shape));

        // E_k_dagger pre calculation
        let ops_dag: Vec<(&Array2<Complex32>, Array2<Complex32>)> = operators
            .iter()
            .map(|e_k| (e_k, e_k.mapv(|c| c.conj()).reversed_axes()))
            .collect();
        
        for (e_k, e_k_dag) in ops_dag {
            for (idx, _b) in self.data.indexed_iter() {
                let r = idx[q];
                let c = idx[q + n];

                let amp = self.data[idx.clone()];
                if amp == Complex32::new(0.0, 0.0) { continue; }

                for i in 0..2 {
                    for j in 0..2 {
                        let mut next = idx.as_array_view().to_vec();
                        next[q] = i;
                        next[q+n] = j;

                        // Kraus update: rho' += E_k[i, r] * rho[r, c] * E_k_dag[c, j]
                        next_rho[IxDyn(&next)] += e_k[[i, r]] * amp * e_k_dag[[c, j]];
                    }
                }
            }
        }
        self.data = next_rho;
    }
    
    pub fn apply_depolarizing_noise(&mut self, q: usize) {
        let p = self.noise.map(|m| m.p_depolarize).unwrap_or(0.0);
        if p == 0.0 { return; }

        let p_4 = (p / 4.0).sqrt();
        let i_coeff = (1.0 - 0.75 * p).sqrt();

        // Depolarization kraus operators
        let e0 = Array2::from_shape_vec((2, 2), vec![
            Complex32::new(i_coeff, 0.0), Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0), Complex32::new(i_coeff, 0.0)
        ]).unwrap();

        let ex = Gate::X.matrix() * p_4;
        let ey = Gate::Y.matrix() * p_4;
        let ez = Gate::Z.matrix() * p_4;

        self.apply_kraus_map(q, &[e0, ex, ey, ez]);
    }

    pub fn apply_decoherence(&mut self, q: usize) {
        let (t1, _t2, t_gate) = match self.noise {
            Some(m) => (m.t1, m.t2, m.gate_time),
            None => return,
        };

        let gamma = 1.0 - (-t_gate / t1).exp();
        
        // Kraus operators for Amplitude Damping (T1)
        let e0 = Array2::from_shape_vec((2, 2), vec![
            Complex32::new(1.0, 0.0), Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0), Complex32::new((1.0 - gamma).sqrt(), 0.0)
        ]).unwrap();

        let e1 = Array2::from_shape_vec((2, 2), vec![
            Complex32::new(0.0, 0.0), Complex32::new(gamma.sqrt(), 0.0),
            Complex32::new(0.0, 0.0), Complex32::new(0.0, 0.0)
        ]).unwrap();

        self.apply_kraus_map(q, &[e0, e1]);
    }

    pub fn apply_phase_damping(&mut self, q: usize) {
        let (t1, t2, t_gate) = match self.noise {
            Some(m) => (m.t1, m.t2, m.gate_time),
            None => return,
        };

        let t_ph_inv = (1.0 / t2) - (1.0 / (2.0 * t1));
        let lambda = 1.0 - (-t_gate * t_ph_inv).exp();

        // Kraus operators for Phase Damping
        let e0 = Array2::from_shape_vec((2, 2), vec![
            Complex32::new(1.0, 0.0), Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0), Complex32::new((1.0 - lambda).sqrt(), 0.0)
        ]).unwrap();

        let e1 = Array2::from_shape_vec((2, 2), vec![
            Complex32::new(0.0, 0.0), Complex32::new(0.0, 0.0),
            Complex32::new(0.0, 0.0), Complex32::new(lambda.sqrt(), 0.0)
        ]).unwrap();

        self.apply_kraus_map(q, &[e0, e1]);
    }
}
