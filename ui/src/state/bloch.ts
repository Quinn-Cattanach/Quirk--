import type { RenderingOptions } from "../rendering";
import type { SingleQbitState } from "./single-qbit";

export type Direction3D = {
    phi: number;
    theta: number;
};

export type BlochRenderingOptions = RenderingOptions & {
    camera: Direction3D;
    scale: number;
};

const CIRCULAR_CONTROL_RATIO_4_SEGMENT = (4 / 3) * Math.tan(Math.PI / 8);

export function renderCircle(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    radius: number,
    normal: Direction3D,
    camera: Direction3D,
) {
    const k = CIRCULAR_CONTROL_RATIO_4_SEGMENT;

    const sphericalToCartesian = ({ phi, theta }: Direction3D) => {
        const sinT = Math.sin(theta);
        return [sinT * Math.cos(phi), sinT * Math.sin(phi), Math.cos(theta)];
    };
    const normalize = (v: number[]) => {
        const l = Math.hypot(...v);
        return v.map((x) => x / l);
    };
    const cross = (a: number[], b: number[]) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
    const dot = (a: number[], b: number[]) =>
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    // --- circle plane basis ---
    const n = normalize(sphericalToCartesian(normal));
    const tangent = normalize(
        Math.abs(n[2]) < 0.9 ? cross([0, 0, 1], n) : cross([0, 1, 0], n),
    );
    const bitangent = cross(n, tangent);

    // circlePoint maps (cos t, sin t) * radius → 3D point on the circle
    const circlePoint = (x: number, y: number) => [
        tangent[0] * x + bitangent[0] * y,
        tangent[1] * x + bitangent[1] * y,
        tangent[2] * x + bitangent[2] * y,
    ];

    // --- camera ---
    const cam = normalize(sphericalToCartesian(camera));
    const tmpUp = Math.abs(cam[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = normalize(cross(tmpUp, cam));
    const up = cross(cam, right);
    const project = (p: number[]) => [dot(p, right), dot(p, up)];

    // --- find the rotation offset so segment boundaries hit silhouette points ---
    // A point on the circle at angle t in circle-plane coords is:
    //   P(t) = tangent * r*cos(t) + bitangent * r*sin(t)
    // It's on the silhouette when dot(P(t), cam) = 0:
    //   cos(t) * dot(tangent, cam) + sin(t) * dot(bitangent, cam) = 0
    // => t = atan2(-dot(tangent, cam), dot(bitangent, cam))  (+ PI for the other)
    // Our 4 segments each span a quarter turn. We rotate by `offset` so the
    // first segment boundary starts exactly at a silhouette point.
    const tDotCam = dot(tangent, cam);
    const bDotCam = dot(bitangent, cam);
    // angle of the first silhouette crossing
    const silhouetteAngle = Math.atan2(-tDotCam, bDotCam);
    // snap to the nearest quarter-turn boundary (segments are 90° each)
    const offset = silhouetteAngle; // start the segment sweep here

    const isCameraCircle = Math.abs(dot(n, cam) - 1) < 1e-6;

    // Build a rotated segment: parameter goes from offset + i*PI/2 to offset + (i+1)*PI/2
    // We approximate each quarter-arc with a cubic bezier using the standard k factor.
    // For a quarter arc from angle a to angle a+PI/2:
    //   P0 = (cos a, sin a)
    //   P3 = (cos(a+PI/2), sin(a+PI/2)) = (-sin a, cos a)
    //   P1 = P0 + k * (-sin a, cos a)   [tangent direction at P0]
    //   P2 = P3 + k * (sin a, -cos a)   [tangent direction reversed at P3, pointing back]
    // Wait — control points for arc from a to a+PI/2:
    //   P1 = P0 + k*(-sin(a), cos(a))
    //   P2 = P3 - k*(-sin(a+PI/2), cos(a+PI/2)) = P3 + k*(-cos(a), -sin(a))
    //     but -sin(a+PI/2)=-cos(a), cos(a+PI/2)=-sin(a)
    //     so tangent at P3 is (-sin(a+PI/2), cos(a+PI/2)) = (-cos a, -sin a)
    //   P2 = P3 + k*(cos a, sin a)   ← back-tangent at P3

    const buildSegment = (a: number) => {
        const cos0 = Math.cos(a),
            sin0 = Math.sin(a);
        const cos1 = Math.cos(a + Math.PI / 2),
            sin1 = Math.sin(a + Math.PI / 2);
        // start, cp1, cp2, end  — in circle-plane (u,v) coords * radius
        const r = radius;
        return [
            [r * cos0, r * sin0],
            [r * cos0 + k * r * -sin0, r * sin0 + k * r * cos0],
            [r * cos1 + k * r * sin1, r * sin1 + k * r * -cos1],
            [r * cos1, r * sin1],
        ] as [
            [number, number],
            [number, number],
            [number, number],
            [number, number],
        ];
    };

    // Determine if a segment (starting at angle a) is front-facing:
    // midpoint of the arc is at a + PI/4, so its 3D point dotted with cam:
    const segmentFacing = (a: number): boolean => {
        const mid =
            Math.cos(a + Math.PI / 4) * tDotCam +
            Math.sin(a + Math.PI / 4) * bDotCam;
        return mid >= 0;
    };

    const drawSegs = (
        segs: [
            [number, number],
            [number, number],
            [number, number],
            [number, number],
        ][],
    ) => {
        for (const [start, c1, c2, end] of segs) {
            const [sx, sy] = project(circlePoint(...start));
            const [x1, y1] = project(circlePoint(...c1));
            const [x2, y2] = project(circlePoint(...c2));
            const [ex, ey] = project(circlePoint(...end));
            context.beginPath();
            context.moveTo(sx, sy);
            context.bezierCurveTo(x1, y1, x2, y2, ex, ey);
            context.stroke();
        }
    };

    const frontSegs: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ][] = [];
    const backSegs: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ][] = [];

    for (let i = 0; i < 4; i++) {
        const a = offset + i * (Math.PI / 2);
        const seg = buildSegment(a);
        if (isCameraCircle || segmentFacing(a)) {
            frontSegs.push(seg);
        } else {
            backSegs.push(seg);
        }
    }

    context.save();
    context.translate(radius, radius);

    context.lineWidth = 1;
    context.strokeStyle = "#000000AA";
    context.setLineDash([4, 4]);

    drawSegs(backSegs);

    context.lineWidth = 2;
    context.strokeStyle = "#000000FF";
    context.setLineDash([]);
    drawSegs(frontSegs);

    context.restore();
}

export function renderBloch(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    state: SingleQbitState,
    options: BlochRenderingOptions,
) {
    context.save();
    const size = Math.min(options.width, options.height);

    if (options.width < options.height) {
        context.translate(0, (options.height - size) / 2);
    } else {
        context.translate((options.width - size) / 2, 0);
    }

    context.beginPath();
    context.fillStyle = "#FF0000";

    renderCircle(context, size / 2, options.camera, options.camera);

    renderCircle(
        context,
        size / 2,
        {
            phi: 0,
            theta: 0,
        },
        options.camera,
    );

    renderCircle(
        context,
        size / 2,
        {
            phi: 0,
            theta: Math.PI / 2,
        },
        options.camera,
    );

    renderCircle(
        context,
        size / 2,
        {
            phi: Math.PI / 2,
            theta: Math.PI / 2,
        },
        options.camera,
    );

    context.restore();
}
