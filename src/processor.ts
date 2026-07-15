/**
 * aliases "typst-svg" and "mathjax" from typst-mate availables
 * even though we don't have mathjax
 */
export type RenderingEngine = "typst" | "katex";

export function usesLatexRenderer(engine: string): boolean {
    return engine === "katex" || engine == "mathjax";
}


export type ProcessorKind = "inline" | "display" | "codeblock";

export interface Processor {
    id: string;
    renderingEngine: RenderingEngine;
    /** string, where `{CODE}` is replace with given source */
    format: string;
    styling: string;
    /** skips global preamble if true */
    noPreamble?: boolean;
    useReplaceAll?: boolean;
}

export interface ProcessorSets {
    inline: Processor[];
    display: Processor[];
    codeblock: Processor[];
}


// defaults taken from original typst-mate
// the processors must be ordered to have
// the fallback (id: "") be last or else our dispatch match
// would always match id: ""
export const DEFAULT_PROCESSORS: ProcessorSets = {
    inline: [
        {
            id: "display",
            renderingEngine: "typst",
            format: "#set page(margin: (x: 0pt, y: 0.3125em))\n#math.equation($ {CODE} $, block: false)",
            styling: "inline",
        },
        {
            id: "tex",
            renderingEngine: "katex",
            // offload processing to katex, no format required 
            format: "",
            styling: "inline",
        },
        {
            id: "",
            renderingEngine: "typst",
            format: "#set page(margin: (x: 0pt, y: 0.3125em))\n${CODE}$",
            styling: "inline",
        },
    ],
    display: [
        {
            id: "block",
            renderingEngine: "typst",
            format: "{CODE}",
            styling: "block",
        },
        { 
            id: "",
            renderingEngine: "typst",
            format: "$ {CODE} $",
            styling: "block-center"
        },
    ],
    codeblock: [
        {
            id: "fletcher",
            renderingEngine: "typst",
            format: '#import "@preview/fletcher:0.5.8" as flecther: diagram, node, edge\n{CODE}',
            styling: "block-center",
        },
        {
            id: "typst",
            renderingEngine: "typst",
            format: "{CODE}",
            styling: "block-center",
        },
    ],
};


/** 
 * analogue to typst-mate's extarctCMMath [sic]
 */
export function dispatchInline(
    processors: Processor[],
    code: string
): { processor: Processor; code: string } {
/* The original has this block which seems to be for "people"
 * who like to add padding to their math blocks: i.e.
 * ${} x {}$ which is absolutely insane to me.
 * This is the type of shit that just causes unnecessary bugs, so we
 * don't ship this behaviour.
 * In the name of (capital B) Backwards compatibility, you may
 * uncomment the following block
 *
 *  if (code.startsWith("{} ")) code = code.slice(3);
 *  else if (code.startsWith("{}")) code = code.slice(2);
 *  if (code.endsWith(" {}")) code = code.slice(0, -3);
 *  else if (code.startsWith("{}")) code = code.slice(0, -2);
 */
    // matches aggressively along the list
    // added guard in case id: "" somehow ends up in the middle
    // 
    const processor = 
        processors.find((p) => p.id.length > 0 && code.startsWith(`${p.id}:`)) ??
        processors[processors.length - 1]!;
    if (processor.id.length > 0) code = code.slice(processor.id.length + 1);
    return { processor, code };
}


/**
 * remark-math parses the fence `$$block` as the _meta_ string
 */
export function dispatchDisplay(
    processors: Processor[],
    code: string,
    meta?: string,
): { processor: Processor; code: string } {
    const fallback = processors[processors.length - 1]!;
    if (meta != undefined && meta.length > 0) {
        const processor = processors.find((p) => p.id === meta);
        if (processor) return { processor, code };
        return { processor: fallback, code: `${meta}\n${code}` };
    }
    const processor = 
        processors.find((p) => p.id.length > 0 && code.startsWith(`${p.id}:`)) ??
        processors[processors.length - 1]!;
    if (processor.id.length > 0) code = code.slice(processor.id.length + 1);
    return { processor, code };
}



