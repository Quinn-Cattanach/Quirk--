import { getSvgString, svgToImageBitmap, type SVG } from "../MathJax";
import { err, ok, type Result } from "../result";

export type PrimitiveGate = "hadamard" | "pauli-x" | "pauli-y" | "pauli-z";
export const primitiveGates: PrimitiveGate[] = [
    "hadamard",
    "pauli-x",
    "pauli-y",
    "pauli-z",
];

export class Gate {
    private static primitiveGateLabel: Record<PrimitiveGate, string> = {
        hadamard: "Hadamard",
        "pauli-x": "Pauli X (Not)",
        "pauli-y": "Pauli Y",
        "pauli-z": "Pauli Z",
    };

    private static primitiveGateLatex: Record<PrimitiveGate, string> = {
        hadamard: "\\text{H}",
        "pauli-x": "\\text{X}",
        "pauli-y": "\\text{Y}",
        "pauli-z": "\\text{Z}",
    };

    private static paddingUnscaled: number = 5; // need dpr scaling.
    private static strokeWidthUnscaled: number = 2; // need dpr scaling.

    #needsDisplay: null | (() => void);
    set needsDisplay(newCallback: () => void) {
        this.#needsDisplay = newCallback;
    }

    type: "gate";
    label: string;

    private rerender() {
        getSvgString(this.#latexString).then((svg) => {
            this.#svg = svg;
            svgToImageBitmap(svg, 24).then((bitmap) => {
                this.#bitmap = bitmap;
                if (this.#needsDisplay) this.#needsDisplay();
            });
        });
    }

    #latexString: string;
    set latexString(newValue: string) {
        this.#latexString = newValue;
        this.rerender();
    }

    #svg: SVG | null;
    get svg(): SVG | null {
        return this.#svg;
    }

    #bitmap: HTMLCanvasElement | null;
    get bitmap(): HTMLCanvasElement | null {
        return this.#bitmap;
    }

    get width(): number {
        return (
            (this.#bitmap?.width ?? 20.0) +
            2 * Gate.paddingUnscaled * devicePixelRatio
        );
    }

    get height(): number {
        return (
            (this.#bitmap?.height ?? 20.0) +
            2 * Gate.paddingUnscaled * devicePixelRatio
        );
    }

    draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        const [w, h] = [this.width, this.height];
        ctx.save();
        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = Gate.strokeWidthUnscaled * devicePixelRatio;
        ctx.stroke();

        ctx.translate(
            Gate.paddingUnscaled * devicePixelRatio,
            Gate.paddingUnscaled * devicePixelRatio,
        );

        if (this.bitmap) ctx.drawImage(this.bitmap, 0, 0);
        else ctx.fillText("?", 0, 0);

        ctx.restore();
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
        this.#svg = null;
        this.#bitmap = null;
        this.#latexString = latexString;
        this.#needsDisplay = null;
        this.rerender();
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
