import { useContext, useEffect, useRef, useState } from "react";
import { layoutContext } from "../layout";
import { Circuit } from "./circuit";
import {
    CircuitComponent,
    type PrimitiveGate,
} from "../circuit-component/circuit-component";

const VIEWPORT_PADDING = 16;

export const CircuitElement = () => {
    const { contentRect, draggingGate } = useContext(layoutContext);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [circuit] = useState(() => {
        const ROWS = 3;
        const c = new Circuit(ROWS);

        const pattern: PrimitiveGate[] = [
            "hadamard",
            "pauli-x",
            "pauli-y",
            "pauli-z",
        ];

        const N = 10;

        for (let j = 0; j < N; j += 1) {
            const gate = pattern[j % pattern.length];

            const r1 = j % ROWS;
            const r2 = (j + 1) % ROWS;

            if (j % 3 === 2) {
                c.setComponent(r1, j, null);
                c.setComponent(r2, j, null);
            } else if (j % 2 === 0) {
                c.setComponent(r1, j, CircuitComponent.fromPrimitive(gate));
                c.setComponent(r2, j, CircuitComponent.createControl());
            } else {
                c.setComponent(r1, j, CircuitComponent.createNotControl());
                c.setComponent(r2, j, CircuitComponent.fromPrimitive(gate));
            }
        }

        return c;
    });

    const scrollRef = useRef({ x: 0, y: 0 });
    const renderRef = useRef<() => void>(() => {});
    const drawOriginRef = useRef({ x: 0, y: 0 });

    const dropTargetRef = useRef<{
        row: number;
        col: number;
        insert: boolean;
    } | null>(null);

    // NEW: internal drag state (circuit drag, not toolbar drag)
    const internalDragRef = useRef<{
        row: number;
        col: number;
        component: CircuitComponent;
    } | null>(null);

    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio;

        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cx = contentRect.current.x * dpr;
        const cy = contentRect.current.y * dpr;
        const cw = contentRect.current.width * dpr;
        const ch = contentRect.current.height * dpr;

        const pad = VIEWPORT_PADDING * dpr;

        const W = circuit.width;
        const H = circuit.height;

        const aw = cw - 2 * pad;
        const ah = ch - 2 * pad;

        const maxScrollX = Math.max(0, W - aw);
        const maxScrollY = Math.max(0, H - ah);

        scrollRef.current.x = Math.min(
            Math.max(0, scrollRef.current.x),
            maxScrollX,
        );
        scrollRef.current.y = Math.min(
            Math.max(0, scrollRef.current.y),
            maxScrollY,
        );

        const drawX =
            W <= aw ? cx + (cw - W) / 2 : cx + pad - scrollRef.current.x;
        const drawY =
            H <= ah ? cy + (ch - H) / 2 : cy + pad - scrollRef.current.y;

        drawOriginRef.current = { x: drawX, y: drawY };

        ctx.translate(drawX, drawY);

        const ghostGate = draggingGate.current;
        const target = dropTargetRef.current;

        circuit.render(
            ctx,
            ghostGate && target ? { component: ghostGate, target } : undefined,
        );
    };

    renderRef.current = render;

    useEffect(() => {
        circuit.needsDisplay = () => renderRef.current();
        renderRef.current();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const toCircuitCoords = (clientX: number, clientY: number) => {
            const dpr = window.devicePixelRatio;
            const rect = canvas.getBoundingClientRect();

            return {
                x: (clientX - rect.left) * dpr - drawOriginRef.current.x,
                y: (clientY - rect.top) * dpr - drawOriginRef.current.y,
            };
        };

        const hit = (e: MouseEvent) => {
            const { x, y } = toCircuitCoords(e.clientX, e.clientY);
            return circuit.hitTest(x, y);
        };

        const updateCursor = (e: MouseEvent) => {
            if (internalDragRef.current) {
                canvas.style.cursor = "grabbing";
                return;
            }

            const h = hit(e);
            if (h && !h.insert && circuit.getComponentAt(h.row, h.col)) {
                canvas.style.cursor = "grab";
            } else {
                canvas.style.cursor = "default";
            }
        };

        const onPointerDown = (e: MouseEvent) => {
            if (draggingGate.current) return; // toolbar drag takes priority

            const h = hit(e);
            if (!h || h.insert) return;

            const component = circuit.getComponentAt(h.row, h.col);
            if (!component) return;

            internalDragRef.current = {
                row: h.row,
                col: h.col,
                component,
            };

            circuit.removeAt(h.row, h.col);

            canvas.style.cursor = "grabbing";
            renderRef.current();
        };

        const onPointerMove = (e: MouseEvent) => {
            updateCursor(e);

            if (!draggingGate.current && !internalDragRef.current) return;

            const rect = canvas.getBoundingClientRect();
            const inside =
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;

            if (!inside) {
                dropTargetRef.current = null;
                circuit.setPhantomColumn(null);
                renderRef.current();
                return;
            }

            const { x, y } = toCircuitCoords(e.clientX, e.clientY);
            const next = circuit.hitTest(x, y);

            dropTargetRef.current = next;

            circuit.setPhantomColumn(next?.insert ? next.col : null);
            renderRef.current();
        };

        const onPointerUp = () => {
            const gate = draggingGate.current;
            const target = dropTargetRef.current;

            if (gate && target) {
                circuit.drop(target, gate);
            }

            const internal = internalDragRef.current;
            if (internal) {
                if (target) {
                    circuit.drop(target, internal.component);
                } else {
                    circuit.removeAt(internal.row, internal.col);
                }
            }

            draggingGate.current = null;
            internalDragRef.current = null;
            dropTargetRef.current = null;
            circuit.setPhantomColumn(null);

            canvas.style.cursor = "default";
            renderRef.current();
        };

        const onWheel = (e: WheelEvent) => {
            const dpr = window.devicePixelRatio;
            const cw = contentRect.current.width * dpr;
            const ch = contentRect.current.height * dpr;
            const pad = VIEWPORT_PADDING * dpr;

            const aw = cw - 2 * pad;
            const ah = ch - 2 * pad;

            const maxX = Math.max(0, circuit.width - aw);
            const maxY = Math.max(0, circuit.height - ah);

            if (maxX <= 0 && maxY <= 0) return;
            e.preventDefault();

            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;

            scrollRef.current.x = Math.min(
                Math.max(0, scrollRef.current.x + e.deltaX * unit * dpr),
                maxX,
            );

            scrollRef.current.y = Math.min(
                Math.max(0, scrollRef.current.y + e.deltaY * unit * dpr),
                maxY,
            );

            renderRef.current();
        };

        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mousedown", onPointerDown);
        window.addEventListener("mouseup", onPointerUp, true);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            window.removeEventListener("mousemove", onPointerMove);
            window.removeEventListener("mousedown", onPointerDown);
            window.removeEventListener("mouseup", onPointerUp, true);
            canvas.removeEventListener("wheel", onWheel);
        };
    }, [circuit]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        const ro = new ResizeObserver(() => renderRef.current());
        ro.observe(parent);

        return () => ro.disconnect();
    }, []);

    return <canvas ref={canvasRef} className="w-full h-full" />;
};
