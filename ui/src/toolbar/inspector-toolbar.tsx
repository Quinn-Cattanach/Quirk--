import { Plus } from "lucide-react";
import {
    CircuitComponent,
    primitiveGates,
} from "../circuit-component/circuit-component";
import { GateToolbarItem } from "../circuit-component/toolbar-item";
import { Toolbar, type ToolbarItem } from "./toolbar-layout";

export const InspectorToolbar = () => {
    return (
        <Toolbar
            title="Inspection Tools"
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
            ]}
        ></Toolbar>
    );
};
