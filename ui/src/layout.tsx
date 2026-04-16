import {
    createContext,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";
import { Toolbar } from "./toolbar/toolbar-layout";
import { Plus } from "lucide-react";

export type LayoutContext = {
    mobile: boolean;
};

export const layoutContext = createContext<LayoutContext>(
    null as any as LayoutContext,
);

export const Layout = ({ children }: PropsWithChildren) => {
    const pageRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<HTMLDivElement | null>(null);
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

    return (
        <layoutContext.Provider value={{ mobile }}>
            <div ref={pageRef} className={`w-lvw h-lvh relative flex flex-col`}>
                <div
                    ref={dragRef}
                    className="w-lvw h-lvh absolute top-0 left-0 z-10 pointer-events-none"
                ></div>
                <div className="h-18 w-full bg-white flex border-b border-b-neutral-200 z-5">
                    <div className="my-auto mx-10 w-fit">quirk--</div>
                </div>
                <div
                    className={`w-full h-full bg-neutral-100 flex ${mobile ? "flex-col" : "flex-row"}`}
                >
                    <div
                        ref={toolbarContainerRef}
                        className={`flex-1 ${mobile ? "max-h-96" : "max-w-96"}`}
                    >
                        <Toolbar
                            title="Circuit Components"
                            items={[
                                {
                                    type: "collapse-group",
                                    initiallyCollapsed: false,
                                    label: "Single Qbit Gates",
                                    items: [
                                        {
                                            type: "custom",
                                            element: (
                                                <div className="w-full h-10 flex items-center">
                                                    <p className="font-medium text-sm">
                                                        Hadamard
                                                    </p>
                                                    <canvas className="ml-auto w-10 h-10"></canvas>
                                                </div>
                                            ),
                                        },
                                        {
                                            type: "button",
                                            label: "Create new gate",
                                            icon: <Plus className="size-4" />,
                                        },
                                    ],
                                },
                            ]}
                        ></Toolbar>
                    </div>
                    <div ref={contentContainerRef} className={`flex-2`}>
                        {children}
                    </div>
                </div>
            </div>
        </layoutContext.Provider>
    );
};
