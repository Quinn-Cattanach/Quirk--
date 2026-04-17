import { useEffect, useRef } from "react";
import {
    renderCircuit,
    type CircuitRenderingOptions,
} from "./circuit/rendering";
import type { Circuit } from "./simulator/bindings/Circuit";
import { greet } from "./simulator/pkg/quirkmm_simulator";
import { renderBloch } from "./state/bloch";
import { SingleQbitState } from "./state/single-qbit";
import { Layout } from "./layout";

function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderingOptions: CircuitRenderingOptions = {
        scale: 1.0,
        width: 100.0,
        height: 100.0,
    };

    useEffect(() => {
        console.log("Hello from typescript.");

        const circuit: Circuit = {
            n_qbits: 2,
            gates: [{ SingleQbit: ["H", 0] }],
        };

        greet(circuit);
    }, []);

    const render = (time: number) => {
        if (!canvasRef.current) return;

        const context = canvasRef.current.getContext("2d");

        context?.clearRect(
            0,
            0,
            renderingOptions.width,
            renderingOptions.height,
        );

        if (context) {
            renderCircuit(context, renderingOptions);

            context.save();
            context.translate(100, 100);
            renderBloch(
                context,
                new SingleQbitState([
                    { re: 1, im: 0 },
                    { re: 0, im: 0 },
                ]),
                {
                    scale: devicePixelRatio,
                    width: 300,
                    height: 300,
                    camera: {
                        phi: time / 1000,
                        theta:
                            Math.PI / 2 +
                            Math.sin(time / 1000) * (Math.PI / 2 - 0.15),
                    },
                },
            );
            context.restore();
        }
        requestAnimationFrame(render);
    };

    useEffect(() => {
        if (canvasRef.current) {
            const { width, height } = canvasRef.current.getBoundingClientRect();
            const scale = devicePixelRatio;
            const [scaledWidth, scaledHeight] = [width * scale, height * scale];

            canvasRef.current.width = scaledWidth;
            canvasRef.current.height = scaledHeight;

            renderingOptions.scale = scale;
            renderingOptions.width = scaledWidth;
            renderingOptions.height = scaledHeight;

            requestAnimationFrame(render);
        }
    }, []);

    return (
        <Layout>
            {/*<MathJax math="\ket{0}\ket{i}" display></MathJax>*/}
            {/*<canvas ref={canvasRef} className="w-200 h-150"></canvas>*/}
        </Layout>
    );
}

export default App;
