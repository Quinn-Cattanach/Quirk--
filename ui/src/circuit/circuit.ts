import { CircuitComponent } from "../circuit-component/circuit-component";
import type { NoiseModel } from "../simulator/bindings/NoiseModel";
import type { SimulationStage } from "../simulator/bindings/SimulationStage";
import { simulate_circuit } from "../simulator/pkg/quirkmm_simulator";
import { buildSimulatorCircuit } from "./circuit-to-simulator";

export type SimulationResult = {
    stages: SimulationStage[];
    /** stages[i+1] corresponds to UI column columnMap[i], or -1 for synthetic. */
    columnMap: number[];
};

// Adjust this import to wherever you keep the mathjax helpers.
import { getSvgString, svgToImageBitmap } from "../mathjax-helpers";

export type KetType = "0" | "1" | "+" | "-" | "+i" | "-i";

export const STARTING_STATES: KetType[] = ["0", "1", "+", "-", "+i", "-i"];

const KET_TEX: Record<KetType, string> = {
    "0": "|0\\rangle",
    "1": "|1\\rangle",
    "+": "|\\text{+}\\rangle",
    "-": "|\\text{−}\\rangle",
    "+i": "|i\\rangle",
    "-i": "|{-}i\\rangle",
};

function stageIndexAtUiColumn(columnMap: number[], c: number): number {
    let lastIdx = -1;
    for (let i = 0; i < columnMap.length; i++) {
        if (columnMap[i] >= 0 && columnMap[i] < c) lastIdx = i;
    }
    return lastIdx + 1;
}

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

    #columnSpanningAt(col: number): CircuitComponent | null {
        if (col < 0 || col >= this.numColumns) return null;
        for (let r = 0; r < this.numQbit; r++) {
            const c = this.#components[r][col];
            if (c && c.spans === "column") return c;
        }
        return null;
    }

    #columnIsBlocked(col: number): boolean {
        return this.#columnSpanningAt(col) !== null;
    }

    #noiseModel: NoiseModel = {
        t1: 56.15,
        t2: 56.01,
        p_depolarize: 11.68e-4,
        gate_time: 0.1,
    };
    #onSimulation: ((result: SimulationResult) => void) | null = null;
    #latestResult: SimulationResult | null = null;

    get noiseModel(): NoiseModel {
        return this.#noiseModel;
    }
    set noiseModel(noise: NoiseModel) {
        this.#noiseModel = noise;
        this.#fireDidChange();
    }

    set onSimulation(cb: (result: SimulationResult) => void) {
        this.#onSimulation = cb;
        this.#scheduleSimulation();
    }

    get latestSimulation(): SimulationResult | null {
        return this.#latestResult;
    }

    simulate(): SimulationResult | null {
        try {
            const { circuit, initialState, columnMap } = buildSimulatorCircuit(
                this.#components,
                this.#startingStates,
            );
            const stages = simulate_circuit(
                circuit,
                initialState,
                this.#noiseModel,
            ) as SimulationStage[];
            return { stages, columnMap };
        } catch (e) {
            console.warn("Simulation failed:", e);
            return null;
        }
    }

    #simScheduled = false;

    #hasInspectors(): boolean {
        for (const row of this.#components) {
            for (const c of row) {
                if (
                    c?.type === "bloch-inspector" ||
                    c?.type === "fidelity-inspector" ||
                    c?.type === "density-inspector"
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    #updateInspectors(result: SimulationResult) {
        for (let col = 0; col < this.numColumns; col++) {
            const idx = stageIndexAtUiColumn(result.columnMap, col);
            const stage = result.stages[idx] ?? null;
            if (stage) {
                console.log("col", col, "dirty ρ:", stage.dirty.density_matrix);

                console.log("col", col, "clean ρ:", stage.clean.density_matrix);
                console.log(
                    "col",
                    col,
                    "clean state:",
                    stage.clean.state_vector,
                );
                console.log("col", col, "dirty ρ:", stage.dirty.density_matrix);
                console.log("col", col, "fidelity:", stage.fidelity);
            }

            for (let row = 0; row < this.numQbit; row++) {
                const c = this.#components[row][col];
                if (!c) continue;
                if (c.type === "bloch-inspector") {
                    const info = stage?.clean.qubits[row] ?? null;
                    c.setQubitInfo(info);
                } else if (
                    c.type === "fidelity-inspector" ||
                    c.type === "density-inspector"
                ) {
                    c.setStage(stage);
                }
            }
        }
    }

    #clearInspectors() {
        for (const row of this.#components) {
            for (const c of row) {
                if (c?.type === "bloch-inspector") c.setQubitInfo(null);
                if (
                    c?.type === "fidelity-inspector" ||
                    c?.type === "density-inspector"
                ) {
                    c.setStage(null);
                }
            }
        }
    }

    #scheduleSimulation() {
        if (!this.#onSimulation && !this.#hasInspectors()) return;
        if (this.#simScheduled) return;
        this.#simScheduled = true;
        queueMicrotask(() => {
            this.#simScheduled = false;
            const hasInspectors = this.#hasInspectors();
            if (!this.#onSimulation && !hasInspectors) return;

            console.group("[sim]");
            console.log(
                "components grid:",
                this.#components.map((row) =>
                    row.map((c) => c?.type ?? "null"),
                ),
            );

            const result = this.simulate();
            this.#latestResult = result;

            if (result) {
                console.log("columnMap:", result.columnMap);
                console.log("stages:", result.stages.length, "total");
                if (hasInspectors) this.#updateInspectors(result);
                this.#onSimulation?.(result);
            } else if (hasInspectors) {
                console.warn("simulate() returned null — clearing inspectors");
                this.#clearInspectors();
            }
            console.groupEnd();
            this.#needsDisplay?.();
        });
    }

    #fireDidChange() {
        this.#needsDisplay?.();
        this.#scheduleSimulation();
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
        this.#fireDidChange();
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
        this.#fireDidChange();
    }

    removeQbit(index: number) {
        if (index < this.numQbit) {
            this.#components.splice(index, 1);
            this.#startingStates.splice(index, 1);
            this.#fireDidChange();
        }
    }

    setComponent(row: number, col: number, c: CircuitComponent | null) {
        if (row < 0 || row >= this.numQbit) return;
        while (col >= this.numColumns) {
            for (const r of this.#components) r.push(null);
        }

        if (c) {
            if (c.spans === "column" && !this.isColumnEmpty(col)) return;
            if (c.type === "swap") {
                if (this.#columnIsBlocked(col)) return;
                if (this.#columnHasNonSwap(col)) return;
                if (this.#countSwapsInColumn(col) >= 2) return;
            } else if (c.spans === "cell") {
                if (this.#columnIsBlocked(col)) return;
                if (this.#isSwapColumn(col)) return;
            }
        }

        this.#components[row][col] = c;
        if (c && this.#needsDisplay) c.needsDisplay = this.#needsDisplay;
        this.#fireDidChange();
    }

    findSpanningAt(
        x: number,
        y: number,
    ): { row: number; col: number; component: CircuitComponent } | null {
        if (this.numQbit === 0) return null;
        const top = this.rowTopY(0);
        const lastRow = this.numQbit - 1;
        const bottom = this.rowTopY(lastRow) + this.heightOfRow(lastRow);
        if (y < top || y >= bottom) return null;

        for (let j = 0; j < this.numColumns; j++) {
            const colW = this.widthOfColumn(j);
            const colLeft = this.columnLeftX(j);
            if (x < colLeft || x >= colLeft + colW) continue;
            const spanning = this.#columnSpanningAt(j);
            if (spanning) {
                for (let r = 0; r < this.numQbit; r++) {
                    if (this.#components[r][j] === spanning) {
                        return { row: r, col: j, component: spanning };
                    }
                }
            }
        }
        return null;
    }

    widthOfColumn(index: number): number {
        if (index >= this.numColumns) return 0;
        const spanning = this.#columnSpanningAt(index);
        if (spanning) {
            const pref = spanning.preferredColumnWidth ?? spanning.width;
            return Math.max(pref, this.s.minColumnWidth);
        }
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

    #extraHeightForColumn(col: number): number {
        const spanning = this.#columnSpanningAt(col);
        if (!spanning) return 0;
        const pref = spanning.preferredColumnHeight;
        if (pref == null) return 0;
        const rowsHeight = this.#rowStackHeight();
        return Math.max(0, pref - rowsHeight);
    }

    #rowStackHeight(): number {
        if (this.numQbit === 0) return 0;
        const lastRow = this.numQbit - 1;
        return (
            this.rowTopY(lastRow) + this.heightOfRow(lastRow) - this.rowTopY(0)
        );
    }

    removeAt(row: number, col: number) {
        if (row < 0 || row >= this.numQbit) return;
        if (col < 0 || col >= this.numColumns) return;

        this.#components[row][col] = null;
        this.#fireDidChange();

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
        this.#fireDidChange();
    }

    removeColumnIfEmpty(col: number) {
        if (this.numColumns <= 1) return;
        if (this.isColumnEmpty(col)) {
            this.removeColumn(col);
        }
    }

    getComponentAt(row: number, col: number): CircuitComponent | null {
        if (row < 0 || row >= this.numQbit) return null;
        if (col < 0 || col >= this.numColumns) return null;
        return this.#components[row][col];
    }

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
        const h = this.#rowStackHeight();
        let extra = 0;
        for (let j = 0; j < this.numColumns; j++) {
            extra = Math.max(extra, this.#extraHeightForColumn(j));
        }
        return h + extra;
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
                if (this.#columnIsBlocked(j)) return null;
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
        this.#fireDidChange();
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

        if (component.spans === "column") {
            if (!this.isColumnEmpty(target.col)) return;
            this.#components[target.row][target.col] = component;
        } else if (component.type === "swap") {
            // Swap target: only allowed in columns that are empty or contain
            // only other swaps. Cap at 2 per column.
            if (this.#columnIsBlocked(target.col)) return;
            if (this.#columnHasNonSwap(target.col)) return;
            if (this.#countSwapsInColumn(target.col) >= 2) return;
            if (this.#components[target.row][target.col] != null) return;
            this.#components[target.row][target.col] = component;
        } else {
            // Single cell, normal gate. Forbidden in column-locked or swap-only columns.
            if (this.#columnIsBlocked(target.col)) return;
            if (this.#isSwapColumn(target.col)) return;
            if (this.#components[target.row][target.col] != null) return;
            this.#components[target.row][target.col] = component;
        }

        if (this.#needsDisplay) component.needsDisplay = this.#needsDisplay;
        this.#fireDidChange();

        if (
            component.type === "bloch-inspector" ||
            component.type === "fidelity-inspector" ||
            component.type === "density-inspector"
        ) {
            component.setQubitInfo?.(null);
            component.setStage?.(null);
        }
    }

    canDropAt(
        target: { row: number; col: number; insert: boolean },
        component: CircuitComponent,
    ): boolean {
        if (target.row < 0 || target.row >= this.numQbit) return false;
        if (target.col < 0) return false;
        if (target.insert) return true;

        if (target.col >= this.numColumns) return true;

        if (component.spans === "column") {
            return this.isColumnEmpty(target.col);
        }
        if (component.type === "swap") {
            if (this.#columnIsBlocked(target.col)) return false;
            if (this.#columnHasNonSwap(target.col)) return false;
            if (this.#countSwapsInColumn(target.col) >= 2) return false;
            return this.#components[target.row][target.col] == null;
        }

        if (this.#columnIsBlocked(target.col)) return false;
        if (this.#isSwapColumn(target.col)) return false;
        return this.#components[target.row][target.col] == null;
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

    #countSwapsInColumn(col: number): number {
        if (col < 0 || col >= this.numColumns) return 0;
        let n = 0;
        for (let r = 0; r < this.numQbit; r++) {
            if (this.#components[r][col]?.type === "swap") n++;
        }
        return n;
    }

    #columnHasNonSwap(col: number): boolean {
        if (col < 0 || col >= this.numColumns) return false;
        for (let r = 0; r < this.numQbit; r++) {
            const c = this.#components[r][col];
            if (c && c.type !== "swap") return true;
        }
        return false;
    }

    #isSwapColumn(col: number): boolean {
        // Has at least one swap and nothing else (besides null cells).
        return (
            this.#countSwapsInColumn(col) > 0 && !this.#columnHasNonSwap(col)
        );
    }

    get verticalShift(): number {
        let maxExtra = 0;
        for (let j = 0; j < this.numColumns; j++) {
            maxExtra = Math.max(maxExtra, this.#extraHeightForColumn(j));
        }
        return maxExtra / 2;
    }

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

        let maxExtra = 0;
        for (let j = 0; j < this.numColumns; j++) {
            maxExtra = Math.max(maxExtra, this.#extraHeightForColumn(j));
        }
        const verticalShift = maxExtra / 2;
        if (verticalShift > 0) {
            ctx.translate(0, verticalShift);
        }

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
                if (!c) continue;
                if (c.type === "bloch-inspector") continue; // never participates
                occupied.push(i);
                if (c.type === "control" || c.type === "not-control") {
                    hasControl = true;
                } else if (c.type !== "swap") {
                    hasNonControlGate = true;
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

            const swapRows: number[] = [];
            for (let i = 0; i < this.numQbit; i++) {
                if (this.#components[i][j]?.type === "swap") swapRows.push(i);
            }
            if (swapRows.length === 2) {
                const x2 = this.columnCenterX(j);
                ctx.save();
                ctx.strokeStyle = this.options.controlLineColor;
                ctx.lineWidth = this.s.controlLineWidth;
                ctx.beginPath();
                ctx.moveTo(x2, this.rowCenterY(swapRows[0]));
                ctx.lineTo(x2, this.rowCenterY(swapRows[1]));
                ctx.stroke();
                ctx.restore();
            }
        }

        // actual components
        for (let j = 0; j < this.numColumns; j += 1) {
            // Column-spanning: paint once across the full column height.
            const spanning = this.#columnSpanningAt(j);
            if (spanning) {
                const colW = this.widthOfColumn(j);
                const colX = this.columnLeftX(j);
                const baseColH = this.#rowStackHeight();
                const extra = this.#extraHeightForColumn(j);
                const colH = baseColH + extra;
                const topY = this.rowTopY(0) - extra / 2;
                ctx.save();
                ctx.translate(colX, topY);
                spanning.drawSpanning(ctx, colW, colH);
                ctx.restore();
                continue;
            }

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

        if (ghost) {
            if (!this.canDropAt(ghost.target, ghost.component)) {
                ctx.restore();
                return;
            }

            // Spanning component being dragged → preview as full-column rect.
            if (ghost.component.spans === "column") {
                const rect = this.ghostRect(ghost.target);
                if (rect.width > 0) {
                    const slotW = Math.max(rect.width, ghost.component.width);
                    const baseColH = this.#rowStackHeight();
                    const prefH = ghost.component.preferredColumnHeight;
                    const extra =
                        prefH != null ? Math.max(0, prefH - baseColH) : 0;
                    const colH = baseColH + extra;
                    const topY = this.rowTopY(0) - extra / 2;
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.translate(rect.x, topY);
                    ghost.component.drawSpanning(ctx, slotW, colH, true);
                    ctx.restore();
                }
                ctx.restore();
                return;
            }

            // Single-cell ghost.
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
