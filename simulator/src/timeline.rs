// struct storing history of fidelity alongside operations performed
use crate::gates::Gate;
use crate::representation::vector::Vector;
use crate::representation::density::Density;
use crate::representation::primitives::PrimitiveState;
use crate::state::State;

pub struct TimeStep {
    pub gate: Option<Gate>, // The gate applied at this step
    pub fidelity: f32,      // Fidelity after this gate + noise
}

pub struct CircuitTimeline {
    pub steps: Vec<TimeStep>,
}

impl CircuitTimeline {
    pub fn generate(
        n_qubits: usize, 
        instructions: Vec<(Gate, usize)>, // (Gate, Qubit Index)
        initial_state: &[PrimitiveState]
    ) -> Self {
        // Initialize states
        let mut ideal_state = Vector::init(n_qubits).init_state(initial_state);
        let mut noisy_state = Density::init(n_qubits).init_state(initial_state);
        
        let mut steps = Vec::new();

        // Initial state fidelity (1.0)
        steps.push(TimeStep {
            gate: None,
            fidelity: noisy_state.calculate_fidelity(&ideal_state),
        });

        // Evolve states and record fidelity
        for (gate, q) in instructions {
            ideal_state.apply_single(gate, q);
            
            noisy_state.apply_single(gate, q);
            
            // --- INJECT NOISE HERE (?) ---
            // noisy_state.apply_depolarization(q, 0.01); 
            
            let current_fidelity = noisy_state.calculate_fidelity(&ideal_state);
            
            steps.push(TimeStep {
                gate: Some(gate),
                fidelity: current_fidelity,
            });
        }

        Self { steps }
    }
}