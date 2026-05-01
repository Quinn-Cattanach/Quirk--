import type { Circuit as SimCircuit } from "../simulator/bindings/Circuit";
import type { CircuitComponent as SimComponent } from "../simulator/bindings/CircuitComponent";
import type { Gate as SimGate } from "../simulator/bindings/Gate";
import type { PrimitiveState } from "../simulator/bindings/PrimitiveState";
import type {
    CircuitComponent,
    PrimitiveGate,
} from "../circuit-component/circuit-component";
import type { KetType } from "./circuit";

const GATE_OF_PRIMITIVE: Record<PrimitiveGate, SimGate> = {
    hadamard: "H",
    "pauli-x": "X",
    "pauli-y": "Y",
    "pauli-z": "Z",
};

const STATE_OF_KET: Record<KetType, PrimitiveState> = {
    "0": "Zero",
    "1": "One",
    "+": "Plus",
    "-": "Minus",
    "+i": "PlusI",
    "-i": "MinusI",
};

const NON_EVOLVING_TYPES = new Set([
    "bloch-inspector",
    "fidelity-inspector",
    "density-inspector",
]);

/**
 * Convert the UI circuit into the simulator's Circuit format.
 *
 *   UI layout:    components[row][col]  (row = qubit, col = time step)
 *   Sim layout:   gates[col][row]       (transposed)
 *
 * Not-controls are decomposed by sandwiching the column with X gates on
 * each not-control wire: X · (Control + target) · X.
 *
 * A column with exactly two swap targets emits a single Swap(q1, q2) at
 * the lower-indexed row's slot. A column with one swap is a noop and
 * gets dropped entirely.
 *
 * Inspectors (bloch / fidelity / density) don't affect evolution and are
 * skipped.
 *
 * stages[i+1] corresponds to UI column columnMap[i]. A given UI column
 * may appear multiple times in columnMap (X-sandwich rows for not-controls).
 */
export function buildSimulatorCircuit(
    components: (CircuitComponent | null)[][],
    startingStates: KetType[],
): {
    circuit: SimCircuit;
    initialState: PrimitiveState[];
    columnMap: number[];
} {
    const nQbits = components.length;
    const numColumns = components[0]?.length ?? 0;

    const X_GATE: SimComponent = { Gate: "X" };
    const CTRL: SimComponent = "Control";

    const gates: (SimComponent | null)[][] = [];
    const columnMap: number[] = [];

    for (let col = 0; col < numColumns; col += 1) {
        // First pass: classify column.
        const notControlRows: number[] = [];
        const swapRows: number[] = [];
        let hasOtherEvolving = false;

        for (let row = 0; row < nQbits; row += 1) {
            const c = components[row][col];
            if (!c) continue;
            if (NON_EVOLVING_TYPES.has(c.type)) continue;
            if (c.type === "swap") {
                swapRows.push(row);
                continue;
            }
            if (c.type === "not-control") notControlRows.push(row);
            hasOtherEvolving = true;
        }

        if (swapRows.length > 0 && !hasOtherEvolving) {
            if (swapRows.length === 2) {
                const out: (SimComponent | null)[] = Array(nQbits).fill(null);
                const [a, b] = swapRows;
                out[a] = { Swap: [a, b] };
                gates.push(out);
                columnMap.push(col);
            }
            continue;
        }

        if (!hasOtherEvolving) continue;

        const buildMidColumn = (): (SimComponent | null)[] => {
            const out: (SimComponent | null)[] = Array(nQbits).fill(null);
            for (let row = 0; row < nQbits; row += 1) {
                const c = components[row][col];
                if (!c) continue;
                if (NON_EVOLVING_TYPES.has(c.type)) continue;
                if (c.type === "swap") continue; // shouldn't happen here
                if (c.type === "control" || c.type === "not-control") {
                    out[row] = CTRL;
                } else if (c.type === "gate" && c.primitive) {
                    out[row] = { Gate: GATE_OF_PRIMITIVE[c.primitive] };
                } else {
                    console.warn(
                        `Skipping unconvertible cell at row=${row} col=${col}:`,
                        c,
                    );
                }
            }
            return out;
        };

        const sandwich = (): (SimComponent | null)[] => {
            const out: (SimComponent | null)[] = Array(nQbits).fill(null);
            for (const r of notControlRows) out[r] = X_GATE;
            return out;
        };

        if (notControlRows.length > 0) {
            gates.push(sandwich());
            columnMap.push(col);
        }
        gates.push(buildMidColumn());
        columnMap.push(col);
        if (notControlRows.length > 0) {
            gates.push(sandwich());
            columnMap.push(col);
        }
    }

    return {
        circuit: { n_qbits: nQbits, gates },
        initialState: startingStates.map((k) => STATE_OF_KET[k]),
        columnMap,
    };
}
