import { getSvgString, svgToImageBitmap } from "../MathJax";
import { err, ok, type Result } from "../result";

export type PrimitiveGate = "hadamard" | "pauli-x" | "pauli-y" | "pauli-z";

export class Gate {
    private static primitiveGateLabel: Record<PrimitiveGate, string> = {
        hadamard: "Hadamard",
        "pauli-x": "Pauli X",
        "pauli-y": "Pauli Y",
        "pauli-z": "Pauli Z",
    };

    private static primitiveGateLatex: Record<PrimitiveGate, string> = {
        hadamard: "H",
        "pauli-x": "X",
        "pauli-y": "Y",
        "pauli-z": "Z",
    };

    type: "gate";
    label: string;

    private rerender() {
        getSvgString(this.#latexString).then((str) => {
            this.#svgString = str;
            svgToImageBitmap(str, 20).then((bitmap) => {
                this.#bitmap = bitmap;
            });
        });
    }

    #latexString: string;
    set latexString(newValue: string) {
        this.#latexString = newValue;
        this.rerender();
    }

    #svgString: string | null;
    get svgString(): string | null {
        return this.#svgString;
    }

    #bitmap: ImageBitmap | null;
    get bitmap(): ImageBitmap | null {
        return this.#bitmap;
    }

    private constructor({
        label,
        latexString,
    }: {
        label: string;
        latexString: string;
    }) {
        this.type = "gate";
        this.label = label;
        this.#svgString = null;
        this.#bitmap = null;
        this.#latexString = latexString;
    }

    static createSingleQbit(): Result<Gate, string> {
        return err("The gate must be a unitary operator.");
        // return ok(new Gate());
    }

    static fromPrimitive(primitive: PrimitiveGate): Gate {
        return new Gate({
            label: Gate.primitiveGateLabel[primitive],
            latexString: Gate.primitiveGateLatex[primitive],
        });
    }
}
