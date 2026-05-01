import { CircuitComponent } from "../circuit-component/circuit-component";

// Adjust this import to wherever you keep the mathjax helpers.
import { getSvgString, svgToImageBitmap } from "../mathjax";

export type KetType = "0" | "1" | "+" | "-" | "+i" | "-i";

const KET_TEX: Record<KetType, string> = {
    "0": "|0\\rangle",
    "1": "|1\\rangle",
    "+": "|\\text{+}\\rangle",
    "-": "|\\text{−}\\rangle",
    "+i": "|i\\rangle",
    "-i": "|{-}i\\rangle",
};

// Module-level cache shared across all Circuit instances.
const ketCache = new Map<string, HTMLCanvasElement>();
const ketPending = new Map<string, Promise<void>>();

const ketKey = (ket: KetType, sizeCSS: number) => `${ket}@${sizeCSS}`;

function loadKet(ket: KetType, sizeCSS: number, onLoaded: () => void): void {
    const key = ketKey(ket, sizeCSS);
    if (ketCache.has(key)) {
        onLoaded();
        return;
    }
    const existing = ketPending.get(key);
    if (existing) {
        existing.then(onLoaded);
        return;
    }
    const p = (async () => {
        try {
            const svg = await getSvgString(KET_TEX[ket], false);
            const canvas = await svgToImageBitmap(svg, sizeCSS);
            ketCache.set(key, canvas);
        } catch (e) {
            console.warn(`Failed to load ket bitmap for |${ket}>:`, e);
        }
    })();
    ketPending.set(key, p);
    p.then(() => {
        ketPending.delete(key);
        onLoaded();
    });
}

function getKetBitmap(
    ket: KetType,
    sizeCSS: number,
): HTMLCanvasElement | undefined {
    return ketCache.get(ketKey(ket, sizeCSS));
}

// ---------- options ----------

export type CircuitRenderingOptions = {
    rowPadding: number;
    columnPadding: number;
    wireExtension: number;
    minRowHeight: number;
    minColumnWidth: number;
    wireColor: string;
    wireWidth: number;
    controlLineColor: string;
    controlLineWidth: number;
    /** Radius of the ⊕ target symbol (CSS px). */
    oplusRadius: number;
    /** Stroke width of the ⊕ symbol (CSS px). */
    oplusStrokeWidth: number;
    /** Width reserved on the left for ket labels (CSS px). */
    ketAreaWidth: number;
    /** Height of rendered ket bitmaps (CSS px). */
    ketHeight: number;
    /** Gap between the ket label and the wire start (CSS px). */
    ketRightPadding: number;
};

export const DEFAULT_RENDERING_OPTIONS: CircuitRenderingOptions = {
    rowPadding: 16,
    columnPadding: 12,
    wireExtension: 24,
    minRowHeight: 48,
    minColumnWidth: 40,
    wireColor: "#000000",
    wireWidth: 1.5,
    controlLineColor: "#000000",
    controlLineWidth: 1.5,
    oplusRadius: 12,
    oplusStrokeWidth: 1.5,
    ketAreaWidth: 44,
    ketHeight: 30,
    ketRightPadding: 6,
};

// ---------- Circuit ----------

export class Circuit {
    #components: (CircuitComponent | null)[][];
    #startingStates: KetType[];
    #needsDisplay: (() => void) | null = null;
    options: CircuitRenderingOptions;

    set needsDisplay(cb: () => void) {
        this.#needsDisplay = cb;
        for (const row of this.#components) {
            for (const c of row) if (c) c.needsDisplay = cb;
        }
    }

    get numQbit(): number {
        return this.#components.length;
    }
    get numColumns(): number {
        return this.#components[0]?.length ?? 0;
    }

    /** Options scaled to physical pixels. */
    private get s() {
        const dpr = devicePixelRatio;
        return {
            rowPadding: this.options.rowPadding * dpr,
            columnPadding: this.options.columnPadding * dpr,
            wireExtension: this.options.wireExtension * dpr,
            minRowHeight: this.options.minRowHeight * dpr,
            minColumnWidth: this.options.minColumnWidth * dpr,
            wireWidth: this.options.wireWidth * dpr,
            controlLineWidth: this.options.controlLineWidth * dpr,
            oplusRadius: this.options.oplusRadius * dpr,
            oplusStrokeWidth: this.options.oplusStrokeWidth * dpr,
            ketAreaWidth: this.options.ketAreaWidth * dpr,
            ketRightPadding: this.options.ketRightPadding * dpr,
        };
    }

    // ---------- starting states ----------

    setStartingState(row: number, ket: KetType): void {
        if (row < 0 || row >= this.numQbit) return;
        this.#startingStates[row] = ket;
        this.#ensureKetLoaded(ket);
        this.#needsDisplay?.();
    }

    getStartingState(row: number): KetType {
        return this.#startingStates[row];
    }

    #ensureKetLoaded(ket: KetType): void {
        loadKet(ket, this.options.ketHeight, () => this.#needsDisplay?.());
    }

    // ---------- qbit management ----------

    addQbit() {
        this.#components.push(Array(this.numColumns).fill(null));
        this.#startingStates.push("0");
        this.#ensureKetLoaded("0");
        this.#needsDisplay?.();
    }

    removeQbit(index: number) {
        if (index < this.numQbit) {
            this.#components.splice(index, 1);
            this.#startingStates.splice(index, 1);
            this.#needsDisplay?.();
        }
    }

    setComponent(row: number, col: number, c: CircuitComponent | null) {
        if (row < 0 || row >= this.numQbit) return;
        while (col >= this.numColumns) {
            for (const r of this.#components) r.push(null);
        }
        this.#components[row][col] = c;
        if (c && this.#needsDisplay) c.needsDisplay = this.#needsDisplay;
        this.#needsDisplay?.();
    }

    widthOfColumn(index: number): number {
        if (index >= this.numColumns) return 0;
        const max = this.#components.reduce(
            (p, row) => Math.max(p, row[index]?.width ?? 0),
            0,
        );
        return Math.max(max, this.s.minColumnWidth);
    }

    heightOfRow(index: number): number {
        if (index >= this.numQbit) return 0;
        const max = this.#components[index].reduce(
            (p, v) => Math.max(p, v?.height ?? 0),
            0,
        );
        return Math.max(max, this.s.minRowHeight);
    }

    removeAt(row: number, col: number) {
        if (row < 0 || row >= this.numQbit) return;
        if (col < 0 || col >= this.numColumns) return;

        this.#components[row][col] = null;
        this.#needsDisplay?.();

        this.removeColumnIfEmpty(col);
    }

    isColumnEmpty(col: number): boolean {
        if (col < 0 || col >= this.numColumns) return true;
        for (let i = 0; i < this.numQbit; i += 1) {
            if (this.#components[i][col] != null) return false;
        }
        return true;
    }

    removeColumn(col: number) {
        if (col < 0 || col >= this.numColumns) return;
        for (const row of this.#components) {
            row.splice(col, 1);
        }
        this.#needsDisplay?.();
    }

    removeColumnIfEmpty(col: number) {
        if (this.isColumnEmpty(col)) {
            this.removeColumn(col);
        }
    }

    getComponentAt(row: number, col: number): CircuitComponent | null {
        if (row < 0 || row >= this.numQbit) return null;
        if (col < 0 || col >= this.numColumns) return null;
        return this.#components[row][col];
    }

    // ---------- geometry ----------

    get width(): number {
        let w = 0;
        for (let i = 0; i < this.numColumns; i += 1) w += this.widthOfColumn(i);
        if (this.numColumns > 1)
            w += (this.numColumns - 1) * this.s.columnPadding;
        w += 2 * this.s.wireExtension;
        w += this.s.ketAreaWidth;
        return w;
    }

    get height(): number {
        let h = 0;
        for (let i = 0; i < this.numQbit; i += 1) h += this.heightOfRow(i);
        if (this.numQbit > 1) h += (this.numQbit - 1) * this.s.rowPadding;
        return h;
    }

    private rowTopY(index: number): number {
        let y = 0;
        for (let i = 0; i < index; i += 1) {
            y += this.heightOfRow(i) + this.s.rowPadding;
        }
        return y;
    }

    rowCenterY(index: number): number {
        return this.rowTopY(index) + this.heightOfRow(index) / 2;
    }

    private columnLeftX(index: number): number {
        let x = this.s.ketAreaWidth + this.s.wireExtension;
        for (let j = 0; j < index; j += 1) {
            x += this.widthOfColumn(j) + this.s.columnPadding;
        }
        return x;
    }

    columnCenterX(index: number): number {
        return this.columnLeftX(index) + this.widthOfColumn(index) / 2;
    }

    /**
     * Resolve a point in circuit-local coordinates to a drop target.
     * Returns null if the point is outside the rows or over an occupied cell.
     */
    hitTest(
        x: number,
        y: number,
    ): { row: number; col: number; insert: boolean } | null {
        let row = -1;
        let yCursor = 0;

        for (let i = 0; i < this.numQbit; i += 1) {
            const rowH = this.heightOfRow(i);
            const pad = this.s.rowPadding;
            const top = yCursor;
            const bottom = yCursor + rowH;
            if (y >= top && y < bottom) {
                row = i;
                break;
            }
            yCursor = bottom + pad;
        }

        if (row === -1) return null;

        let xCursor = this.s.ketAreaWidth + this.s.wireExtension;
        const pad = this.s.columnPadding;

        for (let j = 0; j < this.numColumns; j += 1) {
            const colW = this.widthOfColumn(j);
            const colStart = xCursor;
            const colEnd = xCursor + colW;

            const insertZoneStart = colStart - pad / 2;
            const insertZoneEnd = colStart + pad / 2;

            if (x >= insertZoneStart && x < insertZoneEnd) {
                return { row, col: j, insert: true };
            }

            if (x >= colStart + pad / 2 && x < colEnd - pad / 2) {
                if (this.#components[row][j] == null) {
                    return { row, col: j, insert: false };
                }
                return null;
            }

            xCursor = colEnd + pad;
        }

        if (this.numColumns > 0) {
            const lastColEnd =
                this.columnLeftX(this.numColumns - 1) +
                this.widthOfColumn(this.numColumns - 1);
            const endInsertZoneStart = lastColEnd - pad / 2;
            if (x >= endInsertZoneStart) {
                return { row, col: this.numColumns, insert: true };
            }
        }

        return null;
    }

    /** Insert a brand-new empty column at `col`. */
    insertColumn(col: number) {
        for (const r of this.#components) {
            r.splice(col, 0, null);
        }
        this.#needsDisplay?.();
    }

    /**
     * Drop a component at a target. If `insert` is true, makes a new column
     * first. If the target cell is already occupied, no-op.
     */
    drop(
        target: { row: number; col: number; insert: boolean },
        component: CircuitComponent,
    ) {
        if (target.insert) {
            this.insertColumn(target.col);
        }
        if (target.row < 0 || target.row >= this.numQbit) return;
        if (target.col < 0) return;
        while (target.col >= this.numColumns) {
            for (const r of this.#components) r.push(null);
        }
        if (this.#components[target.row][target.col] != null) return;
        this.#components[target.row][target.col] = component;
        if (this.#needsDisplay) component.needsDisplay = this.#needsDisplay;
        this.#needsDisplay?.();
    }

    /**
     * Geometry of where a ghost should render for a given drop target,
     * in circuit-local coordinates. Returns the rect to draw the ghost in.
     */
    ghostRect(target: { row: number; col: number; insert: boolean }): {
        x: number;
        y: number;
        width: number;
        height: number;
    } {
        if (target.row < 0 || target.row >= this.numQbit || target.col < 0) {
            return { x: -1, y: -1, width: 0, height: 0 };
        }

        const rowH = this.heightOfRow(Math.min(target.row, this.numQbit - 1));
        const y = this.rowTopY(Math.min(target.row, this.numQbit - 1));

        if (target.insert) {
            const slotW = this.s.minColumnWidth;
            const col = Math.min(target.col, this.numColumns);
            let x: number;
            if (col === 0) {
                x = this.columnLeftX(0) - slotW / 2;
            } else if (col >= this.numColumns) {
                x =
                    this.columnLeftX(this.numColumns - 1) +
                    this.widthOfColumn(this.numColumns - 1) +
                    this.s.columnPadding / 2 -
                    slotW / 2;
            } else {
                const leftEnd =
                    this.columnLeftX(col - 1) + this.widthOfColumn(col - 1);
                x = leftEnd + this.s.columnPadding / 2 - slotW / 2;
            }
            return { x, y, width: slotW, height: rowH };
        }

        if (target.col >= this.numColumns) {
            return { x: -1, y: -1, width: 0, height: 0 };
        }

        const colW = this.widthOfColumn(target.col);
        const x = this.columnLeftX(target.col);
        return { x, y, width: colW, height: rowH };
    }

    private drawOplus(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
        const r = this.s.oplusRadius;
        ctx.save();
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#FFFFFF";
        ctx.lineWidth = this.s.oplusStrokeWidth;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();

        ctx.restore();
    }

    #phantom: { col: number; width: number } | null = null;

    setPhantomColumn(col: number | null) {
        if (col === null) {
            if (this.#phantom) {
                this.#phantom = null;
                this.#needsDisplay?.();
            }
            return;
        }
        const width = this.s.minColumnWidth;
        if (
            this.#phantom &&
            this.#phantom.col === col &&
            this.#phantom.width === width
        ) {
            return;
        }
        this.#phantom = { col, width };
        this.#needsDisplay?.();
    }

    private renderColumnLeftX(index: number): number {
        let x = this.s.ketAreaWidth + this.s.wireExtension;
        for (let j = 0; j < index; j += 1) {
            if (this.#phantom && this.#phantom.col === j) {
                x += this.#phantom.width + this.s.columnPadding;
            }
            x += this.widthOfColumn(j) + this.s.columnPadding;
        }
        if (this.#phantom && this.#phantom.col === index) {
            x += this.#phantom.width + this.s.columnPadding;
        }
        return x;
    }

    private renderPhantomLeftX(): number | null {
        if (!this.#phantom) return null;
        let x = this.s.ketAreaWidth + this.s.wireExtension;
        for (let j = 0; j < this.#phantom.col; j += 1) {
            x += this.widthOfColumn(j) + this.s.columnPadding;
        }
        return x;
    }

    private get renderWidth(): number {
        let w = this.width;
        if (this.#phantom) w += this.#phantom.width + this.s.columnPadding;
        return w;
    }

    // ---------- render ----------

    render(
        ctx: CanvasRenderingContext2D,
        ghost?: {
            component: CircuitComponent;
            target: { row: number; col: number; insert: boolean };
        },
    ) {
        ctx.save();
        const w = this.width;
        const h = this.height;
        ctx.clearRect(0, 0, w, h);

        // wires (start AFTER the ket area)
        const wireStart = this.s.ketAreaWidth;
        ctx.strokeStyle = this.options.wireColor;
        ctx.lineWidth = this.s.wireWidth;
        for (let i = 0; i < this.numQbit; i += 1) {
            const y = this.rowCenterY(i);
            ctx.beginPath();
            ctx.moveTo(wireStart, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // ket labels (right-aligned in the ket area, vertically centered on each wire)
        for (let i = 0; i < this.numQbit; i += 1) {
            const ket = this.#startingStates[i];
            const bitmap = getKetBitmap(ket, this.options.ketHeight);
            if (!bitmap) continue;
            const cy = this.rowCenterY(i);
            const x =
                this.s.ketAreaWidth - bitmap.width - this.s.ketRightPadding;
            ctx.drawImage(bitmap, x, cy - bitmap.height / 2);
        }

        ctx.strokeStyle = this.options.controlLineColor;
        ctx.lineWidth = this.s.controlLineWidth;

        // control connectors
        for (let j = 0; j < this.numColumns; j += 1) {
            const occupied: number[] = [];
            let hasControl = false;
            let hasNonControlGate = false;

            for (let i = 0; i < this.numQbit; i += 1) {
                const c = this.#components[i][j];
                if (c) {
                    occupied.push(i);
                    if (c.type === "control" || c.type === "not-control") {
                        hasControl = true;
                    } else {
                        hasNonControlGate = true;
                    }
                }
            }

            const x = this.columnCenterX(j);
            const ghostInThisCol =
                ghost && !ghost.target.insert && ghost.target.col === j;
            const ghostIsControl =
                !!ghostInThisCol &&
                (ghost!.component.type === "control" ||
                    ghost!.component.type === "not-control");

            const existingValid =
                hasControl && hasNonControlGate && occupied.length >= 2;

            const wouldBeValid =
                ghostInThisCol &&
                (hasControl || ghostIsControl) &&
                (hasNonControlGate || !ghostIsControl);

            if (existingValid) {
                occupied.sort((a, b) => a - b);
                ctx.beginPath();
                ctx.strokeStyle = this.options.controlLineColor;
                ctx.lineWidth = this.s.controlLineWidth;
                ctx.moveTo(x, this.rowCenterY(occupied[0]));
                ctx.lineTo(x, this.rowCenterY(occupied[occupied.length - 1]));
                ctx.stroke();
            }

            if (ghostInThisCol && wouldBeValid && occupied.length > 0) {
                occupied.sort((a, b) => a - b);
                const topExisting = occupied[0];
                const bottomExisting = occupied[occupied.length - 1];
                const ghostRow = ghost!.target.row;

                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = this.options.controlLineColor;
                ctx.lineWidth = this.s.controlLineWidth;

                if (existingValid) {
                    if (ghostRow < topExisting) {
                        ctx.beginPath();
                        ctx.moveTo(x, this.rowCenterY(topExisting));
                        ctx.lineTo(x, this.rowCenterY(ghostRow));
                        ctx.stroke();
                    } else if (ghostRow > bottomExisting) {
                        ctx.beginPath();
                        ctx.moveTo(x, this.rowCenterY(bottomExisting));
                        ctx.lineTo(x, this.rowCenterY(ghostRow));
                        ctx.stroke();
                    }
                } else {
                    const minRow = Math.min(topExisting, ghostRow);
                    const maxRow = Math.max(bottomExisting, ghostRow);
                    if (minRow !== maxRow) {
                        ctx.beginPath();
                        ctx.moveTo(x, this.rowCenterY(minRow));
                        ctx.lineTo(x, this.rowCenterY(maxRow));
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }
        }

        // actual components
        for (let j = 0; j < this.numColumns; j += 1) {
            let columnHasControl = false;
            for (let i = 0; i < this.numQbit; i += 1) {
                if (
                    this.#components[i][j]?.type === "control" ||
                    this.#components[i][j]?.type === "not-control"
                ) {
                    columnHasControl = true;
                    break;
                }
            }
            if (
                ghost &&
                !ghost.target.insert &&
                ghost.target.col === j &&
                (ghost.component.type === "control" ||
                    ghost.component.type === "not-control")
            ) {
                columnHasControl = true;
            }

            for (let i = 0; i < this.numQbit; i += 1) {
                const c = this.#components[i][j];
                if (!c) continue;

                if (columnHasControl && c.primitive === "pauli-x") {
                    this.drawOplus(
                        ctx,
                        this.columnCenterX(j),
                        this.rowCenterY(i),
                    );
                } else {
                    const cellLeft =
                        this.columnLeftX(j) +
                        (this.widthOfColumn(j) - c.width) / 2;
                    const cellTop =
                        this.rowTopY(i) + (this.heightOfRow(i) - c.height) / 2;
                    ctx.save();
                    ctx.translate(cellLeft, cellTop);
                    c.draw(ctx);
                    ctx.restore();
                }
            }
        }

        // phantom preview
        if (ghost) {
            const rect = this.ghostRect(ghost.target);
            if (rect.width > 0 && rect.height > 0) {
                ctx.save();
                ctx.globalAlpha = 0.5;

                let ghostColumnHasControl = false;
                if (!ghost.target.insert) {
                    for (let i = 0; i < this.numQbit; i += 1) {
                        if (
                            this.#components[i][ghost.target.col]?.type ===
                                "control" ||
                            this.#components[i][ghost.target.col]?.type ===
                                "not-control"
                        ) {
                            ghostColumnHasControl = true;
                            break;
                        }
                    }
                }

                if (
                    ghost.component.type === "control" ||
                    ghost.component.type === "not-control"
                )
                    ghostColumnHasControl = true;

                if (
                    ghostColumnHasControl &&
                    ghost.component.primitive === "pauli-x"
                ) {
                    this.drawOplus(
                        ctx,
                        rect.x + rect.width / 2,
                        rect.y + rect.height / 2,
                    );
                } else {
                    const cx =
                        rect.x + (rect.width - ghost.component.width) / 2;
                    const cy =
                        rect.y + (rect.height - ghost.component.height) / 2;
                    ctx.translate(cx, cy);
                    ghost.component.draw(ctx);
                }
                ctx.restore();
            }
        }
        ctx.restore();
    }

    constructor(nQbit: number, options: Partial<CircuitRenderingOptions> = {}) {
        if (!Number.isInteger(nQbit) || nQbit < 1) {
            throw new Error(
                `nQbit must be a positive integer (${nQbit} invalid).`,
            );
        }
        // Each row gets its own array — `Array(n).fill([null])` shares one.
        this.#components = Array.from({ length: nQbit }, () => [null]);
        this.#startingStates = Array.from(
            { length: nQbit },
            () => "0" as KetType,
        );
        this.options = { ...DEFAULT_RENDERING_OPTIONS, ...options };

        // Kick off loading the default ket bitmap.
        this.#ensureKetLoaded("0");
    }
}
