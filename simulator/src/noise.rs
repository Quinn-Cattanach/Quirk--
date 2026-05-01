use serde::{Deserialize, Serialize};

#[derive(ts_rs::TS, Debug, Clone, Copy, Serialize, Deserialize)]
#[ts(export)]
pub struct NoiseModel {
    pub t1: f32,
    pub t2: f32,
    pub p_depolarize: f32,
    pub gate_time: f32,
}

impl Default for NoiseModel {
    fn default() -> Self {
        Self {
            t1: 50.0,
            t2: 70.0,
            p_depolarize: 0.001,
            gate_time: 0.1,
        }
    }
}
