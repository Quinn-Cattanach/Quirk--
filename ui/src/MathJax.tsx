export async function getSvgString(
    math: string,
    display = false,
): Promise<string> {
    const mathjax = (window as any).MathJax;
    if (!mathjax?.tex2svgPromise) {
        throw new Error("MathJax not found");
    }

    const node = await mathjax.tex2svgPromise(math, { display });
    const adaptor = mathjax.startup.adaptor;

    return adaptor.serializeXML(adaptor.tags(node, "svg")[0]);
}

export async function svgToImageBitmap(
    svgString: string,
    size: number,
): Promise<ImageBitmap> {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = svgDoc.documentElement;

    const naturalWidth = parseFloat(svgEl.getAttribute("width") ?? "100");
    const naturalHeight = parseFloat(svgEl.getAttribute("height") ?? "100");
    const aspect = naturalWidth / naturalHeight;

    const targetHeight = size;
    const targetWidth = size * aspect;

    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const img = new Image();

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
    });

    const bitmap = await createImageBitmap(img, 0, 0, img.width, img.height, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: "high",
    });

    URL.revokeObjectURL(url);
    return bitmap;
}
