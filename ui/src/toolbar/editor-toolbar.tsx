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
                            CircuitComponent.createSwap(),
                        ].map<ToolbarItem>((gate) => {
                            return {
                                type: "custom",
                                element: <GateToolbarItem gate={gate} />,
                            };
                        }),
                    ],
                },
            ]}
        ></Toolbar>
    );
};
