// struct storing history of fidelity alongside operations performed
use crate::gates::Gate;
use crate::representation::vector::Vector;
use crate::representation::density::Density;
use crate::representation::primitives::PrimitiveState;
use crate::state::State;
use crate::noise::NoiseModel;

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
        instructions: Vec<(Gate, usize, Option<usize>)>, // (Gate, Target, Control)
        initial_state: &[PrimitiveState],
        noise: Option<NoiseModel>
    ) -> Self {
        // Initialize states
        let mut ideal_state = Vector::init(n_qubits).init_state(initial_state);
        let mut noisy_state = match noise {
            Some(m) => Density::init_with_noise(n_qubits, m).init_state(initial_state),
            None => Density::init(n_qubits).init_state(initial_state),
        };
        
        let mut steps = Vec::new();

        // Initial state fidelity (1.0)
        steps.push(TimeStep {
            gate: None,
            fidelity: 1.0,
        });

        for (gate, target, control) in instructions {
            match (gate, control) {
                // Handle 2-Qubit Gates
                (Gate::CZ, Some(ctrl)) => {
                    if let Some(ctrl) = control {
                        ideal_state.apply_cz(ctrl, target);
                        noisy_state.apply_cz(ctrl, target);
                        
                        // Noise affects both participants
                        noisy_state.apply_depolarizing_noise(ctrl);
                        noisy_state.apply_depolarizing_noise(target);
                    }
                },
                // CNOT
                (Gate::X, Some(ctrl)) => {
                    ideal_state.apply_cnot(ctrl, target);
                    noisy_state.apply_cnot(ctrl, target);
                    noisy_state.apply_depolarizing_noise(ctrl);
                        noisy_state.apply_depolarizing_noise(target);
                }
                // All other gates are treated as single qubit operations for now
                (_g, _) => {
                    ideal_state.apply_single(gate, target);
                    noisy_state.apply_single(gate, target);
                    noisy_state.apply_depolarizing_noise(target);
                }
            }

            // Global Decoherence: T1 and T2 happen to EVERY qubit during t_gate
            for i in 0..n_qubits {
                noisy_state.apply_decoherence(i);
                noisy_state.apply_phase_damping(i);
            }

            steps.push(TimeStep {
                gate: Some(gate),
                fidelity: noisy_state.calculate_fidelity(&ideal_state),
            });
        }

        // // Evolve states and record fidelity
        // for (gate, q) in instructions {
        //     ideal_state.apply_single(gate, q);
            
        //     noisy_state.apply_single(gate, q);
            
        //     // apply unified noise model
        //     noisy_state.apply_depolarizing_noise(q); // Pauli flips
        //     noisy_state.apply_decoherence(q); // T1 relaxation
        //     noisy_state.apply_phase_damping(q); // T2 dephasing
            
        //     let current_fidelity = noisy_state.calculate_fidelity(&ideal_state);
            
        //     steps.push(TimeStep {
        //         gate: Some(gate),
        //         fidelity: current_fidelity,
        //     });
        // }

        Self { steps }
    }
}