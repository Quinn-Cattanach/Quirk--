import { Plus } from "lucide-react";
import {
    CircuitComponent,
    primitiveGates,
} from "../circuit-component/circuit-component";
import { GateToolbarItem } from "../circuit-component/toolbar-item";
import { Toolbar, type ToolbarItem } from "./toolbar-layout";
import { useCircuit } from "../circuit";
import { type KetType, STARTING_STATES } from "../circuit/circuit";
import { useEffect, useMemo, useState } from "react";

export const InspectorToolbar = () => {
    const {
        circuit,
        setDephasingFactor,
        setEnergyDecay,
        setFlipProbability,
        setGateTime,
    } = useCircuit();

    const [nQbit, setNQbit] = useState(circuit.numQbit);

    const [startingStates, setStartingStates] = useState<KetType[]>(() =>
        Array.from({ length: circuit.numQbit }, (_, i) =>
            circuit.getStartingState(i),
        ),
    );

    const noiseModel = circuit.noiseModel;

    useEffect(() => {
        setStartingStates((prev) => {
            if (prev.length === nQbit) return prev;
            const next = [...prev];
            for (let i = prev.length; i < nQbit; i++) {
                next[i] = circuit.getStartingState(i);
            }
            return next;
        });
    }, [nQbit, circuit]);

    const circuitStateComponent: ToolbarItem = useMemo(() => {
        return {
            type: "collapse-group",
            label: "Starting States",
            initiallyCollapsed: false,
            items: [
                ...Array.from({ length: nQbit }).map((_, i) => ({
                    type: "custom",
                    element: (
                        <div className="flex" key={`qbit-${i}`}>
                            <p>Qbit {i + 1}</p>
                            <select
                                className="ml-auto bg-white p-2 cursor-pointer"
                                value={startingStates[i] || STARTING_STATES[0]}
                                onChange={(e) => {
                                    const val = e.target.value as KetType;
                                    // Update Circuit Object
                                    circuit.setStartingState(i, val);
                                    // Update Local State
                                    setStartingStates((p) => {
                                        const next = [...p];
                                        next[i] = val;
                                        return next;
                                    });
                                }}
                            >
                                {STARTING_STATES.map((state) => (
                                    <option key={state}>{state}</option>
                                ))}
                            </select>
                        </div>
                    ),
                })),
                { type: "divider" },
                {
                    type: "button",
                    label: "Add Qbit",
                    onClick: () => {
                        circuit.addQbit();
                        setNQbit(circuit.numQbit);
                    },
                    icon: <Plus className="size-5" />,
                },
            ],
        };
    }, [nQbit, startingStates, circuit]) as ToolbarItem;

    return (
        <Toolbar
            title="Simulation & Inspection"
            items={[
                circuitStateComponent,
                {
                    type: "collapse-group",
                    label: "Noise Model",
                    initiallyCollapsed: false,
                    items: [
                        {
                            type: "input",
                            label: "Flip Probability",
                            unit: "%",
                            initialValue: `${noiseModel.p_depolarize * 100}`,
                            onChange: (newValue: string) => {
                                const value = Number(newValue);
                                if (
                                    !isNaN(value) &&
                                    value >= 0 &&
                                    value <= 100
                                ) {
                                    setFlipProbability(value / 100);
                                    // setNoiseModel(circuit.noiseModel);
                                    return true;
                                }

                                return false;
                            },
                        },
                        {
                            type: "input",
                            label: "Time to Relaxation",
                            unit: "μs",
                            initialValue: `${noiseModel.t1}`,
                            onChange: (newValue: string) => {
                                const value = Number(newValue);
                                if (
                                    !isNaN(value) &&
                                    value >= 0 &&
                                    value <= 100
                                ) {
                                    setEnergyDecay(value);
                                    // setNoiseModel(circuit.noiseModel);
                                    return true;
                                }

                                return false;
                            },
                        },
                        {
                            type: "input",
                            label: "Time to Dephase",
                            unit: "μs",
                            initialValue: `${noiseModel.t1}`,
                            onChange: (newValue: string) => {
                                const value = Number(newValue);
                                if (
                                    !isNaN(value) &&
                                    value >= 0 &&
                                    value <= 100
                                ) {
                                    setDephasingFactor(value);
                                    // setNoiseModel(circuit.noiseModel);
                                    return true;
                                }

                                return false;
                            },
                        },
                        {
                            type: "input",
                            label: "Gate Time",
                            unit: "μs",
                            initialValue: `${noiseModel.gate_time}`,
                            onChange: (newValue: string) => {
                                const value = Number(newValue);
                                if (
                                    !isNaN(value) &&
                                    value >= 0 &&
                                    value <= 100
                                ) {
                                    setGateTime(value);
                                    // setNoiseModel(circuit.noiseModel);
                                    return true;
                                }

                                return false;
                            },
                        },
                    ],
                },
                {
                    type: "collapse-group",
                    label: "Inspection Tools",
                    initiallyCollapsed: false,
                    items: [
                        {
                            type: "custom",
                            element: (
                                <GateToolbarItem
                                    gate={CircuitComponent.createBlochInspector()}
                                />
                            ),
                        },
                        {
                            type: "custom",
                            element: (
                                <GateToolbarItem
                                    gate={CircuitComponent.createDensityInspector()}
                                />
                            ),
                        },
                        {
                            type: "custom",
                            element: (
                                <GateToolbarItem
                                    gate={CircuitComponent.createFidelityInspector()}
                                />
                            ),
                        },
                    ],
                },
            ]}
        ></Toolbar>
    );
};
