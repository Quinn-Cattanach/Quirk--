import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { layoutContext } from "../layout";
import { Circuit } from "./circuit";
import {
    CircuitComponent,
    type PrimitiveGate,
} from "../circuit-component/circuit-component";
import { SHADOW_STYLE } from "../styles";
import { useCircuit } from "../circuit";

const VIEWPORT_PADDING = 16;
const DRAG_THRESHOLD_PX = 4;

type DropTarget = { row: number; col: number; insert: boolean };
type DragPortal = {
    component: CircuitComponent;
    x: number;
    y: number;
    cssWidth: number;
    cssHeight: number;
};

export const CircuitElement = () => {
    const { contentRect, draggingGate, dragRef, setDragging } =
        useContext(layoutContext);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const { circuit } = useCircuit();

    const scrollRef = useRef({ x: 0, y: 0 });
    const renderRef = useRef<() => void>(() => {});
    const drawOriginRef = useRef({ x: 0, y: 0 });
    const dropTargetRef = useRef<DropTarget | null>(null);

    // Mouse-down on a gate; promotes to a real drag once movement crosses the threshold.
    const pendingDragRef = useRef<{
        row: number;
        col: number;
        component: CircuitComponent;
        startX: number;
        startY: number;
    } | null>(null);

    // True iff the active drag was started from inside the circuit (vs. from the toolbar).
    // Used so we don't stomp on toolbar-owned state (setDragging, the floating ghost) on mouseup.
    const internalDragOwnedRef = useRef(false);

    const [dragPortal, setDragPortal] = useState<DragPortal | null>(null);

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

        const findComponentAt = (clientX: number, clientY: number) => {
            const { x, y } = toCircuitCoords(clientX, clientY);
            const spanning = circuit.findSpanningAt(x, y);
            if (spanning) return spanning;

            for (let i = 0; i < circuit.numQbit; i += 1) {
                const rowH = circuit.heightOfRow(i);
                const rowTop = circuit.rowCenterY(i) - rowH / 2;
                if (y < rowTop || y >= rowTop + rowH) continue;
                for (let j = 0; j < circuit.numColumns; j += 1) {
                    const colW = circuit.widthOfColumn(j);
                    const colLeft = circuit.columnCenterX(j) - colW / 2;
                    if (x < colLeft || x >= colLeft + colW) continue;
                    const component = circuit.getComponentAt(i, j);
                    if (component) return { row: i, col: j, component };
                    return null;
                }
            }
            return null;
        };

        const hit = (e: MouseEvent) => {
            const { x, y } = toCircuitCoords(e.clientX, e.clientY);
            return circuit.hitTest(x, y);
        };

        const startInternalDrag = (e: MouseEvent) => {
            const pending = pendingDragRef.current;
            if (!pending) return;

            const dpr = window.devicePixelRatio;
            const cssW = pending.component.width / dpr;
            const cssH = pending.component.height / dpr;

            circuit.removeAt(pending.row, pending.col);

            draggingGate.current = pending.component;
            internalDragOwnedRef.current = true;
            setDragging(true);

            document.body.style.cursor = "grabbing"; // ← add

            setDragPortal({
                component: pending.component,
                x: e.clientX - cssW / 2,
                y: e.clientY - cssH / 2,
                cssWidth: cssW,
                cssHeight: cssH,
            });

            pendingDragRef.current = null;
        };

        const updateCursor = (e: MouseEvent) => {
            if (draggingGate.current) {
                canvas.style.cursor = "grabbing";
                return;
            }
            canvas.style.cursor = findComponentAt(e.clientX, e.clientY)
                ? "grab"
                : "default";
        };

        const onPointerDown = (e: MouseEvent) => {
            if (draggingGate.current) return;
            const found = findComponentAt(e.clientX, e.clientY);
            if (!found) return;

            pendingDragRef.current = {
                row: found.row,
                col: found.col,
                component: found.component,
                startX: e.clientX,
                startY: e.clientY,
            };
        };

        const onPointerMove = (e: MouseEvent) => {
            // Promote a pending mouse-down into a real drag once the cursor moves enough.
            const pending = pendingDragRef.current;
            if (pending) {
                const dx = e.clientX - pending.startX;
                const dy = e.clientY - pending.startY;
                if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
                    startInternalDrag(e);
                }
            }

            // Slide the floating ghost along with the cursor.
            if (internalDragOwnedRef.current) {
                setDragPortal((prev) =>
                    prev
                        ? {
                              ...prev,
                              x: e.clientX - prev.cssWidth / 2,
                              y: e.clientY - prev.cssHeight / 2,
                          }
                        : prev,
                );
            }

            updateCursor(e);

            if (!draggingGate.current) return;

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
            // Click without drag — drop the pending intent and bail.
            pendingDragRef.current = null;

            const gate = draggingGate.current;
            const target = dropTargetRef.current;

            if (gate && target) {
                circuit.drop(target, gate);
            }
            // For an internal drag with no valid target: gate is already
            // out of the circuit, so doing nothing means it's discarded.

            draggingGate.current = null;
            dropTargetRef.current = null;
            circuit.setPhantomColumn(null);

            // Only tear down portal/dragging state if WE put it up.
            if (internalDragOwnedRef.current) {
                internalDragOwnedRef.current = false;
                setDragPortal(null);
                setDragging(false);
                document.body.style.cursor = ""; // ← add
            }

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

    return (
        <>
            <canvas ref={canvasRef} className="w-full h-full" />
            {dragPortal &&
                dragRef.current &&
                createPortal(
                    <DragGhostCanvas portal={dragPortal} />,
                    dragRef.current,
                )}
        </>
    );
};

// Floating canvas that follows the cursor during an in-circuit drag.
// Position is updated by the parent re-rendering with a new `portal`; the
// gate itself is only re-painted when its identity changes.
const DragGhostCanvas = ({ portal }: { portal: DragPortal }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const ctx = node.getContext("2d");
        if (!ctx) return;

        node.width = portal.component.width;
        node.height = portal.component.height;
        node.style.width = `${portal.cssWidth}px`;
        node.style.height = `${portal.cssHeight}px`;

        ctx.clearRect(0, 0, node.width, node.height);
        portal.component.draw(ctx);
    }, [portal.component, portal.cssWidth, portal.cssHeight]);

    return (
        <canvas
            ref={ref}
            className={SHADOW_STYLE}
            style={{
                position: "absolute",
                top: `${portal.y}px`,
                left: `${portal.x}px`,
                cursor: "grabbing",
                pointerEvents: "none",
            }}
        />
    );
};
