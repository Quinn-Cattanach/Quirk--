import { useEffect, useRef, useState } from "react";
import { greet } from "./simulator/pkg/quirkmm_simulator";
import { renderBloch } from "./state/bloch";
import { SingleQbitState } from "./state/single-qbit";
import { Layout } from "./layout";
import { Circuit } from "./circuit/circuit";
import { CircuitElement } from "./circuit/circuit-element";

function App() {
    useEffect(() => {
        console.log("Hello from typescript.");

        // const circuit: Circuit = {
        //     n_qbits: 2,
        //     gates: [{ SingleQbit: ["H", 0] }],
        // };

        // greet(circuit);
    }, []);

    return (
        <Layout>
            <CircuitElement />
        </Layout>
    );
}

export default App;
