import { useEffect } from "react";
import { Layout } from "./layout";
import { CircuitElement } from "./circuit/circuit-element";
import { simulate_circuit } from "./simulator/pkg/quirkmm_simulator";
import type { Circuit } from "./simulator/bindings/Circuit";
import type { PrimitiveState } from "./simulator/bindings/PrimitiveState";
import type { SimulationStage } from "./simulator/bindings/SimulationStage";
import type { ComplexValue } from "./simulator/bindings/ComplexValue";

function runGhzSanityCheck(): void {
    const fmt = (c: ComplexValue) =>
        `${c.re.toFixed(3)}${c.im >= 0 ? "+" : ""}${c.im.toFixed(3)}i`;

    const circuit: Circuit = {
        n_qbits: 2,
        gates: [
            [{ Gate: "H" }, null],
            ["Control", { Gate: "X" }],
        ],
    };
    const initialState: PrimitiveState[] = ["Zero", "Zero"];

    const stages = simulate_circuit(
        circuit,
        initialState,
        null,
    ) as SimulationStage[];

    for (const s of stages) {
        console.log(`\n=== Step ${s.step}: ${s.description} ===`);
        console.log(`fidelity (clean vs dirty) = ${s.fidelity.toFixed(4)}`);

        console.log("clean state vector:");
        s.clean.state_vector?.forEach((amp, i) => {
            const label = i.toString(2).padStart(2, "0");
            console.log(`  |${label}⟩ = ${fmt(amp)}`);
        });

        console.log("dirty density matrix:");
        for (const row of s.dirty.density_matrix) {
            console.log("  " + row.map(fmt).join("  "));
        }

        for (const q of s.dirty.qubits) {
            const [bx, by, bz] = q.bloch_vector;
            console.log(
                `  q${q.index}: purity=${q.purity.toFixed(3)} ` +
                    `bloch=(${bx.toFixed(2)}, ${by.toFixed(2)}, ${bz.toFixed(2)}) ` +
                    `${q.is_separable ? "[separable]" : "[entangled/mixed]"}`,
            );
        }
    }
}

function App() {
    useEffect(() => {
        console.log("Hello from typescript.");

        runGhzSanityCheck();

        // const circuit: Circuit = {
        //     n_qbits: 2,
        //     gates: [{ SingleQbit: ["H", 0] }],
        // };

        // greet(circuit);
    }, []);

    return (
        <>
            {/*<BlochSphereDemo />*/}
            <Layout>
                <CircuitElement />
            </Layout>
        </>
    );
}

export default App;
