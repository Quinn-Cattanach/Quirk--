import {
    createContext,
    useLayoutEffect,
    useRef,
    useState,
    type PropsWithChildren,
    type RefObject,
} from "react";
import { EditorToolbar } from "./toolbar/editor-toolbar";
import { InspectorToolbar } from "./toolbar/inspector-toolbar";
import { CircuitComponent } from "./circuit-component/circuit-component";
import { CircuitProvider } from "./circuit";

export type LayoutContext = {
    mobile: boolean;
    dragRef: RefObject<HTMLDivElement | null>;
    setDragging: (value: boolean) => void;
    contentRect: RefObject<{
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
    draggingGate: RefObject<CircuitComponent | null>;
};

export const layoutContext = createContext<LayoutContext>(
    null as any as LayoutContext,
);

export const Layout = ({ children }: PropsWithChildren) => {
    const pageRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<HTMLDivElement | null>(null);

    const [dragging, setDragging] = useState(false);
    const [mobile, setMobile] = useState(false);

    const contentContainerRef = useRef<HTMLDivElement | null>(null);
    const titlebarRef = useRef<HTMLDivElement | null>(null);

    const draggingGate = useRef<CircuitComponent | null>(null);

    const contentRect = useRef({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
    });

    // --- Mobile detection (stable, no flicker on reload) ---
    useLayoutEffect(() => {
        const computeMobile = () => {
            const width = document.documentElement.clientWidth;
            setMobile(width < 768);
        };

        computeMobile();
        window.addEventListener("resize", computeMobile);

        return () => window.removeEventListener("resize", computeMobile);
    }, []);

    useLayoutEffect(() => {
        const el = contentContainerRef.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            contentRect.current = {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
            };
        };

        update();

        const ro = new ResizeObserver(() => {
            requestAnimationFrame(update);
        });

        ro.observe(el);

        window.addEventListener("resize", update);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);

    const bgMask = `linear-gradient(
        to bottom,
        rgba(0,0,0,0.075) 0%,
        rgba(0,0,0,0.075) 100%
    )`;

    return (
        <CircuitProvider>
            <layoutContext.Provider
                value={{
                    mobile,
                    dragRef,
                    setDragging,
                    contentRect,
                    draggingGate,
                }}
            >
                <div
                    ref={pageRef}
                    className="w-lvw h-lvh relative flex flex-col"
                >
                    {/* Background */}
                    <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none z-0"
                        style={{
                            backgroundImage: 'url("/Quirk--/grid.svg")',
                            backgroundRepeat: "repeat",
                            backgroundSize: "37.5px 21.75px",
                            backgroundBlendMode: "multiply",
                            WebkitMaskImage: bgMask,
                            maskImage: bgMask,
                        }}
                    />

                    {/* Canvas layer (interactive, full screen) */}
                    <div className="absolute inset-0 z-10 pointer-events-auto">
                        {children}
                    </div>

                    {/* Drag layer (top-most) */}
                    <div
                        ref={dragRef}
                        className={`absolute inset-0 z-40 ${
                            dragging
                                ? "pointer-events-auto"
                                : "pointer-events-none"
                        }`}
                    />

                    {/* UI layer */}
                    <div className="relative z-30 h-full pointer-events-none flex flex-col">
                        {/* Titlebar */}
                        <div
                            ref={titlebarRef}
                            className="h-18 w-full bg-white flex border-b border-b-neutral-200 pointer-events-auto"
                        >
                            <img
                                className="my-auto mx-10 h-8"
                                src="logo.svg"
                            ></img>
                        </div>

                        {/* Main layout */}
                        <div
                            className={`relative w-full h-full min-h-0 flex ${
                                mobile ? "flex-col" : "flex-row"
                            }`}
                        >
                            {/* Left toolbar */}
                            <div
                                className={`${
                                    mobile ? "hidden" : "flex-1 max-w-80"
                                } pointer-events-auto`}
                            >
                                <EditorToolbar />
                            </div>

                            {/* Center content anchor (measurement only) */}
                            <div
                                ref={contentContainerRef}
                                className={`${mobile ? "flex-1" : "flex-[2]"}`}
                            />

                            {/* Right toolbar */}
                            <div
                                className={`${
                                    mobile ? "hidden" : "flex-1 max-w-80"
                                } pointer-events-auto`}
                            >
                                <InspectorToolbar />
                            </div>

                            {/* Mobile bottom bar */}
                            {mobile && (
                                <div className="flex flex-row w-full mt-auto max-h-96 pointer-events-auto">
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
                </div>
            </layoutContext.Provider>
        </CircuitProvider>
    );
};
