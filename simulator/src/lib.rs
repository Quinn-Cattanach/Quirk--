use std::f32::consts::SQRT_2;

use num_complex::Complex32;

pub mod gates;
pub mod representation;
pub mod state;
pub mod timeline;
pub mod noise;

pub const SQRT2_INV_COMPLEX: Complex32 = Complex32::new(1f32 / SQRT_2, 0.0);
pub const ONE_COMPLEX: Complex32 = Complex32::new(1.0, 0.0);
pub const ZERO_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);
pub const I_COMPLEX: Complex32 = Complex32::new(0.0, 0.0);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        gates::Gate,
        representation::{density::Density, primitives::PrimitiveState, vector::Vector},
        state::State,
        noise::NoiseModel,
        timeline::CircuitTimeline,
    };
    use std::iter::zip;

    #[test]
    fn hadamard_single_qbit() {
        // we should have some more real tests at some point.

        let mut qbit = representation::vector::Vector::init(1);

        println!("{}", qbit);

        qbit.apply_single(Gate::H, 0);

        println!("{}", qbit);

        assert!(
            zip(qbit.data, [SQRT2_INV_COMPLEX, SQRT2_INV_COMPLEX])
                .fold(true, |p, (a, b)| p && a == b)
        )
    }

    #[test]
    fn two_qbit_cnot() {
        // we should have some more real tests at some point.

        let mut state = representation::vector::Vector::init(2);

        println!("{}", state);

        state.apply_single(Gate::H, 0);

        println!("{}", state);

        state.apply_cnot(0, 1);

        println!("{}", state);

        assert!(
            zip(
                state.data,
                [
                    SQRT2_INV_COMPLEX,
                    ZERO_COMPLEX,
                    ZERO_COMPLEX,
                    SQRT2_INV_COMPLEX
                ]
            )
            .fold(true, |p, (a, b)| p && a == b)
        )
    }

    #[test]
    fn pure_state_density() {
        let pure = Vector::init(1).init_state(&[PrimitiveState::One]);

        let density = Density::from_pure_state(&pure);

        println!("{}", density);

        assert!(
            zip(
                density.data.flatten(),
                [ZERO_COMPLEX, ZERO_COMPLEX, ZERO_COMPLEX, ONE_COMPLEX]
            )
            .fold(true, |p, (a, b)| p && a == b)
        )
    }

    #[test]
    fn test_calculate_fidelity() {
        let n = 1;
        
        // --- Scenario 1: Perfect Fidelity (1.0) ---
        // Ideal state is |0>, Noisy state is |0><0|
        let ideal_zero = Vector::init(n).init_state(&[PrimitiveState::Zero]);
        let noisy_zero = Density::init(n).init_state(&[PrimitiveState::Zero]);
        
        let f_perfect = noisy_zero.calculate_fidelity(&ideal_zero);
        assert!((f_perfect - 1.0).abs() < 1e-6, "Fidelity of identical states should be 1.0, got {}", f_perfect);

        // --- Scenario 2: Orthogonal States (0.0) ---
        // Ideal is |0>, Noisy is |1><1|
        let mut noisy_one = Density::init(n).init_state(&[PrimitiveState::Zero]);
        noisy_one.apply_single(Gate::X, 0); // Flip |0><0| to |1><1|
        
        let f_orthogonal = noisy_one.calculate_fidelity(&ideal_zero);
        assert!((f_orthogonal - 0.0).abs() < 1e-6, "Fidelity of orthogonal states should be 0.0, got {}", f_orthogonal);

        // --- Scenario 3: Superposition / Mixed State (0.5) ---
        // Ideal is |0>, Noisy is |+><+|
        // |+> = (1/sqrt2)(|0> + |1>), so |<0|+>|^2 = 0.5
        let mut noisy_plus = Density::init(n).init_state(&[PrimitiveState::Zero]);
        noisy_plus.apply_single(Gate::H, 0);
        
        let f_mixed = noisy_plus.calculate_fidelity(&ideal_zero);
        assert!((f_mixed - 0.5).abs() < 1e-6, "Fidelity between |0> and |+> should be 0.5, got {}", f_mixed);
    }

    #[test]
    fn test_fidelity_bell_state() {
        let n = 2;
        let initial = [PrimitiveState::Zero, PrimitiveState::Zero];
        let noise = Some(NoiseModel::default()); // Use default for noise testing
        
        // Initialize states
        let mut ideal_vec = Vector::init(n).init_state(&initial);
        let mut noisy_rho = Density::init(n).init_state(&initial);
        
        println!("\n--- Starting Refactored Fidelity Test ({} Qubits) ---", n);

        // 1. Initial State Check
        let f_init = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Step 0 (Initial): Fidelity = {:.4}", f_init);
        assert!((f_init - 1.0).abs() < 1e-6);

        // 2. Evolve to Bell State
        // Ideal state stays noiseless
        ideal_vec.apply(Gate::H, 0, None); 
        ideal_vec.apply_controlled(Gate::X, 0, 1, None); // Use X as the basis for CNOT
        
        // Noisy state evolves with the Unified Noise Model
        noisy_rho.apply(Gate::H, 0, noise);
        noisy_rho.apply_controlled(Gate::X, 0, 1, noise);
        
        let f_bell = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Step 1 (Bell State): Fidelity = {:.4}", f_bell);
        
        // If noise is Some, fidelity will be < 1.0. 
        assert!(f_bell < 1.0, "Noisy evolution should show fidelity decay"); 

        // 3. Comparison with Orthogonal State
        let zero_state = Vector::init(n).init_state(&initial);
        let f_overlap = noisy_rho.calculate_fidelity(&zero_state);
        
        println!("Step 2 (Overlap Check): Fidelity vs |00> = {:.4}", f_overlap);
        // Overlap will be slightly less than 0.5 due to noise
        assert!(f_overlap < 0.55 && f_overlap > 0.45);
    }

    #[test]
    fn test_fidelity_phase_gate() {
        let n = 1;
        let initial = [PrimitiveState::Plus]; // |+> state
        let noise = Some(NoiseModel::default()); // Define the noise model
        
        let mut ideal_vec = Vector::init(n).init_state(&initial);
        let mut noisy_rho = Density::init(n).init_state(&initial);
        
        println!("\n--- Refactored Phase Gate Test (|H> -> |Z> -> |-H>) ---");

        // Apply Z gate: |+> should become |->
        // Ideal state uses None to remain perfectly noiseless
        ideal_vec.apply(Gate::Z, 0, None);
        
        // Noisy state undergoes the unitary rotation + unified noise
        noisy_rho.apply(Gate::Z, 0, noise);
        
        let f_z = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Fidelity after Z gate: {:.4}", f_z);
        
        // Expect fidelity to be slightly less than 1.0 due to T1/T2 and gate noise
        assert!(f_z < 1.0 && f_z > 0.95, "Noisy evolution should show minor fidelity decay");

        // Cross-check: Fidelity of this new state vs the original |+> 
        let plus_vec = Vector::init(n).init_state(&[PrimitiveState::Plus]);
        let f_ortho = noisy_rho.calculate_fidelity(&plus_vec);
        
        println!("Fidelity vs original |+> (should be near 0.0): {:.4}", f_ortho);
        
        // The overlap will not be perfectly 0.0 because depolarization mixes the state slightly
        assert!(f_ortho < 0.05, "Orthogonal state overlap should remain very low");
    }

    #[test]
    fn test_fidelity_entangled_flip() {
        let n = 2;
        let initial = [PrimitiveState::Zero, PrimitiveState::Zero];
        let noise = Some(NoiseModel::default()); // Introduce noise model
        
        let mut ideal_vec = Vector::init(n).init_state(&initial);
        let mut noisy_rho = Density::init(n).init_state(&initial);
        
        // Create Bell State |00> + |11>
        // Ideal state uses None to remain perfectly noiseless
        ideal_vec.apply(Gate::H, 0, None);
        ideal_vec.apply_controlled(Gate::X, 0, 1, None);
        
        // Noisy state undergoes unitary rotation + unified noise
        noisy_rho.apply(Gate::H, 0, noise);
        noisy_rho.apply_controlled(Gate::X, 0, 1, noise);

        let bell_reference = Vector {
            data: ideal_vec.data.to_owned(),
        }; // Store the ideal Bell state

        println!("\n--- Refactored Entangled Bit-Flip Test ---");

        // Apply X gate to qubit 1: (|00> + |11>) becomes (|01> + |10>)
        ideal_vec.apply(Gate::X, 1, None);
        noisy_rho.apply(Gate::X, 1, noise);
        
        let f_flipped = noisy_rho.calculate_fidelity(&ideal_vec);
        println!("Fidelity after X flip: {:.4}", f_flipped);
        
        assert!(f_flipped < 1.0 && f_flipped > 0.90, "Fidelity should reflect multi-gate noise accumulation");

        // Compare the flipped noisy state back to the original Bell reference
        let f_vs_bell = noisy_rho.calculate_fidelity(&bell_reference);
        println!("Fidelity vs original Bell state (should be near 0.0): {:.4}", f_vs_bell);
        
        // The overlap will not be perfectly 0.0 because depolarization mixes the state slightly.
        assert!(f_vs_bell < 0.1, "Fidelity against orthogonal Bell state should remain very low");
    }

    // #[test]
    // fn test_t1_relaxation_decay() {
    //     let n = 1;
    //     // Hardware spec: T1 is 50.0 units, gate takes 50.0 units.
    //     let noise = NoiseModel {
    //         t1: 50.0,
    //         t2: 100.0, // Set T2 high to isolate T1
    //         p_depolarize: 0.0,
    //         gate_time: 50.0, 
    //     };

    //     let ideal = Vector::init(n).init_state(&[PrimitiveState::One]);
    //     let mut noisy = Density::init_with_noise(n, noise).init_state(&[PrimitiveState::One]);

    //     println!("\n--- T1 Decay Test (|1> -> |0>) ---");
        
    //     // Step 1: Initial state is perfect
    //     let f0 = noisy.calculate_fidelity(&ideal);
    //     assert!((f0 - 1.0).abs() < 1e-6);

    //     // Step 2: Apply a "Wait" (Identity) gate to let time pass
    //     noisy.apply_decoherence(0); 
        
    //     let f1 = noisy.calculate_fidelity(&ideal);
    //     println!("Fidelity after 1*T1 interval: {:.4}", f1);
        
    //     // After t=T1, probability of staying in |1> is e^-1 (~0.367)
    //     assert!(f1 < 0.4 && f1 > 0.3);
    // }

    // #[test]
    // fn test_depolarization() {
    //     let n = 1;
    //     let noise = NoiseModel {
    //         t1: 1000.0, t2: 1000.0, // Ignore decoherence
    //         p_depolarize: 0.2,   // 20% error rate
    //         gate_time: 0.0,
    //     };

    //     let ideal = Vector::init(n).init_state(&[PrimitiveState::Zero]);
    //     let mut noisy = Density::init_with_noise(n, noise).init_state(&[PrimitiveState::Zero]);

    //     println!("\n--- Depolarization Test ---");

    //     noisy.apply_depolarizing_noise(0);
    //     let f = noisy.calculate_fidelity(&ideal);
        
    //     println!("Fidelity after 20% depolarization: {:.4}", f);
        
    //     // For p=0.2, expected fidelity is 1 - p/1 = 0.90
    //     assert!((f - 0.90).abs() < 1e-3);
    // }

    #[test]
    fn test_timeline_error_accumulation() {
        let n = 1;
        let noise = NoiseModel::default(); // Uses 0.001 p_depolarize, plus T1/T2
        
        // Sequence of 3 Bit-Flips
        let instructions = vec![
            (Gate::X, 0, None), 
            (Gate::X, 0, None), 
            (Gate::X, 0, None)
        ];

        let timeline = CircuitTimeline::generate(
            n, 
            instructions, 
            &[PrimitiveState::Zero],
            Some(noise)
        );

        println!("\n--- Refactored Timeline Accumulation Test ---");
        
        let f_start = timeline.steps[0].fidelity;
        assert!((f_start - 1.0).abs() < 1e-6, "Initial state should have perfect fidelity");
        
        // Print the step-by-step collapse
        for (i, step) in timeline.steps.iter().enumerate() {
            println!("Step {} Fidelity: {:.6}", i, step.fidelity);
        }

        let f_end = timeline.steps.last().unwrap().fidelity;
        println!("End Fidelity after 3 gates: {:.6}", f_end);

        assert!(f_end < f_start, "Total fidelity must decrease as gates accumulate");

        // Rigorous Check: Ensure fidelity drops strictly at every single step
        for i in 1..timeline.steps.len() {
            assert!(
                timeline.steps[i].fidelity < timeline.steps[i - 1].fidelity, 
                "Fidelity failed to drop at step {}. Noise was not properly applied!", i
            );
        }
    }

    #[test]
    fn test_timeline_2qbit_qft() {
        let n = 2;
        let noise = NoiseModel {
            t1: 100.0, t2: 50.0,
            p_depolarize: 0.005,
            gate_time: 1.0,
        };

        // QFT gates for 2qbit system: H(0), CZ(0,1), H(1), SWAP
        let mut instructions = Vec::new();
        instructions.push((Gate::H, 0, None));
        instructions.push((Gate::Z, 1, Some(0))); // Controlled-Z 
        instructions.push((Gate::H, 1, None));
        instructions.push((Gate::SWAP, 1, Some(0))); // Added the missing SWAP to complete the QFT

        let initial_state = vec![PrimitiveState::Zero; n];

        let timeline = CircuitTimeline::generate(
            n, 
            instructions, 
            &initial_state,
            Some(noise)
        );

        println!("\n--- Refactored QFT 2-Qubit Noise Trace ---");
        
        let f_start = timeline.steps[0].fidelity;
        assert!((f_start - 1.0).abs() < 1e-6, "Initial state should be perfectly 1.0");

        for (i, step) in timeline.steps.iter().enumerate() {
            println!("Step {}: Fidelity = {:.6}", i, step.fidelity);
        }

        let f_final = timeline.steps.last().unwrap().fidelity;
        
        // In a 2-qubit QFT with these specific error parameters, we expect a noticeable drop
        assert!(f_final < 1.0, "Fidelity must decrease due to entanglement and swap noise");
        assert!(f_final > 0.8, "Fidelity should still remain reasonably high for a 4-gate depth");
        
        // Ensure fidelity drops strictly at every single step
        for i in 1..timeline.steps.len() {
            assert!(
                timeline.steps[i].fidelity < timeline.steps[i - 1].fidelity, 
                "Fidelity failed to drop at step {}. Global decoherence/gate noise missed!", i
            );
        }
    }

    #[test]
    fn test_timeline_4qbit_ghz() {
        let n = 4;
        // Use realistic noise parameters for a near-term device
        let noise = NoiseModel {
            t1: 150.0,
            t2: 80.0,
            p_depolarize: 0.003,
            gate_time: 1.0,
        };
        let initial = vec![PrimitiveState::One; n];

        let mut instructions = Vec::new();
        // Step 1: Create superposition on the first qubit
        instructions.push((Gate::H, 0, None));
        
        // Step 2-4: Cascade CNOTs to entangle the whole chain
        // In the refactored architecture, Gate::X with a control acts as CNOT
        instructions.push((Gate::X, 1, Some(0))); // CNOT(0,1)
        instructions.push((Gate::X, 2, Some(1))); // CNOT(1,2)
        instructions.push((Gate::X, 3, Some(2))); // CNOT(2,3)

        let timeline = CircuitTimeline::generate(
            n, 
            instructions, 
            &initial,
            Some(noise)
        );

        println!("\n--- Refactored 4-Qubit GHZ State Decay ---");
        
        // Verify initial noiseless state
        let f_start = timeline.steps[0].fidelity;
        assert!((f_start - 1.0).abs() < 1e-6, "Initial state fidelity should be perfectly 1.0");

        for (i, step) in timeline.steps.iter().enumerate() {
            println!("Step {}: Fidelity = {:.6}", i, step.fidelity);
        }

        let f_final = timeline.steps.last().unwrap().fidelity;
        
        assert!(f_final < 1.0, "Fidelity must decrease due to multi-qubit entanglement noise");
        
        assert!(f_final > 0.8, "Fidelity should still be reasonably high for a 4-gate depth");
        
        for i in 1..timeline.steps.len() {
            assert!(
                timeline.steps[i].fidelity < timeline.steps[i - 1].fidelity, 
                "Fidelity failed to drop at step {}. Global decoherence missed!", i
            );
        }
    }

    #[test]
    fn test_timeline_6qbit_ghz() {
        let n = 6;
        let noise = NoiseModel {
            t1: 150.0,
            t2: 80.0,
            p_depolarize: 0.003,
            gate_time: 1.0,
        }; 
        let initial = vec![PrimitiveState::One; n];

        let mut instructions = Vec::new();
        // 1. Create superposition on the first qubit
        instructions.push((Gate::H, 0, None));
        
        // 2-6. Cascade CNOTs to entangle the whole chain
        for i in 0..5 {
            instructions.push((Gate::X, i + 1, Some(i))); 
        }

        let timeline = CircuitTimeline::generate(
            n, 
            instructions, 
            &initial,
            Some(noise)
        );

        println!("\n--- Refactored 6-Qubit GHZ Entanglement Decay ---");
        
        // Verify initial noiseless state
        let f_start = timeline.steps[0].fidelity;
        assert!((f_start - 1.0).abs() < 1e-6, "Initial state fidelity should be perfectly 1.0");

        for (i, step) in timeline.steps.iter().enumerate() {
            println!("Step {}: Fidelity = {:.6}", i, step.fidelity);
        }

        let f_final = timeline.steps.last().unwrap().fidelity;
        
        assert!(f_final < 1.0, "Fidelity must decrease due to multi-qubit entanglement noise");
        
        assert!(f_final > 0.70, "Fidelity should remain within expected bounds for a 6-gate depth");

        for i in 1..timeline.steps.len() {
            assert!(
                timeline.steps[i].fidelity < timeline.steps[i - 1].fidelity, 
                "Fidelity failed to drop at step {}. Global decoherence loop failed!", i
            );
        }
    }

    #[test]
    fn test_timeline_8qbit_ghz() {
        let n = 8;
        let noise = NoiseModel {
            t1: 150.0,
            t2: 80.0,
            p_depolarize: 0.003,
            gate_time: 1.0,
        };
        
        let initial = vec![PrimitiveState::One; n];

        let mut instructions = Vec::new();
        // 1. Initial superposition on qubit 0
        instructions.push((Gate::H, 0, None));
        
        // 2-8. Entanglement cascade across the 8-qubit register
        for i in 0..7 {
            instructions.push((Gate::X, i + 1, Some(i))); 
        }

        let timeline = CircuitTimeline::generate(
            n, 
            instructions, 
            &initial,
            Some(noise)
        );

        println!("\n--- Refactored 8-Qubit GHZ Entanglement Decay ---");
        
        // Verify initial noiseless state
        let f_start = timeline.steps[0].fidelity;
        assert!((f_start - 1.0).abs() < 1e-6, "Initial state fidelity should be perfectly 1.0");

        for (i, step) in timeline.steps.iter().enumerate() {
            println!("Step {}: Fidelity = {:.6}", i, step.fidelity);
        }

        let f_final = timeline.steps.last().unwrap().fidelity;
        
        assert!(f_final < 1.0, "Fidelity must decrease due to multi-qubit entanglement noise");
        
        assert!(
            f_final < 0.70 && f_final > 0.60, 
            "Fidelity deviated from the expected ~0.66 benchmark for the |1> initialized 8-qubit system"
        );

        for i in 1..timeline.steps.len() {
            assert!(
                timeline.steps[i].fidelity < timeline.steps[i - 1].fidelity, 
                "Fidelity failed to drop at step {}. Global decoherence loop missed the idle qubits!", i
            );
        }
    }
}
