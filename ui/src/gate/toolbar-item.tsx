import { useContext, useEffect, useRef, useState } from "react";
import { CircuitComponent } from "./gate";
import { SHADOW_STYLE } from "../styles";
import { layoutContext } from "../layout";
import { createPortal } from "react-dom";

function cloneCanvas(source: HTMLCanvasElement) {
    const clone = document.createElement("canvas");

    clone.width = source.width;
    clone.height = source.height;

    const ctx = clone.getContext("2d");
    if (ctx) {
        ctx.drawImage(source, 0, 0);
    }

    clone.style.width = source.style.width;
    clone.style.height = source.style.height;

    return clone;
}

export const GateToolbarItem = ({ gate }: { gate: CircuitComponent }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const { dragRef, setDragging } = useContext(layoutContext);

    const needsDisplay = () => {
        const canvas = canvasRef.current;
        if (!canvas || !gate.svg || !gate.bitmap) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = devicePixelRatio;

        canvas.width = gate.width;
        canvas.height = gate.height;

        console.log(`w: ${gate.width}, h: ${gate.height}`);

        canvas.style.width = `${gate.width / dpr}px`;
        canvas.style.height = `${gate.height / dpr}px`;

        gate.draw(ctx);

        console.log(canvas.style.width);
    };

    useEffect(() => {
        gate.needsDisplay = needsDisplay;
        needsDisplay();
    }, []);

    const [showPortal, setShowPortal] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    return (
        <div className="w-full flex items-center overflow-visible">
            <p className="font-medium text-sm">{gate.label}</p>
            <div
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

                        window.removeEventListener("mouseup", hidePortal);
                        window.removeEventListener("mousemove", follow);
                    };

                    setDragging(true);

                    window.addEventListener("mouseup", hidePortal);
                    window.addEventListener("mousemove", follow);
                }}
                onMouseUp={() => {
                    setShowPortal(false);
                }}
                className={`ml-auto cursor-grab`}
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
                <canvas ref={canvasRef}></canvas>
            </div>
        </div>
    );
};
