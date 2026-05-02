import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const html = document.getElementsByTagName("html").item(0)!;
const root = document.getElementById("root")!;

html.style.overscrollBehaviorX = "none";
html.style.overscrollBehaviorY = "none";

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
