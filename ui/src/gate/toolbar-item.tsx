import type { Gate } from "./gate";

export const GateToolbarItem = ({ gate }: { gate: Gate }) => {
    return (
        <div className="w-full h-10 flex items-center">
            <p className="font-bold text-sm">Hadamard</p>
            <canvas className="ml-auto w-10 h-10"></canvas>
        </div>
    );
};
