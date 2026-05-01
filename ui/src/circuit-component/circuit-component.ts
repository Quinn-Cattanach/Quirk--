import { getSvgString, svgToImageBitmap, type SVG } from "../MathJax";
import { err, ok, type Result } from "../result";
import type { QubitInfo } from "../simulator/bindings/QubitInfo";
import type { SimulationStage } from "../simulator/bindings/SimulationStage";
import type { ComplexValue } from "../simulator/bindings/ComplexValue";

export type PrimitiveGate = "hadamard" | "pauli-x" | "pauli-y" | "pauli-z";

export const primitiveGates: PrimitiveGate[] = [
    "hadamard",
    "pauli-x",
    "pauli-y",
    "pauli-z",
];

function formatDensityMatrixLatex(matrix: ComplexValue[][]): string {
    const rows = matrix
        .map((row) => row.map(formatComplexLatex).join(" & "))
        .join(" \\\\ ");
    return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}
function drawIconBox(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    w: number,
    h: number,
    bitmap: HTMLCanvasElement | null,
) {
    const dpr = devicePixelRatio;
    const stroke = 1.5 * dpr;
    const half = stroke / 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.roundRect(half, half, w - stroke, h - stroke, [w / 2, w / 2]);
    ctx.fill();
    ctx.stroke();

    if (!bitmap) return;

    const maxW = w * 0.4;
    const maxH = h * 0.4;
    const scale = Math.min(maxW / bitmap.width, maxH / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function formatComplexLatex(c: ComplexValue): string {
    const re = Math.abs(c.re) < 1e-4 ? 0 : c.re;
    const im = Math.abs(c.im) < 1e-4 ? 0 : c.im;
    if (re === 0 && im === 0) return "0";
    if (im === 0) return re.toFixed(2);
    if (re === 0) return `${im.toFixed(2)}i`;
    const sign = im >= 0 ? "+" : "-";
    return `${re.toFixed(2)}${sign}${Math.abs(im).toFixed(2)}i`;
}

const sph3 = (phi: number, theta: number): number[] => {
    const s = Math.sin(theta);
    return [s * Math.cos(phi), s * Math.sin(phi), Math.cos(theta)];
};
const norm3 = (v: number[]): number[] => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l < 1e-9 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
};
const cross3 = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a: number[], b: number[]): number =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Fixed camera matching BlochSphereDemo's defaults (35°, 70°).
const BLOCH_CAM = (() => {
    const cam = norm3(sph3((35 * Math.PI) / 180, (70 * Math.PI) / 180));
    const tmpUp = Math.abs(cam[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = norm3(cross3(tmpUp, cam));
    const up = cross3(cam, right);
    return { cam, right, up };
})();

function drawGreatCircle(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    R: number,
    normal: number[], // plane normal
) {
    const { cam, right, up } = BLOCH_CAM;

    const n = norm3(normal);

    // build basis for the circle plane
    const tangent = norm3(
        Math.abs(n[2]) < 0.9 ? cross3([0, 0, 1], n) : cross3([0, 1, 0], n),
    );
    const bitan = cross3(n, tangent);

    const project = (p: number[]) => [
        dot3(p, right),
        -dot3(p, up), // match your inverted Y
    ];

    const N = 64;
    const pts: [number, number][] = [];
    const facing: boolean[] = [];

    for (let i = 0; i <= N; i++) {
        const t = (i / N) * 2 * Math.PI;
        const p = [
            R * (Math.cos(t) * tangent[0] + Math.sin(t) * bitan[0]),
            R * (Math.cos(t) * tangent[1] + Math.sin(t) * bitan[1]),
            R * (Math.cos(t) * tangent[2] + Math.sin(t) * bitan[2]),
        ];
        pts.push(project(p));
        facing.push(dot3(p, cam) >= 0);
    }

    let i = 0;
    while (i < N) {
        const segFacing = facing[i] && facing[i + 1];
        let j = i + 1;
        while (j < N && (facing[j] && facing[j + 1]) === segFacing) j++;

        ctx.save();

        ctx.setLineDash(segFacing ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        for (let k = i + 1; k <= j; k++) {
            ctx.lineTo(pts[k][0], pts[k][1]);
        }
        ctx.globalAlpha = segFacing ? 1.0 : 0.5;
        ctx.stroke();

        ctx.restore();

        i = j;
    }
}

function drawBlochInspector(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    w: number,
    h: number,
    qubitInfo: QubitInfo | null,
) {
    const dpr = devicePixelRatio;
    const stroke = 1.5 * dpr;
    const half = stroke / 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.roundRect(half, half, w - stroke, h - stroke, [w / 2, h / 2]);
    ctx.fill();
    ctx.stroke();

    const cx = w / 2;
    const cy = h / 2;
    const margin = 6 * dpr;
    const R = Math.min(w, h) / 2 - margin;

    ctx.save();
    ctx.translate(cx, cy);

    // Silhouette circle.
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    drawGreatCircle(ctx, R, [0, 0, 1]);
    drawGreatCircle(ctx, R, [0, 1, 0]);
    drawGreatCircle(ctx, R, [1, 0, 0]);

    if (qubitInfo && qubitInfo.is_separable) {
        const [bx, by, bz] = qubitInfo.bloch_vector;
        const tip3D = [bx * R, by * R, bz * R];
        const tipX = dot3(tip3D, BLOCH_CAM.right);
        const tipY = -dot3(tip3D, BLOCH_CAM.up); // canvas y is inverted
        const facing = dot3([bx, by, bz], BLOCH_CAM.cam) >= 0;

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash(facing ? [] : [3 * dpr, 3 * dpr]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.setLineDash([]);

        const dotR = 2.5 * dpr;
        ctx.beginPath();
        ctx.arc(tipX, tipY, dotR, 0, Math.PI * 2);
        if (facing) {
            ctx.fillStyle = "#000";
            ctx.fill();
        } else {
            ctx.fillStyle = "#fff";
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1 * dpr;
            ctx.fill();
            ctx.stroke();
        }
    }

    ctx.restore();
}

function drawFidelityInspector(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    w: number,
    h: number,
    stage: SimulationStage | null,
) {
    const dpr = devicePixelRatio;
    const stroke = 1.5 * dpr;
    const half = stroke / 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.rect(half, half, w - stroke, h - stroke);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#000";
    const labelSize = 11 * dpr;
    ctx.font = `${labelSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Fidelity", w / 2, 8 * dpr);

    if (!stage) {
        ctx.font = `${12 * dpr}px sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#888";
        ctx.fillText("—", w / 2, h / 2);
        return;
    }

    const f = stage.fidelity;

    const numSize = 18 * dpr;
    ctx.font = `bold ${numSize}px sans-serif`;
    ctx.fillStyle = "#000";
    ctx.textBaseline = "middle";
    ctx.fillText(f.toFixed(4), w / 2, h / 2 - 6 * dpr);

    const barMargin = 12 * dpr;
    const barH = 6 * dpr;
    const barY = h - 14 * dpr;
    const barX = barMargin;
    const barW = w - 2 * barMargin;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(barX, barY, barW, barH);
    const fill = Math.max(0, Math.min(1, f));
    ctx.fillStyle = fill > 0.95 ? "#0a0" : fill > 0.7 ? "#cc6600" : "#a00";
    ctx.fillRect(barX, barY, barW * fill, barH);
}

function drawDensityInspector(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    w: number,
    h: number,
    stage: SimulationStage | null,
    bitmap: HTMLCanvasElement | null,
) {
    const dpr = devicePixelRatio;
    const stroke = 1.5 * dpr;
    const half = stroke / 2;

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.rect(half, half, w - stroke, h - stroke);
    ctx.fill();
    ctx.stroke();

    if (!stage) return;

    const padX = 10 * dpr;
    const padY = 10 * dpr;
    const availW = w - 2 * padX;
    const availH = h - 2 * padY;

    if (!bitmap) {
        ctx.fillStyle = "#888";
        ctx.font = `${12 * dpr}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("rendering…", w / 2, h / 2);
        return;
    }

    // Fit while preserving aspect ratio
    const scale = Math.min(availW / bitmap.width, availH / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;

    // Center in full canvas (no header offset)
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    ctx.drawImage(bitmap, dx, dy, dw, dh);
}

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
    private static blochInspectorSizeUnscaled = 60;

    #needsDisplay: null | (() => void);
    set needsDisplay(newCallback: () => void) {
        this.#needsDisplay = newCallback;
    }

    type:
        | "gate"
        | "control"
        | "not-control"
        | "bloch-inspector"
        | "fidelity-inspector"
        | "density-inspector"
        | "swap";
    label: string;

    #qubitInfo: QubitInfo | null = null;

    get spans(): "cell" | "column" {
        return this.type === "fidelity-inspector" ||
            this.type === "density-inspector"
            ? "column"
            : "cell";
    }

    #stage: SimulationStage | null = null;

    setStage(stage: SimulationStage | null): void {
        if (
            this.type !== "fidelity-inspector" &&
            this.type !== "density-inspector"
        ) {
            return;
        }
        this.#stage = stage;
        // Density needs MathJax bitmaps re-rendered when entries change.
        if (this.type === "density-inspector") {
            this.#rebuildDensityBitmaps();
        }
    }

    #densityMatrixBitmap: HTMLCanvasElement | null = null;
    #densityMatrixTex: string | null = null;

    #rebuildDensityBitmaps() {
        if (!this.#stage) {
            this.#densityMatrixBitmap = null;
            this.#densityMatrixTex = null;
            return;
        }
        const matrix = this.#stage.dirty.density_matrix;
        const tex = formatDensityMatrixLatex(matrix);

        if (tex === this.#densityMatrixTex) return; // unchanged

        this.#densityMatrixTex = tex;

        (async () => {
            try {
                const svg = await getSvgString(tex, false);
                // sizeCSS controls how tall MathJax rasterizes — bump for
                // readability. svgToImageBitmap multiplies by dpr internally.
                const bm = await svgToImageBitmap(svg, 200);
                // Discard if a newer matrix arrived while we were rendering.
                if (this.#densityMatrixTex === tex) {
                    this.#densityMatrixBitmap = bm;
                    this.#needsDisplay?.();
                }
            } catch (e) {
                console.warn("density mathjax failed:", e);
            }
        })();
    }

    clone(): CircuitComponent {
        switch (this.type) {
            case "control":
                return CircuitComponent.createControl();
            case "not-control":
                return CircuitComponent.createNotControl();
            case "bloch-inspector":
                return CircuitComponent.createBlochInspector();
            case "fidelity-inspector":
                return CircuitComponent.createFidelityInspector();
            case "density-inspector":
                return CircuitComponent.createDensityInspector();
            case "swap":
                return CircuitComponent.createSwap();
            case "gate":
                if (this.#primitive) {
                    return CircuitComponent.fromPrimitive(this.#primitive);
                }
                // Custom non-primitive gates would need extra handling here.
                throw new Error("Cannot clone non-primitive gate");
        }
    }

    setQubitInfo(info: QubitInfo | null): void {
        if (this.type !== "bloch-inspector") return;
        this.#qubitInfo = info;
        // No needsDisplay() — Circuit batches a redraw after sim.
    }

    private rerender() {
        if (
            this.type === "control" ||
            this.type === "not-control" ||
            this.type === "bloch-inspector" ||
            this.type === "swap"
        ) {
            return;
        }
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

    private static fidelityColumnWidth = 100;
    private static densityColumnWidth = 220;

    /** Width this component wants its column to be when spanning. */
    get preferredColumnWidth(): number | null {
        if (this.type === "fidelity-inspector") {
            return CircuitComponent.fidelityColumnWidth * devicePixelRatio;
        }
        if (this.type === "density-inspector") {
            return CircuitComponent.densityColumnWidth * devicePixelRatio;
        }
        return null;
    }

    private static swapSizeUnscaled = 20;

    get width(): number {
        if (this.type === "control" || this.type === "not-control") {
            return CircuitComponent.controlSizeUnscaled * devicePixelRatio;
        }
        if (this.type === "swap") {
            return CircuitComponent.swapSizeUnscaled * devicePixelRatio;
        }
        if (
            this.type === "bloch-inspector" ||
            this.type === "fidelity-inspector" ||
            this.type === "density-inspector"
        ) {
            return (
                CircuitComponent.blochInspectorSizeUnscaled * devicePixelRatio
            );
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
        if (this.type === "swap") {
            return CircuitComponent.swapSizeUnscaled * devicePixelRatio;
        }
        if (
            this.type === "bloch-inspector" ||
            this.type === "fidelity-inspector" ||
            this.type === "density-inspector"
        ) {
            return (
                CircuitComponent.blochInspectorSizeUnscaled * devicePixelRatio
            );
        }
        // For column-spanning inspectors, this is just the placeholder cell
        // height (matches a normal gate row). The Circuit's renderer overrides
        // it via drawSpanning(...).
        if (
            this.type === "fidelity-inspector" ||
            this.type === "density-inspector"
        ) {
            return 48 * devicePixelRatio;
        }
        return (
            (this.#bitmap?.height ?? 20.0) +
            2 * CircuitComponent.paddingUnscaled * devicePixelRatio
        );
    }

    draw(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
        const [w, h] = [this.width, this.height];
        ctx.save();

        if (this.type === "bloch-inspector") {
            drawBlochInspector(ctx, w, h, this.#qubitInfo);
            ctx.restore();
            return;
        }

        if (this.type === "fidelity-inspector") {
            drawIconBox(ctx, w, h, this.#bitmap);
            ctx.restore();
            return;
        }

        if (this.type === "density-inspector") {
            drawIconBox(ctx, w, h, this.#bitmap);
            ctx.restore();
            return;
        }

        if (this.type === "swap") {
            const dpr = devicePixelRatio;
            const r = (CircuitComponent.swapSizeUnscaled / 2) * dpr - 2 * dpr;
            const cx = w / 2;
            const cy = h / 2;
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1.75 * dpr;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(cx - r, cy - r);
            ctx.lineTo(cx + r, cy + r);
            ctx.moveTo(cx - r, cy + r);
            ctx.lineTo(cx + r, cy - r);
            ctx.stroke();
            ctx.restore();
            return;
        }

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

    drawSpanning(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        w: number,
        h: number,
    ) {
        if (this.type === "fidelity-inspector") {
            drawFidelityInspector(ctx, w, h, this.#stage);
        } else if (this.type === "density-inspector") {
            drawDensityInspector(
                ctx,
                w,
                h,
                this.#stage,
                this.#densityMatrixBitmap,
            );
        }
    }

    private constructor({
        label,
        latexString,
        type = "gate",
    }: {
        label: string;
        latexString: string;
        type?: "gate" | "control" | "not-control" | "bloch-inspector";
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

    static createBlochInspector(): CircuitComponent {
        return new CircuitComponent({
            label: "Bloch Inspector",
            latexString: "",
            type: "bloch-inspector",
        });
    }

    static createFidelityInspector(): CircuitComponent {
        return new CircuitComponent({
            label: "Fidelity",
            latexString: "F",
            type: "fidelity-inspector",
        });
    }

    static createDensityInspector(): CircuitComponent {
        return new CircuitComponent({
            label: "Density Matrix",
            latexString: "\\rho",
            type: "density-inspector",
        });
    }

    static createSwap(): CircuitComponent {
        return new CircuitComponent({
            label: "Swap",
            latexString: "",
            type: "swap",
        });
    }
}
