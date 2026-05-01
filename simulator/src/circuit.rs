use crate::gates::Gate;
use serde::{Deserialize, Serialize};

#[derive(ts_rs::TS, Serialize, Deserialize)]
#[ts(export)]
pub enum CircuitComponent {
    Gate(Gate),
    Swap(usize, usize),
    Control,
    Measurement,
}

#[derive(ts_rs::TS, Serialize, Deserialize)]
#[ts(export)]
pub struct Circuit {
    pub n_qbits: usize,
    pub gates: Vec<Vec<Option<CircuitComponent>>>,
}
