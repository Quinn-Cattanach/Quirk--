import { useEffect, useRef } from "react";
import { Gate } from "./gate";

export const GateToolbarItem = ({ gate }: { gate: Gate }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    return (
        <div className="w-full flex items-center">
            <p className="font-bold text-sm">{gate.label}</p>
            <canvas className="ml-auto cursor-grab" ref={canvasRef}></canvas>
        </div>
    );
};
