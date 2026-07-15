import { QuartzTransformerPlugin } from '@quartz-community/types';
export { QuartzTransformerPlugin } from '@quartz-community/types';

/**
 * aliases "typst-svg" and "mathjax" from typst-mate availables
 * even though we don't have mathjax
 */
type RenderingEngine = "typst" | "katex";
declare function usesLatexRenderer(engine: string): boolean;
type ProcessorKind = "inline" | "display" | "codeblock";
interface Processor {
    id: string;
    renderingEngine: RenderingEngine;
    /** string, where `{CODE}` is replace with given source */
    format: string;
    styling: string;
    /** skips global preamble if true */
    noPreamble?: boolean;
    useReplaceAll?: boolean;
}
interface ProcessorSets {
    inline: Processor[];
    display: Processor[];
    codeblock: Processor[];
}
declare const DEFAULT_PROCESSORS: ProcessorSets;

interface QTypstMateOptions {
    /** dir holding .typ files and tags/, analogue to typst-mate's importPath */
    importPath: string;
    /** Global Preamble used in every render */
    preamble: string;
    /** typst uses absolute font sizes (pt) instead of
    * relative font sizes (em), so we have to translate them
    * 1 pt * fontSize == 1 em */
    fontSize: number;
    fontPaths: string[];
    processors: Partial<ProcessorSets>;
    errorColor: string;
    defaultMathEngine: "typst" | "katex";
}
/** for compatibility with typst-mate which uses mathjax
 * we read "mathjax" to mean "use LaTeX" and use katex instead
 * unknown values use the default
 */
declare function resolveMathEngine(noteEngine: unknown, defaultEngine: "typst" | "katex"): "typst" | "katex";
declare const DEFAULT_PREAMBLE: string;
declare const QTypstMate: QuartzTransformerPlugin<Partial<QTypstMateOptions>>;

export { DEFAULT_PREAMBLE, DEFAULT_PROCESSORS, type Processor, type ProcessorKind, type ProcessorSets, QTypstMate, type QTypstMateOptions, type RenderingEngine, resolveMathEngine, usesLatexRenderer };
