export type CircuitRenderingOptions = {
    scale: number;
    width: number;
    height: number;
};

export function renderCircuit(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    options: CircuitRenderingOptions,
) {
    const dpr = devicePixelRatio;

    context.save();
    context.rect(0, 0, options.width, options.height);
    context.clip();

    context.beginPath();
    context.rect(
        10 * options.scale,
        10 * options.scale,
        30 * options.scale,
        30 * options.scale,
    );
    context.fillStyle = "FF0000";
    context.fill();

    context.restore();
}
