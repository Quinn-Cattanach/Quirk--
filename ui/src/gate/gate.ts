import { getSvgString, svgToImageBitmap, type SVG } from "../MathJax";
import { err, ok, type Result } from "../result";

export type PrimitiveGate = "hadamard" | "pauli-x" | "pauli-y" | "pauli-z";
export const primitiveGates: PrimitiveGate[] = [
    "hadamard",
    "pauli-x",
    "pauli-y",
    "pauli-z",
];

export class CircuitComponent {
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

    #widthOverride: number = 0;

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
            (this.#widthOverride
                ? this.#widthOverride
                : (this.#bitmap?.width ?? 20.0)) +
            2 * CircuitComponent.paddingUnscaled * devicePixelRatio
        );
    }

    get height(): number {
        return (
            (this.#bitmap?.height ?? 20.0) +
            2 * CircuitComponent.paddingUnscaled * devicePixelRatio
        );
    }

    draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        const [w, h] = [this.width, this.height];
        ctx.save();
        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#FFFFFF";
        ctx.lineWidth = CircuitComponent.strokeWidthUnscaled * devicePixelRatio;
        ctx.fill();
        ctx.stroke();

        let [tx, ty] = [
            CircuitComponent.paddingUnscaled * devicePixelRatio,
            CircuitComponent.paddingUnscaled * devicePixelRatio,
        ];

        if (this.#widthOverride > 0) {
            tx += (this.#widthOverride - (this.#bitmap?.width ?? 20)) / 2;
        }

        ctx.translate(tx, ty);

        if (this.bitmap) ctx.drawImage(this.bitmap, 0, 0);
        else {
            ctx.font = `${24 * devicePixelRatio}px sans-serif`;
            ctx.fillText("?", 0, 22 * devicePixelRatio);
        }
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

    static createSingleQbit(): Result<CircuitComponent, string> {
        return err("The gate must be a unitary operator.");
        // return ok(new Gate());
    }

    static fromPrimitive(primitive: PrimitiveGate): CircuitComponent {
        const gate = new CircuitComponent({
            label: CircuitComponent.primitiveGateLabel[primitive],
            latexString: CircuitComponent.primitiveGateLatex[primitive],
        });

        gate.#widthOverride = 60;

        return gate;
    }
}
