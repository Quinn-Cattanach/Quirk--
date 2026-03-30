use crate::gates::SingleQbitGate;
use serde::{Deserialize, Serialize};

#[derive(ts_rs::TS, Serialize, Deserialize)]
#[ts(export)]
pub enum Gate {
    SingleQbit(SingleQbitGate, usize),
    CNot(usize, usize),
}

#[derive(ts_rs::TS, Serialize, Deserialize)]
#[ts(export)]
pub struct Circuit {
    pub n_qbits: usize,
    pub gates: Vec<Gate>,
}
