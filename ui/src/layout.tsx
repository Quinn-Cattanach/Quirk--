import {
    createContext,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
    type RefObject,
} from "react";
import { Toolbar, type ToolbarItem } from "./toolbar/toolbar-layout";
import { Plus } from "lucide-react";
import { GateToolbarItem } from "./gate/toolbar-item";
import { CircuitComponent, primitiveGates } from "./gate/gate";
import { EditorToolbar } from "./toolbar/editor-toolbar";
import { InspectorToolbar } from "./toolbar/inspector-toolbar";

export type LayoutContext = {
    mobile: boolean;
    dragRef: RefObject<HTMLDivElement | null>;
    setDragging: (value: boolean) => void;
};

export const layoutContext = createContext<LayoutContext>(
    null as any as LayoutContext,
);

export const Layout = ({ children }: PropsWithChildren) => {
    const pageRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const [mobile, setMobile] = useState(false);

    const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
    const contentContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onResize = () => {
            if (pageRef.current) {
                const { width } = pageRef.current.getBoundingClientRect();

                if (width < 768) {
                    if (
                        toolbarContainerRef.current &&
                        contentContainerRef.current
                    ) {
                        toolbarContainerRef.current.style.order = "2";
                        contentContainerRef.current.style.order = "1";
                    }
                    setMobile(true);
                } else {
                    if (
                        toolbarContainerRef.current &&
                        contentContainerRef.current
                    ) {
                        toolbarContainerRef.current.style.order = "1";
                        contentContainerRef.current.style.order = "2";
                    }
                    setMobile(false);
                }
            }
        };

        onResize();

        window.addEventListener("resize", onResize);

        return () => {
            window.removeEventListener("resize", onResize);
        };
    }, []);

    const bgMask = `linear-gradient(
        to bottom,
        rgba(0,0,0,0.075) 0%,
        rgba(0,0,0,0.075) 100%
    )`;

    return (
        <layoutContext.Provider value={{ mobile, dragRef, setDragging }}>
            <div ref={pageRef} className={`w-lvw h-lvh relative flex flex-col`}>
                <div
                    ref={dragRef}
                    className={`w-lvw h-lvh absolute top-0 left-0 z-10 ${dragging ? "" : "pointer-events-none"}`}
                ></div>
                <div className="h-18 w-full bg-white flex border-b border-b-neutral-200 z-5">
                    <div className="my-auto mx-10 w-fit">quirk--</div>
                </div>
                <div
                    className={`w-full h-full min-h-0 bg-neutral-100 flex ${
                        mobile ? "flex-col" : "flex-row"
                    }`}
                >
                    {/* background */}
                    <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'url("/grid.svg")',
                            backgroundRepeat: "repeat",
                            backgroundSize: "37.5px 21.75px",
                            backgroundBlendMode: "multiply",
                            WebkitMaskImage: bgMask,
                            maskImage: bgMask,
                        }}
                    />

                    <div
                        className={`z-1 ${
                            mobile ? "hidden" : "flex-1 max-w-80"
                        }`}
                    >
                        <EditorToolbar />
                    </div>

                    <div
                        ref={contentContainerRef}
                        className={`z-1 ${mobile ? "flex-1" : "flex-2"}`}
                    >
                        {children}
                    </div>

                    <div
                        className={`z-1 ${
                            mobile ? "hidden" : "flex-1 max-w-80"
                        }`}
                    >
                        <InspectorToolbar />
                    </div>

                    {mobile && (
                        <div className="z-1 flex flex-row w-full  mt-auto max-h-96">
                            <div className="flex-1">
                                <EditorToolbar />
                            </div>
                            <div className="flex-1">
                                <InspectorToolbar />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </layoutContext.Provider>
    );
};
