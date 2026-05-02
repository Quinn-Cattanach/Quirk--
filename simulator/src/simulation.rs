use ndarray::{Array, Dimension, IxDyn};
use num_complex::Complex32;
use serde::Serialize;
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;

use crate::circuit::{Circuit, CircuitComponent};
use crate::noise::NoiseModel;
use crate::representation::{density::Density, primitives::PrimitiveState, vector::Vector};
use crate::state::State;

#[derive(ts_rs::TS, Serialize, Clone)]
#[ts(export)]
pub struct ComplexValue {
    pub re: f32,
    pub im: f32,
}

impl From<Complex32> for ComplexValue {
    fn from(c: Complex32) -> Self {
        Self { re: c.re, im: c.im }
    }
}

#[derive(ts_rs::TS, Serialize)]
#[ts(export)]
pub struct QubitInfo {
    pub index: usize,
    pub reduced_density: Vec<Vec<ComplexValue>>,
    pub purity: f32,
    pub is_separable: bool,
    pub bloch_vector: [f32; 3],
}

#[derive(ts_rs::TS, Serialize)]
#[ts(export)]
pub struct StateSnapshot {
    pub density_matrix: Vec<Vec<ComplexValue>>,
    pub state_vector: Option<Vec<ComplexValue>>,
    pub qubits: Vec<QubitInfo>,
}

#[derive(Serialize, ts_rs::TS)]
#[ts(export)]
pub struct SimulationStage {
    pub step: usize,
    pub description: String,
    pub clean: StateSnapshot,
    pub dirty: StateSnapshot,
    pub fidelity: f32,
}

#[wasm_bindgen(typescript_custom_section)]
const TS_IMPORTS: &'static str = r#"
import type { Circuit } from "../bindings/Circuit";
import type { PrimitiveState } from "../bindings/PrimitiveState";
import type { NoiseModel } from "../bindings/NoiseModel";
import type { SimulationStage } from "../bindings/SimulationStage";
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Circuit")]
    pub type CircuitJs;

    #[wasm_bindgen(typescript_type = "PrimitiveState[]")]
    pub type InitialStateJs;

    #[wasm_bindgen(typescript_type = "NoiseModel | null")]
    pub type NoiseModelJs;

    #[wasm_bindgen(typescript_type = "SimulationStage[]")]
    pub type SimulationStagesJs;
}

#[wasm_bindgen]
pub fn simulate_circuit(
    circuit_js: CircuitJs,
    initial_state_js: InitialStateJs,
    noise_model_js: NoiseModelJs,
) -> Result<SimulationStagesJs, JsValue> {
    let circuit: Circuit = serde_wasm_bindgen::from_value(circuit_js.into())
        .map_err(|e| JsValue::from_str(&format!("Bad circuit: {e}")))?;
    let initial_state: Vec<PrimitiveState> =
        serde_wasm_bindgen::from_value(initial_state_js.into())
            .map_err(|e| JsValue::from_str(&format!("Bad initial state: {e}")))?;

    let noise_value: JsValue = noise_model_js.into();
    let noise: Option<NoiseModel> = if noise_value.is_null() || noise_value.is_undefined() {
        None
    } else {
        Some(
            serde_wasm_bindgen::from_value(noise_value)
                .map_err(|e| JsValue::from_str(&format!("Bad noise model: {e}")))?,
        )
    };

    if initial_state.len() != circuit.n_qbits {
        return Err(JsValue::from_str(&format!(
            "initial_state length ({}) != circuit.n_qbits ({})",
            initial_state.len(),
            circuit.n_qbits
        )));
    }

    let n = circuit.n_qbits;

    // Two parallel simulations: a noiseless state vector and a noisy density matrix.
    let mut clean = Vector::init(n).init_state(&initial_state);
    let mut dirty = Density::init(n).init_state(&initial_state);

    let mut stages: Vec<SimulationStage> = Vec::with_capacity(circuit.gates.len() + 1);
    stages.push(snapshot_stage(0, "Initial state".into(), &clean, &dirty, n));

    for (i, time_step) in circuit.gates.iter().enumerate() {
        let desc = apply_time_step(time_step, &mut clean, &mut dirty, noise);
        stages.push(snapshot_stage(i + 1, desc, &clean, &dirty, n));
    }

    let value = serde_wasm_bindgen::to_value(&stages)
        .map_err(|e| JsValue::from_str(&format!("Serialize failed: {e}")))?;
    Ok(value.unchecked_into())
}

/// Apply one moment of the circuit. `components[q]` describes what happens to
/// qubit `q` at this moment. A `Control` slot pairs with the (single) `Gate`
/// slot in the same moment to form a controlled gate.
fn apply_time_step(
    components: &[Option<CircuitComponent>],
    clean: &mut Vector,
    dirty: &mut Density,
    noise: Option<NoiseModel>,
) -> String {
    let controls: Vec<usize> = components
        .iter()
        .enumerate()
        .filter_map(|(i, c)| match c {
            Some(CircuitComponent::Control) => Some(i),
            _ => None,
        })
        .collect();

    let mut handled_swaps: Vec<(usize, usize)> = Vec::new();
    let mut descs: Vec<String> = Vec::new();

    for (q, slot) in components.iter().enumerate() {
        let Some(component) = slot else { continue };
        match component {
            CircuitComponent::Gate(gate) => {
                if let Some(&ctrl) = controls.first() {
                    if ctrl != q {
                        clean.apply_controlled(*gate, ctrl, q, None);
                        dirty.apply_controlled(*gate, ctrl, q, noise);
                        descs.push(format!("C{:?}({}->{})", gate, ctrl, q));
                        continue;
                    }
                }
                clean.apply(*gate, q, None);
                dirty.apply(*gate, q, noise);
                descs.push(format!("{:?}({})", gate, q));
            }
            CircuitComponent::Swap(q1, q2) => {
                let pair = if q1 <= q2 { (*q1, *q2) } else { (*q2, *q1) };
                if !handled_swaps.contains(&pair) {
                    handled_swaps.push(pair);
                    clean.apply_swap(*q1, *q2, None);
                    dirty.apply_swap(*q1, *q2, noise);
                    descs.push(format!("SWAP({},{})", q1, q2));
                }
            }
            CircuitComponent::Control => { /* paired with a Gate slot */ }
            CircuitComponent::Measurement => {
                descs.push(format!("M({})", q));
            }
        }
    }

    if descs.is_empty() {
        "Identity".into()
    } else {
        descs.join(", ")
    }
}

fn snapshot_stage(
    step: usize,
    description: String,
    clean: &Vector,
    dirty: &Density,
    n: usize,
) -> SimulationStage {
    let clean_density = Density::from_pure_state(clean);
    SimulationStage {
        step,
        description,
        clean: build_snapshot(&clean_density.data, Some(&clean.data), n),
        dirty: build_snapshot(&dirty.data, None, n),
        fidelity: dirty.calculate_fidelity(clean),
    }
}

fn build_snapshot(
    rho: &Array<Complex32, IxDyn>,
    state_vec: Option<&Array<Complex32, IxDyn>>,
    n: usize,
) -> StateSnapshot {
    let dim = 1usize << n;

    // Density matrix in conventional row-major form, matching your Display.
    let mut density_matrix = vec![vec![ComplexValue { re: 0.0, im: 0.0 }; dim]; dim];
    for r in 0..dim {
        for c in 0..dim {
            let mut idx = vec![0usize; 2 * n];
            for q in 0..n {
                idx[n - q - 1] = (r >> q) & 1;
                idx[n - q - 1 + n] = (c >> q) & 1;
            }
            density_matrix[r][c] = rho[IxDyn(&idx)].into();
        }
    }

    let state_vector = state_vec.map(|v| {
        (0..dim)
            .map(|i| {
                let mut idx = vec![0usize; n];
                for q in 0..n {
                    idx[n - q - 1] = (i >> q) & 1;
                }
                v[IxDyn(&idx)].into()
            })
            .collect()
    });

    let qubits = (0..n).map(|q| compute_qubit_info(rho, q, n)).collect();

    StateSnapshot {
        density_matrix,
        state_vector,
        qubits,
    }
}

fn compute_qubit_info(rho: &Array<Complex32, IxDyn>, q: usize, n: usize) -> QubitInfo {
    // Partial trace: rho_q[i,j] = sum over configurations with r_k = c_k for all k != q,
    // r_q = i, c_q = j.
    let mut reduced = [[Complex32::new(0.0, 0.0); 2]; 2];
    for (idx, &val) in rho.indexed_iter() {
        let s = idx.slice();
        let mut traced = true;
        for k in 0..n {
            if k != q && s[k] != s[k + n] {
                traced = false;
                break;
            }
        }
        if traced {
            reduced[s[q]][s[q + n]] += val;
        }
    }

    // Purity Tr(rho^2) = sum_{i,j} rho_{ij} * rho_{ji}. Real for Hermitian rho.
    let mut purity_c = Complex32::new(0.0, 0.0);
    for i in 0..2 {
        for j in 0..2 {
            purity_c += reduced[i][j] * reduced[j][i];
        }
    }
    let purity = purity_c.re.clamp(0.0, 1.0);
    let is_separable = (purity - 1.0).abs() < 1e-3;

    // Bloch vector from rho = (I + r . sigma) / 2:
    //   r_x = 2 Re(rho_01), r_y = 2 Im(rho_10), r_z = rho_00 - rho_11.
    let r_x = 2.0 * reduced[0][1].re;
    let r_y = 2.0 * reduced[1][0].im;
    let r_z = (reduced[0][0] - reduced[1][1]).re;

    QubitInfo {
        index: q,
        reduced_density: vec![
            vec![reduced[0][0].into(), reduced[0][1].into()],
            vec![reduced[1][0].into(), reduced[1][1].into()],
        ],
        purity,
        is_separable,
        bloch_vector: [r_x, r_y, r_z],
    }
}
