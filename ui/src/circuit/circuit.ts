import type { Gate } from "../gate/gate";

export class Circuit {
    #components: (Gate | "measurement" | "density" | null)[][];
}
