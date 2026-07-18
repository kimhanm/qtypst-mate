import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";


export interface CompileOptions {
    workspace: string;
    fontPaths?: string[];
}


export interface RenderResult {
    svg: string;
    baselinePosition?: number;
}

export class TypstError extends Error {}


// The baseline trick is from rehype-typst:
// we inject a pin into the equation, and use #measure
// to figure out the y-position of the pin, from which
// we can compute the baseline position
const BASELINE_LABEL = "qtm-baseline";

export const BASELINE_PRELUDE = `
#let qtmstate = state("qtm", (:))
#let qtmpin(t) = context {
    let width = measure(line(length: here().position().y)).width
    qtmstate.update(it => it.insert(t, width) + it)
}
`;
export const BASELINE_QUERY = `
#context [
    #metadata(qtmstate.final().at("l1", default: none)) <${BASELINE_LABEL}>
]
`;

let compiler: NodeCompiler | undefined;

let compilerKey: string | undefined;

const cache = new Map<string, RenderResult>();

function getCompiler(opts: CompileOptions): NodeCompiler {
    const key = JSON.stringify([opts.workspace, opts.fontPaths ?? []]);
    if (!compiler || compilerKey !== key) {
        compiler = NodeCompiler.create({
            workspace: opts.workspace,
            ...(opts.fontPaths?.length ? { fontArgs: [{ fontPaths: opts.fontPaths }] } : {}),
        });
            compilerKey = key;
            cache.clear();
    }
    return compiler;
}

export function renderToSVG(
    mainFileContent: string,
    opts: CompileOptions,
    withBaseline: boolean,
): RenderResult {
    const cached = cache.get(mainFileContent);
    if (cached) return cached;

    const $typst = getCompiler(opts);
    const docRes = $typst.compile({ mainFileContent });
    if (!docRes.result) {
        const diags = $typst.fetchDiagnostics(docRes.takeDiagnostics()!);
        throw new TypstError(
            diags.map((d) => String((d as { message?: unknown }).message ?? d)).join("\n") ||
                "typst compilation failed",
        );
    }

    const doc = docRes.result;
    
    const result: RenderResult = { svg: $typst.svg(doc) };
    if (withBaseline) {
        const query = $typst.query(doc, { selector: `<${BASELINE_LABEL}>`}) as {
            value: unknown;
        }[];
        const value = query[0]?.value;
        if (typeof value === "string" && value.endsWith("pt")) {
            result.baselinePosition = parseFloat(value.slice(0, -2));
        }
    }

    $typst.evictCache(10);
    if (cache.size > 1000) cache.clear();
    cache.set(mainFileContent, result);
    return result;
}

