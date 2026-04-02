#[derive(Debug, Clone, Copy)]
pub struct NoiseModel {
    /// Energy decay
    pub t1: f32,
    /// Dephasing
    pub t2: f32,
    /// Pauli flips
    pub p_depolarize: f32,
    /// avg gate execution time
    pub gate_time: f32,
}

impl Default for NoiseModel {
    fn default() -> Self {
        Self {
            t1: 50.0,
            t2: 70.0,
            p_depolarize: 0.001,
            gate_time: 0.1
        }
    }
}