export type SVG = {
    str: string;
    width: number;
    height: number;
    vbWidth: number;
    vbHeight: number;
};
function padSvg(svgStr: string, pad = 4): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgStr, "image/svg+xml");
    const inner = doc.documentElement;

    const viewBox = inner.getAttribute("viewBox");
    if (!viewBox) throw new Error("SVG has no viewBox");

    const [minX, minY, w, h] = viewBox.trim().split(/\s+/).map(Number);

    // Compute ex-to-viewBox scale so pad (in ex) maps to viewBox units
    const exWidth = parseFloat(inner.getAttribute("width") ?? "0"); // in ex
    const exHeight = parseFloat(inner.getAttribute("height") ?? "0"); // in ex
    const scaleX = exWidth > 0 ? w / exWidth : 1;
    const scaleY = exHeight > 0 ? h / exHeight : 1;
    const padX = pad * scaleX;
    const padY = pad * scaleY;

    const paddedVbW = w + padX * 2;
    const paddedVbH = h + padY * 2;

    // Keep ex-based width/height so the SVG renders at the right size in the document
    const paddedExW = exWidth + pad * 2;
    const paddedExH = exHeight + pad * 2;

    const children = Array.from(inner.childNodes)
        .map((n) => new XMLSerializer().serializeToString(n))
        .join("\n");

    return `
<svg xmlns="http://www.w3.org/2000/svg"
     width="${paddedExW}ex"
     height="${paddedExH}ex"
     viewBox="${minX - padX} ${minY - padY} ${paddedVbW} ${paddedVbH}">
    ${children}
</svg>
`.trim();
}

export async function getSvgString(
    math: string,
    display = false,
): Promise<SVG> {
    const mathjax = (window as any).MathJax;
    if (!mathjax?.tex2svgPromise) {
        throw new Error("MathJax not found");
    }

    const node = await mathjax.tex2svgPromise(math, { display });
    const adaptor = mathjax.startup.adaptor;

    const svgNode = adaptor.tags(node, "svg")[0];
    const svgString = adaptor.serializeXML(svgNode);

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = doc.documentElement;

    let width = parseFloat(svgEl.getAttribute("width") ?? "0");
    let height = parseFloat(svgEl.getAttribute("height") ?? "0");

    let vbWidth = width;
    let vbHeight = height;

    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
        const [, , w, h] = viewBox.split(" ").map(Number);
        vbWidth = w;
        vbHeight = h;
    }

    return {
        str: svgString,
        width,
        height,
        vbWidth,
        vbHeight,
    };
}
export async function svgToImageBitmapByEx(
    svg: SVG,
    pxPerEx: number,
): Promise<HTMLCanvasElement> {
    const padded = padSvg(svg.str, 0.25);
    const dpr = devicePixelRatio;

    const displayWidth = svg.width * pxPerEx;
    const displayHeight = svg.height * pxPerEx;
    const pixelWidth = Math.max(1, Math.round(displayWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(displayHeight * dpr));

    const blob = new Blob([padded], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
    return canvas;
}

export async function svgToImageBitmap(
    svg: SVG,
    size: number,
): Promise<HTMLCanvasElement> {
    const padded = padSvg(svg.str, 0.25);

    const aspect = svg.vbWidth / svg.vbHeight;

    const dpr = devicePixelRatio;

    const displayHeight = size;
    const displayWidth = size * aspect;

    const pixelWidth = Math.round(displayWidth * dpr);
    const pixelHeight = Math.round(displayHeight * dpr);

    const blob = new Blob([padded], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const img = new Image();

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
    });

    URL.revokeObjectURL(url);

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");

    ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);

    return canvas;
}
