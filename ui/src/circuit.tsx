import {
    createContext,
    useContext,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";
import { Circuit } from "./circuit/circuit";
import type { NoiseModel } from "./simulator/bindings/NoiseModel";
import { CircuitComponent } from "./circuit-component/circuit-component";

type CircuitContext = {
    circuit: Circuit;
    noiseModel: NoiseModel;
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

    const [noiseModel, setNoiseModel] = useState<NoiseModel>({
        t1: 50.0,
        t2: 70.0,
        p_depolarize: 0.001,
        gate_time: 0.1,
    });

    const setDephasingFactor = (newValue: number) => {
        setNoiseModel((p) => ({ ...p, t2: newValue }));
    };
    const setEnergyDecay = (newValue: number) => {
        setNoiseModel((p) => ({ ...p, t1: newValue }));
    };
    const setFlipProbability = (newValue: number) => {
        setNoiseModel((p) => ({ ...p, p_depolarize: newValue }));
    };
    const setGateTime = (newValue: number) => {
        setNoiseModel((p) => ({ ...p, gate_time: newValue }));
    };

    return (
        <circuitContext.Provider
            value={{
                circuit,
                noiseModel,
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
