import {
    createContext,
    useContext,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";
import { Circuit } from "./circuit/circuit";
import { CircuitComponent } from "./circuit-component/circuit-component";

type CircuitContext = {
    circuit: Circuit;
    setEnergyDecay: (newValue: number) => void;
    setDephasingFactor: (newValue: number) => void;
    setFlipProbability: (newValue: number) => void;
    setGateTime: (newValue: number) => void;
};

const circuitContext = createContext<CircuitContext>(
    undefined as any as CircuitContext,
);

export const useCircuit = () => {
    return useContext(circuitContext);
};

export const CircuitProvider = ({ children }: PropsWithChildren) => {
    const [circuit] = useState(() => {
        const ROWS = 2;
        const c = new Circuit(ROWS);

        c.setStartingState(0, "0");
        c.setStartingState(1, "0");

        c.setComponent(0, 0, CircuitComponent.createBlochInspector());

        c.setComponent(0, 1, CircuitComponent.fromPrimitive("hadamard"));

        c.setComponent(0, 2, CircuitComponent.createBlochInspector());

        c.setComponent(0, 3, CircuitComponent.createControl());
        c.setComponent(1, 3, CircuitComponent.fromPrimitive("pauli-x"));

        return c;
    });

    const setDephasingFactor = (newValue: number) => {
        circuit.noiseModel = { ...circuit.noiseModel, t2: newValue };
    };
    const setEnergyDecay = (newValue: number) => {
        circuit.noiseModel = { ...circuit.noiseModel, t1: newValue };
    };
    const setFlipProbability = (newValue: number) => {
        circuit.noiseModel = { ...circuit.noiseModel, p_depolarize: newValue };
    };
    const setGateTime = (newValue: number) => {
        circuit.noiseModel = { ...circuit.noiseModel, gate_time: newValue };
    };

    return (
        <circuitContext.Provider
            value={{
                circuit,
                setDephasingFactor,
                setEnergyDecay,
                setFlipProbability,
                setGateTime,
            }}
        >
            {children}
        </circuitContext.Provider>
    );
};
