import { useContext, useEffect, useRef, useState } from "react";
import { CircuitComponent } from "./circuit-component";
import { SHADOW_STYLE } from "../styles";
import { layoutContext } from "../layout";
import { createPortal } from "react-dom";

export const GateToolbarItem = ({ gate }: { gate: CircuitComponent }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const { dragRef, setDragging, draggingGate } = useContext(layoutContext);

    const needsDisplay = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Only require assets if it's a gate; controls draw themselves via Canvas API
        if (gate.type === "gate" && (!gate.svg || !gate.bitmap)) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = devicePixelRatio;

        canvas.width = gate.width;
        canvas.height = gate.height;

        canvas.style.width = `${gate.width / dpr}px`;
        canvas.style.height = `${gate.height / dpr}px`;

        gate.draw(ctx);
    };

    useEffect(() => {
        gate.needsDisplay = needsDisplay;
        needsDisplay();
    }, []);

    const [showPortal, setShowPortal] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    return (
        <div className="w-full flex items-center overflow-visible py-1">
            <p className="font-medium text-sm">{gate.label}</p>
            <div
                className="ml-auto cursor-grab shrink-0"
                onMouseDown={(e) => {
                    if (!canvasRef.current) return;

                    const { width, height } =
                        canvasRef.current.getBoundingClientRect();
                    setPosition({
                        x: e.clientX - width / 2,
                        y: e.clientY - height / 2,
                    });

                    setShowPortal(true);

                    const follow = (e: MouseEvent) => {
                        if (canvasRef.current)
                            setPosition({
                                x: e.clientX - width / 2,
                                y: e.clientY - height / 2,
                            });
                    };
                    const hidePortal = () => {
                        setShowPortal(false);
                        setDragging(false);

                        draggingGate.current = null;

                        window.removeEventListener("mouseup", hidePortal);
                        window.removeEventListener("mousemove", follow);
                    };

                    setDragging(true);
                    draggingGate.current = gate.clone();

                    window.addEventListener("mouseup", hidePortal);
                    window.addEventListener("mousemove", follow);
                }}
                onMouseUp={() => {
                    setShowPortal(false);
                }}
            >
                {showPortal &&
                    dragRef.current &&
                    createPortal(
                        <canvas
                            className={`${SHADOW_STYLE}`}
                            style={{
                                cursor: "grabbing",
                                position: "absolute",
                                top: `${position.y}px`,
                                left: `${position.x}px`,
                            }}
                            ref={(node) => {
                                if (!node || !canvasRef.current) return;

                                const src = canvasRef.current;
                                const ctx = node.getContext("2d");
                                if (!ctx) return;

                                node.width = src.width;
                                node.height = src.height;

                                node.style.width = src.style.width;
                                node.style.height = src.style.height;

                                ctx.drawImage(src, 0, 0);
                            }}
                        />,
                        dragRef.current,
                    )}
                <canvas
                    ref={canvasRef}
                    className="block overflow-visible"
                ></canvas>
            </div>
        </div>
    );
};
