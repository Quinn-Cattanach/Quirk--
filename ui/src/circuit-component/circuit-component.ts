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
    private static paddingUnscaled = 5;
    private static strokeWidthUnscaled = 1.5;
    private static controlSizeUnscaled = 20;
    private static controlRadiusUnscaled = 6;

    #needsDisplay: null | (() => void);
    set needsDisplay(newCallback: () => void) {
        this.#needsDisplay = newCallback;
    }

    type: "gate" | "control" | "not-control";
    label: string;

    private rerender() {
        if (this.type === "control") return; // no SVG/bitmap needed
        getSvgString(this.#latexString).then((svg) => {
            this.#svg = svg;
            svgToImageBitmap(svg, 24).then((bitmap) => {
                this.#bitmap = bitmap;
                if (this.#needsDisplay) this.#needsDisplay();
            });
        });
    }

    #widthOverride = 0;
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
        if (this.type === "control" || this.type === "not-control") {
            return CircuitComponent.controlSizeUnscaled * devicePixelRatio;
        }
        return (
            (this.#widthOverride
                ? this.#widthOverride
                : (this.#bitmap?.width ?? 20.0)) +
            2 * CircuitComponent.paddingUnscaled * devicePixelRatio
        );
    }
    get height(): number {
        if (this.type === "control" || this.type === "not-control") {
            return CircuitComponent.controlSizeUnscaled * devicePixelRatio;
        }
        return (
            (this.#bitmap?.height ?? 20.0) +
            2 * CircuitComponent.paddingUnscaled * devicePixelRatio
        );
    }

    draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        const [w, h] = [this.width, this.height];
        ctx.save();

        if (this.type === "control" || this.type === "not-control") {
            const radius =
                CircuitComponent.controlRadiusUnscaled * devicePixelRatio;
            const stroke =
                CircuitComponent.strokeWidthUnscaled * devicePixelRatio;

            ctx.beginPath();
            ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);

            if (this.type === "control") {
                ctx.fillStyle = "#000000";
                ctx.fill();
            } else {
                // Not Control: White fill with black outline
                ctx.fillStyle = "#FFFFFF";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = stroke;
                ctx.fill();
                ctx.stroke();
            }

            ctx.restore();
            return;
        }

        const stroke = CircuitComponent.strokeWidthUnscaled * devicePixelRatio;
        const halfStroke = stroke / 2;

        ctx.clearRect(0, 0, w, h);

        ctx.beginPath();
        // inset so stroke stays fully inside canvas (prevents clipping)
        ctx.rect(halfStroke, halfStroke, w - stroke, h - stroke);

        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#FFFFFF";
        ctx.lineWidth = stroke;

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

        if (this.bitmap) {
            ctx.drawImage(this.bitmap, 0, 0);
        } else {
            ctx.font = `${24 * devicePixelRatio}px sans-serif`;
            ctx.fillText("?", 0, 22 * devicePixelRatio);
        }

        ctx.restore();
    }

    private constructor({
        label,
        latexString,
        type = "gate",
    }: {
        label: string;
        latexString: string;
        type?: "gate" | "control";
    }) {
        this.type = type;
        this.label = label;
        this.#svg = null;
        this.#bitmap = null;
        this.#latexString = latexString;
        this.#needsDisplay = null;
        this.rerender();
    }

    static createSingleQbit(): Result<CircuitComponent, string> {
        return err("The gate must be a unitary operator.");
    }

    #primitive: PrimitiveGate | null = null;
    get primitive(): PrimitiveGate | null {
        return this.#primitive;
    }

    static fromPrimitive(primitive: PrimitiveGate): CircuitComponent {
        const gate = new CircuitComponent({
            label: CircuitComponent.primitiveGateLabel[primitive],
            latexString: CircuitComponent.primitiveGateLatex[primitive],
        });
        gate.#widthOverride = 60;
        gate.#primitive = primitive;
        return gate;
    }

    static createControl(): CircuitComponent {
        return new CircuitComponent({
            label: "Control",
            latexString: "",
            type: "control",
        });
    }

    static createNotControl(): CircuitComponent {
        return new CircuitComponent({
            label: "Not Control",
            latexString: "",
            type: "not-control",
        });
    }
}
