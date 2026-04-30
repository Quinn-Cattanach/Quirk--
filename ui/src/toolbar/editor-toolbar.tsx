import { Plus } from "lucide-react";
import {
    CircuitComponent,
    primitiveGates,
} from "../circuit-component/circuit-component";
import { GateToolbarItem } from "../circuit-component/toolbar-item";
import { Toolbar, type ToolbarItem } from "./toolbar-layout";

export const EditorToolbar = () => {
    return (
        <Toolbar
            title="Circuit Components"
            items={[
                {
                    type: "collapse-group",
                    initiallyCollapsed: false,
                    label: "Single Qbit Gates",
                    items: [
                        ...primitiveGates.map<ToolbarItem>((gate) => {
                            return {
                                type: "custom",
                                element: (
                                    <GateToolbarItem
                                        gate={CircuitComponent.fromPrimitive(
                                            gate,
                                        )}
                                    />
                                ),
                            };
                        }),
                        { type: "divider" },
                        {
                            type: "button",
                            label: "Create new gate",
                            icon: <Plus className="size-4" />,
                        },
                    ],
                },
                {
                    type: "collapse-group",
                    initiallyCollapsed: false,
                    label: "Multi-Qbit Gates",
                    items: [
                        ...[
                            CircuitComponent.createControl(),
                            CircuitComponent.createNotControl(),
                        ].map<ToolbarItem>((gate) => {
                            return {
                                type: "custom",
                                element: <GateToolbarItem gate={gate} />,
                            };
                        }),
                        { type: "divider" },
                        {
                            type: "button",
                            label: "Create new gate",
                            icon: <Plus className="size-4" />,
                        },
                    ],
                },
                {
                    type: "collapse-group",
                    initiallyCollapsed: false,
                    label: "Operators",
                    items: [
                        ...primitiveGates.map<ToolbarItem>((gate) => {
                            return {
                                type: "custom",
                                element: (
                                    <GateToolbarItem
                                        gate={CircuitComponent.fromPrimitive(
                                            gate,
                                        )}
                                    />
                                ),
                            };
                        }),
                        { type: "divider" },
                        {
                            type: "button",
                            label: "Create new gate",
                            icon: <Plus className="size-4" />,
                        },
                    ],
                },
            ]}
        ></Toolbar>
    );
};
