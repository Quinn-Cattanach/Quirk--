import { useEffect, useRef } from 'react';
import { renderCircuit, type CircuitRenderingOptions } from './circuit/rendering';
import type { Circuit } from './simulator/bindings/Circuit';
import { greet } from './simulator/pkg/quirkmm_simulator';

function App() {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    console.log("Hello from typescript.");

    const circuit: Circuit = {
      n_qbits: 2,
      gates: [{ "SingleQbit": ["H", 0] }]
    };

    greet(circuit);
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      const { width, height } = canvasRef.current.getBoundingClientRect();
      const scale = devicePixelRatio;
      const [scaledWidth, scaledHeight] = [width * scale, height * scale];

      canvasRef.current.width = scaledWidth;
      canvasRef.current.height = scaledHeight;

      const context = canvasRef.current.getContext("2d");

      if (context) {
        const options: CircuitRenderingOptions = {
          scale,
          width: scaledWidth,
          height: scaledHeight,
        };

        renderCircuit(context, options);
      }
    }
  }, []);

  return (
    <div className="w-lvw h-lvh bg-neutral-100">
      <canvas ref={canvasRef} className="w-200 h-150"></canvas>
    </div >
  )
}

export default App
