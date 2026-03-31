
export class Gate {
    #latexString: string;
    set latexString(newValue: string) {
        this.#latexString = this.#latexString;
        //

    }

    async #generateBitmapBuffer() {
        const svg = await MathJax.t("\\frac{a}{b}");
        const svgString = svg.outerHTML;

        const img = new Image();
        img.src = "data:image/svg+xml;base64," + btoa(svgString);

        img.onload = () => {
        ctx.drawImage(img, 0, 0);
        };
    }

    svg: SVGElement; // store the MathJax
    bitmapBuffer: ImageBitmap; // so we don't have to re-rasterize on every update, just on change to the scale.
}