import { useEffect, useRef, useState } from "react";

// Adjust this import to wherever you keep the mathjax helpers.
import { getSvgString, svgToImageBitmap } from "../MathJax";

type Direction3D = { phi: number; theta: number };

type CardinalLabel = {
    dir: number[];
    canvas: HTMLCanvasElement;
};

const CARDINAL_POINTS: { dir: number[]; tex: string }[] = [
    { dir: [0, 0, 1], tex: "|0\\rangle" },
    { dir: [0, 0, -1], tex: "|1\\rangle" },
    { dir: [1, 0, 0], tex: "|{+}\\rangle" },
    { dir: [-1, 0, 0], tex: "|{-}\\rangle" },
    { dir: [0, 1, 0], tex: "|{+}i\\rangle" },
    { dir: [0, -1, 0], tex: "|{-}i\\rangle" },
];

const sph = (phi: number, theta: number): number[] => {
    const s = Math.sin(theta);
    return [s * Math.cos(phi), s * Math.sin(phi), Math.cos(theta)];
};

const norm = (v: number[]): number[] => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
};

const cross = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

const dot = (a: number[], b: number[]): number =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

type Projection = {
    cam: number[];
    project: (p: number[]) => [number, number];
};

const setupProjection = (camera: Direction3D): Projection => {
    const cam = norm(sph(camera.phi, camera.theta));
    const tmpUp = Math.abs(cam[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = norm(cross(tmpUp, cam));
    const up = cross(cam, right);
    return { cam, project: (p) => [dot(p, right), dot(p, up)] };
};

const K = (4 / 3) * Math.tan(Math.PI / 8);

const renderCircle = (
    context: CanvasRenderingContext2D,
    radius: number,
    normal: Direction3D,
    camera: Direction3D,
) => {
    const n = norm(sph(normal.phi, normal.theta));
    const tangent = norm(
        Math.abs(n[2]) < 0.9 ? cross([0, 0, 1], n) : cross([0, 1, 0], n),
    );
    const bitan = cross(n, tangent);

    const cam = norm(sph(camera.phi, camera.theta));
    const tmpUp = Math.abs(cam[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = norm(cross(tmpUp, cam));
    const up = cross(cam, right);
    const project = (p: number[]): [number, number] => [
        dot(p, right),
        dot(p, up),
    ];

    const circlePoint = (x: number, y: number): number[] => [
        tangent[0] * x + bitan[0] * y,
        tangent[1] * x + bitan[1] * y,
        tangent[2] * x + bitan[2] * y,
    ];

    const tDot = dot(tangent, cam);
    const bDot = dot(bitan, cam);
    const offset = Math.atan2(-tDot, bDot);
    const isCam = Math.abs(dot(n, cam) - 1) < 1e-6;

    const seg = (a: number) => {
        const c0 = Math.cos(a),
            s0 = Math.sin(a);
        const c1 = Math.cos(a + Math.PI / 2),
            s1 = Math.sin(a + Math.PI / 2);
        const r = radius;
        return [
            [r * c0, r * s0],
            [r * c0 + K * r * -s0, r * s0 + K * r * c0],
            [r * c1 + K * r * s1, r * s1 + K * r * -c1],
            [r * c1, r * s1],
        ] as [number, number][];
    };

    const facing = (a: number) => {
        const m =
            Math.cos(a + Math.PI / 4) * tDot + Math.sin(a + Math.PI / 4) * bDot;
        return m >= 0;
    };

    const drawSegs = (segs: [number, number][][]) => {
        for (const [s, c1, c2, e] of segs) {
            const [sx, sy] = project(circlePoint(s[0], s[1]));
            const [x1, y1] = project(circlePoint(c1[0], c1[1]));
            const [x2, y2] = project(circlePoint(c2[0], c2[1]));
            const [ex, ey] = project(circlePoint(e[0], e[1]));
            context.beginPath();
            context.moveTo(sx, sy);
            context.bezierCurveTo(x1, y1, x2, y2, ex, ey);
            context.stroke();
        }
    };

    const front: [number, number][][] = [];
    const back: [number, number][][] = [];
    for (let i = 0; i < 4; i++) {
        const a = offset + i * (Math.PI / 2);
        const s = seg(a);
        (isCam || facing(a) ? front : back).push(s);
    }

    context.save();
    context.translate(radius, radius);

    context.lineWidth = 1;
    context.strokeStyle = "rgba(0, 0, 0, 0.55)";
    context.setLineDash([4, 4]);
    drawSegs(back);

    context.lineWidth = 2;
    context.strokeStyle = "rgba(0, 0, 0, 1)";
    context.setLineDash([]);
    drawSegs(front);

    context.restore();
};

const renderStateLine = (
    ctx: CanvasRenderingContext2D,
    proj: Projection,
    dir: number[],
    R: number,
) => {
    const tip = [dir[0] * R, dir[1] * R, dir[2] * R];
    const facing = dot(dir, proj.cam) >= 0;
    const [sx, sy] = proj.project([0, 0, 0]);
    const [ex, ey] = proj.project(tip);

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#000";
    ctx.setLineDash(facing ? [] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
};

const renderStateDot = (
    ctx: CanvasRenderingContext2D,
    proj: Projection,
    dir: number[],
    R: number,
    dpr: number,
) => {
    const tip = [dir[0] * R, dir[1] * R, dir[2] * R];
    const facing = dot(dir, proj.cam) >= 0;
    const [x, y] = proj.project(tip);

    ctx.save();
    if (facing) {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
};

// ---------- phase arc ----------

const renderPhaseArc = (
    ctx: CanvasRenderingContext2D,
    proj: Projection,
    center: number[],
    normalDir: number[],
    arcR: number,
    sweep: number,
    color: string,
    dpr: number,
) => {
    if (Math.abs(sweep) < 1e-6) return;

    const n = normalDir;
    const tangent = norm(
        Math.abs(n[2]) < 0.9 ? cross([0, 0, 1], n) : cross([0, 1, 0], n),
    );
    const bitan = cross(n, tangent);

    const arcPoint = (t: number): number[] => {
        const c = Math.cos(t);
        const s = Math.sin(t);
        return [
            center[0] + arcR * (c * tangent[0] + s * bitan[0]),
            center[1] + arcR * (c * tangent[1] + s * bitan[1]),
            center[2] + arcR * (c * tangent[2] + s * bitan[2]),
        ];
    };

    const N = 48;
    const pts: [number, number][] = [];
    const facing: boolean[] = [];
    for (let i = 0; i <= N; i++) {
        const t = (i / N) * sweep;
        const p = arcPoint(t);
        pts.push(proj.project(p));
        facing.push(dot(p, proj.cam) >= 0);
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;

    let i = 0;
    while (i < N) {
        const segFacing = facing[i] && facing[i + 1];
        let j = i + 1;
        while (j < N && facing[j] && facing[j + 1] === segFacing) {
            j++;
        }
        ctx.setLineDash(segFacing ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        for (let k = i + 1; k <= j; k++) {
            ctx.lineTo(pts[k][0], pts[k][1]);
        }
        ctx.stroke();
        i = j;
    }

    const last = pts[N];
    const prev = pts[N - 1];
    const dx = last[0] - prev[0];
    const dy = last[1] - prev[1];
    const len = Math.hypot(dx, dy);

    if (len > 1e-3) {
        const ux = dx / len;
        const uy = dy / len;
        const a = Math.PI / 6;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const w1x = -ux * ca + uy * sa;
        const w1y = -ux * sa - uy * ca;
        const w2x = -ux * ca - uy * sa;
        const w2y = ux * sa - uy * ca;
        const arrow = 7 * dpr;

        ctx.setLineDash(facing[N] ? [] : [3, 3]);
        ctx.beginPath();
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(last[0] + arrow * w1x, last[1] + arrow * w1y);
        ctx.moveTo(last[0], last[1]);
        ctx.lineTo(last[0] + arrow * w2x, last[1] + arrow * w2y);
        ctx.stroke();
    }

    ctx.restore();
};

// ---------- cardinal labels ----------

const renderLabel = (
    ctx: CanvasRenderingContext2D,
    proj: Projection,
    dir: number[],
    R: number,
    label: HTMLCanvasElement,
    dpr: number,
) => {
    if (dot(dir, proj.cam) <= 0) return; // back-facing — skip

    const tip = [dir[0] * R, dir[1] * R, dir[2] * R];
    const [px, py] = proj.project(tip);

    // Push the label outward in screen space so it doesn't sit on top of
    // the wireframe / dot. "Outward" = away from the sphere's projected
    // center (which is the local origin after the translate(R, R) below).
    const len = Math.hypot(px, py);
    const offsetPx = 12 * dpr;
    const ox = len > 1e-3 ? (px / len) * offsetPx : 0;
    const oy = len > 1e-3 ? (py / len) * offsetPx : 0;

    const w = label.width;
    const h = label.height;
    ctx.drawImage(label, px + ox - w / 2, py + oy - h / 2);
};

// ---------- component ----------

type SliderProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
};

const Slider = ({ label, value, min, max, onChange }: SliderProps) => (
    <div>
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#666",
                marginBottom: 4,
            }}
        >
            <span>{label}</span>
            <span>{Math.round(value)}°</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(e) => onChange(+e.target.value)}
            style={{ width: "100%" }}
        />
    </div>
);

export const BlochSphereDemo = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [theta, setTheta] = useState(60);
    const [phi, setPhi] = useState(45);
    const [gphase, setGphase] = useState(60);
    const [camPhi, setCamPhi] = useState(35);
    const [camTh, setCamTh] = useState(70);

    const [labels, setLabels] = useState<CardinalLabel[]>([]);

    // Load the cardinal-point labels once via MathJax. A re-render kicks in
    // automatically once the labels resolve.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const loaded = await Promise.all(
                    CARDINAL_POINTS.map(async ({ dir, tex }) => {
                        const svg = await getSvgString(tex, false);
                        // size is in CSS px; svgToImageBitmap multiplies by dpr internally.
                        const canvas = await svgToImageBitmap(svg, 14);
                        return { dir, canvas };
                    }),
                );
                if (!cancelled) setLabels(loaded);
            } catch (err) {
                console.warn("Failed to load Bloch sphere labels:", err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const t = (theta * Math.PI) / 180;
            const p = (phi * Math.PI) / 180;
            const g = (gphase * Math.PI) / 180;
            const camera: Direction3D = {
                phi: (camPhi * Math.PI) / 180,
                theta: (camTh * Math.PI) / 180,
            };

            const size = Math.min(canvas.width, canvas.height);
            const labelMargin = 24 * dpr; // room for cardinal labels outside the sphere
            const R = size / 2 - labelMargin;

            ctx.save();
            if (canvas.width < canvas.height) {
                ctx.translate(0, (canvas.height - size) / 2);
            } else {
                ctx.translate((canvas.width - size) / 2, 0);
            }

            renderCircle(ctx, R, camera, camera);
            renderCircle(ctx, R, { phi: 0, theta: 0 }, camera);
            renderCircle(ctx, R, { phi: 0, theta: Math.PI / 2 }, camera);
            renderCircle(
                ctx,
                R,
                { phi: Math.PI / 2, theta: Math.PI / 2 },
                camera,
            );

            const stateDir = [
                Math.sin(t) * Math.cos(p),
                Math.sin(t) * Math.sin(p),
                Math.cos(t),
            ];
            const proj = setupProjection(camera);

            ctx.save();
            ctx.translate(R, R);

            renderStateLine(ctx, proj, stateDir, R);

            const tip = [stateDir[0] * R, stateDir[1] * R, stateDir[2] * R];
            renderPhaseArc(
                ctx,
                proj,
                tip,
                stateDir,
                R * 0.18,
                g,
                "#CC6600",
                dpr,
            );

            renderStateDot(ctx, proj, stateDir, R, dpr);

            for (const { dir, canvas: labelCanvas } of labels) {
                renderLabel(ctx, proj, dir, R, labelCanvas, dpr);
            }

            ctx.restore();
            ctx.restore();
        };

        draw();
        window.addEventListener("resize", draw);
        return () => window.removeEventListener("resize", draw);
    }, [theta, phi, gphase, camPhi, camTh, labels]);

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 220px",
                gap: 20,
                alignItems: "center",
                padding: 20,
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                background: "#fff",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: "100%",
                        maxWidth: 360,
                        aspectRatio: "1 / 1",
                    }}
                />
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    minWidth: 0,
                }}
            >
                <Slider
                    label="θ (polar)"
                    value={theta}
                    min={0}
                    max={180}
                    onChange={setTheta}
                />
                <Slider
                    label="φ (local phase)"
                    value={phi}
                    min={-180}
                    max={180}
                    onChange={setPhi}
                />
                <Slider
                    label="Global phase"
                    value={gphase}
                    min={-180}
                    max={180}
                    onChange={setGphase}
                />
                <div
                    style={{
                        height: 1,
                        background: "#e5e5e5",
                        margin: "4px 0",
                    }}
                />
                <Slider
                    label="Camera azimuth"
                    value={camPhi}
                    min={-180}
                    max={180}
                    onChange={setCamPhi}
                />
                <Slider
                    label="Camera elevation"
                    value={camTh}
                    min={1}
                    max={179}
                    onChange={setCamTh}
                />
            </div>
        </div>
    );
};
