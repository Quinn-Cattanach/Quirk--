use ndarray::{Array, Array2, Dimension, IxDyn};
use num_complex::Complex32;

use crate::gates::Gate;
use crate::noise::NoiseModel;
use crate::representation::{primitives::PrimitiveState, vector::Vector};

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
            noise: None,
        }
    }

    pub fn init(n: usize) -> Self {
        let shape = vec![2; n * 2];
        let mut data = Array::zeros(IxDyn(&shape));

        data[IxDyn(&vec![0; n * 2])] = Complex32::new(1.0, 0.0);
        Self { data, noise: None }
    }

    pub fn init_state(mut self, initial_state: &[PrimitiveState]) -> Self {
        let n = initial_state.len();
        assert_eq!(
            self.data.ndim(),
            2 * n,
            "Density matrix must have twice the dimensions of the number of qbits."
        );

        let shape = vec![2; n * 2];
        // Warning: May overwrite existing data if we end up needing to rotate into current state
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

    /// thermal relaxation dephasing channel (Section II C, Georgopoulos et al.)
    pub fn apply_relaxation_and_dephasing(&mut self, q: usize) {
        let (t1, t2, t_gate) = match self.noise {
            Some(m) => (m.t1, m.t2, m.gate_time),
            None => return,
        };

        // this is a requirement for the assumptions of this simplified noise model, it gets more complex if not true and we don't have time to fix this.
        if t2 > 2.0 * t1 {
            log::warn!("T2 > 2*T1 not supported by Kraus form; skipping.");
            return;
        }

        let p_t1 = (-t_gate / t1).exp();
        let p_t2 = (-t_gate / t2).exp();

        let p_reset = 1.0 - p_t1;
        let p_z = (p_t1 - p_t2) / 2.0;
        let p_i = 1.0 - p_z - p_reset;

        // ensure nonnegative, was having problems with density matrix not being trace preserving.
        let p_reset = p_reset.max(0.0);
        let p_z = p_z.max(0.0);
        let p_i = p_i.max(0.0);

        let zero = Complex32::new(0.0, 0.0);

        let k_i = Array2::from_shape_vec(
            (2, 2),
            vec![
                Complex32::new(p_i.sqrt(), 0.0),
                zero,
                zero,
                Complex32::new(p_i.sqrt(), 0.0),
            ],
        )
        .unwrap();

        let k_z = Array2::from_shape_vec(
            (2, 2),
            vec![
                Complex32::new(p_z.sqrt(), 0.0),
                zero,
                zero,
                Complex32::new(-p_z.sqrt(), 0.0),
            ],
        )
        .unwrap();

        // K_reset on both \oprod{0}{0} and {0}{1}

        let k_reset_a = Array2::from_shape_vec(
            (2, 2),
            vec![Complex32::new(p_reset.sqrt(), 0.0), zero, zero, zero],
        )
        .unwrap();
        let k_reset_b = Array2::from_shape_vec(
            (2, 2),
            vec![zero, Complex32::new(p_reset.sqrt(), 0.0), zero, zero],
        )
        .unwrap();

        self.apply_kraus_map(q, &[k_i, k_z, k_reset_a, k_reset_b]);
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

        let ops_dag: Vec<(&Array2<Complex32>, Array2<Complex32>)> = operators
            .iter()
            .map(|e_k| (e_k, e_k.mapv(|c| c.conj()).reversed_axes()))
            .collect();

        // Iterate through every element in the current density matrix
        for (idx, &amp) in self.data.indexed_iter() {
            if amp == Complex32::new(0.0, 0.0) {
                continue;
            }

            let r = idx[q]; // Row index for qubit q
            let c = idx[q + n]; // Col index for qubit q

            for (e_k, e_k_dag) in &ops_dag {
                for i in 0..2 {
                    for j in 0..2 {
                        let mut next_idx = idx.as_array_view().to_vec();
                        next_idx[q] = i;
                        next_idx[q + n] = j;

                        // Update ONLY the dimensions corresponding to qubit q
                        // while keeping all other indices from 'idx' the same.
                        next_rho[IxDyn(&next_idx)] += e_k[[i, r]] * amp * e_k_dag[[c, j]];
                    }
                }
            }
        }
        self.data = next_rho;
    }

    // I updated this to match more like section II A of the paper (Georgopoulos et al.)
    pub fn apply_depolarizing_noise(&mut self, q: usize) {
        let p = self.noise.map(|m| m.p_depolarize).unwrap_or(0.0);
        if p == 0.0 {
            return;
        }

        let i_coeff = (1.0 - p).sqrt();
        let p_3 = (p / 3.0).sqrt();

        let zero = Complex32::new(0.0, 0.0);
        let e0 = Array2::from_shape_vec(
            (2, 2),
            vec![
                Complex32::new(i_coeff, 0.0),
                zero,
                zero,
                Complex32::new(i_coeff, 0.0),
            ],
        )
        .unwrap();

        let ex = Gate::X.matrix() * p_3;
        let ey = Gate::Y.matrix() * p_3;
        let ez = Gate::Z.matrix() * p_3;

        self.apply_kraus_map(q, &[e0, ex, ey, ez]);
    }

    pub fn apply_gate_noise_and_decoherence(
        &mut self,
        ctrl: Option<usize>,
        target: usize,
        m: NoiseModel,
    ) {
        self.noise = Some(m);
        self.apply_depolarizing_noise(target);
        if let Some(c) = ctrl {
            self.apply_depolarizing_noise(c);
        }

        let n_total = self.data.ndim() / 2;
        for i in 0..n_total {
            self.apply_relaxation_and_dephasing(i);
        }
    }
}
