import { useState, type MouseEvent } from "react";
import { ChevronRight } from "lucide-react";

export type ToolbarItem =
    | {
          type: "heading";
          text: string;
      }
    | {
          type: "collapse-group";
          label: string;
          initiallyCollapsed: boolean;
          items: ToolbarItem[];
      }
    | {
          type: "divider";
      }
    | {
          type: "custom";
          element: React.ReactNode;
      }
    | {
          type: "button";
          label: string;
          onClick?: (e: MouseEvent) => void;
          icon?: React.ReactNode;
      }
    | {
          type: "input";
          label: string;
          initialValue: string;
          unit?: string;
          onChange: (newValue: string) => boolean;
      };

const Item = ({ item, path }: { item: ToolbarItem; path?: string }) => {
    switch (item.type) {
        case "input": {
            const [valid, setValid] = useState(
                item.onChange(item.initialValue),
            );

            return (
                <div className="w-full flex items-center overflow-visible py-1">
                    <p className="font-medium text-sm">{item.label}</p>
                    <div
                        className={`flex ml-auto border border-neutral-300 rounded-sm bg-white
                      focus-within:outline focus-within:outline-2 focus-within:outline-blue-200
                      ${!valid ? "outline-4 outline-red-400" : ""}`}
                    >
                        <input
                            className={`p-2 w-16 h-8 text-center bg-transparent outline-none
                        ${item.unit ? "rounded-l-sm" : "rounded-sm"}`}
                            onChange={(e) => {
                                setValid(item.onChange(e.target.value));
                            }}
                            defaultValue={item.initialValue}
                        />
                        {item.unit && (
                            <div className="rounded-r-sm border-l border-neutral-300 w-8 h-8 flex items-center">
                                <p className="m-auto">{item.unit}</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        case "button": {
            return (
                <button
                    className="hover:bg-neutral-100 border border-neutral-200  bg-white duration-100 shadow-md shadow-black/3 w-full text-sm py-2 cursor-pointer rounded-lg"
                    onClick={item.onClick}
                >
                    <span className="flex gap-2 items-center m-auto w-fit">
                        {item.icon ? <span>{item.icon}</span> : null}
                        {item.label}
                    </span>
                </button>
            );
        }
        case "heading": {
            return (
                <div className="font-bold text-sm w-full p-2">
                    <div className="truncate">{item.text}</div>
                </div>
            );
        }
        case "divider": {
            return (
                <div className="w-full px-2 py-2">
                    <div className="w-full h-0 border-b border-neutral-200"></div>
                </div>
            );
        }
        case "collapse-group": {
            const [collapsed, setCollapsed] = useState(item.initiallyCollapsed);

            return (
                <div className="w-full flex flex-col gap-2 relative">
                    <button
                        className="cursor-pointer flex items-center rounded-sm hover:bg-black/5 duration-100 py-2 px-2 z-2"
                        onClick={() => setCollapsed((p) => !p)}
                    >
                        <div className="font-semibold text-md truncate">
                            {item.label}
                        </div>
                        <ChevronRight
                            className={`ml-auto size-5 transition-transform duration-100 ${
                                collapsed ? "" : "rotate-90"
                            }`}
                        />
                    </button>

                    <div
                        className={`overflow-hidden transition-all duration-100 bg-black/5 rounded-md ${
                            collapsed
                                ? "max-h-0 opacity-0 -translate-y-5"
                                : "max-h-96 opacity-100"
                        }`}
                    >
                        <div className="flex flex-col gap-2 p-4">
                            {item.items.map((subItem, index) => (
                                <Item
                                    key={`${path ? path + "/" : ""}${item.label}/${index}`}
                                    item={subItem}
                                    path={path + item.label}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            );
        }
        case "custom": {
            return <div className="w-full overflow-hidden">{item.element}</div>;
        }
    }
};

export const Toolbar = ({
    title,
    items,
}: {
    title: string;
    items: ToolbarItem[];
}) => {
    return (
        <div className="w-full h-full p-4">
            <div className="w-full h-full rounded-xl backdrop-blur-md bg-white/70 border border-neutral-200 flex flex-col gap-2">
                <div className="font-semibold text-lg px-4 pt-3 pb-1">
                    {title}
                </div>
                <div className="border-b border-neutral-200 h-0 w-full"></div>
                <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
                    {items.map((item) => (
                        <Item item={item} />
                    ))}
                </div>
            </div>
        </div>
    );
};
