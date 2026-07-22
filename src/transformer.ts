import path from "node:path";
import type { Element, ElementContent, Root } from "hast";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import katex from "katex";
import remarkMath from "remark-math";
import { SKIP, visitParents } from "unist-util-visit-parents";
import type { VFile } from "vfile";
import type { QuartzTransformerPlugin } from "@quartz-community/types";

import {
  DEFAULT_PROCESSORS,
  dispatchDisplay,
  dispatchInline,
  type Processor,
  type ProcessorKind,
  type ProcessorSets,
  usesLatexRenderer,
} from "./processor";

import { buildNotePreamble, type NoteFrontmatter, scanTagFiles } from "./preamble";
import { BASELINE_PRELUDE, BASELINE_QUERY, renderToSVG, TypstError } from "./typst";

export interface QTypstMateOptions {
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
export function resolveMathEngine(
  noteEngine: unknown,
  defaultEngine: "typst" | "katex",
): "typst" | "katex" {
  if (noteEngine === "typst") return "typst";
  if (noteEngine === "mathjax" || noteEngine === "katex" || noteEngine === "latex") return "katex";
  return defaultEngine;
}

export const DEFAULT_PREAMBLE = [
  "#set page(margin: 0pt, width: auto, height: auto)",
  "#show raw: set text(size: 1.25em)",
  "#set text(size: fontsize)",
].join("\n");

const defaultOptions: QTypstMateOptions = {
  importPath: "typstmate",
  preamble: DEFAULT_PREAMBLE,
  fontSize: 12,
  fontPaths: [],
  processors: {},
  errorColor: "#ff0000",
  defaultMathEngine: "typst",
};

const TYPSTMATE_CSS = `
.typstmate-inline path:not([stroke]),
.typstmate-display path:not([stroke]),
figure.typstmate-codeblock path:not([stroke]) { stroke: none !important; }
.typstmate-display { display: block; margin 0.5rem 0; overflow-x: auto; }
.typstmate-display.typstmate-style-block-center { text-align: center; }
.typstmate-inline.typstmate-style-middle { vertical-align: middle; }
.typstmate-inline.typstmate-style-middle svg { vertical-align: 0 !important; }
figure.typstmate-codeblock { margin: 1rem 0; overflow-x: auto; }
figure.typstmate-codeblock.typstmate-style-block-center { text-align: center; }
`;

interface RehypeOptions extends QTypstMateOptions {
  contentDir: string;
  allProcessors: ProcessorSets;
}

export const QTypstMate: QuartzTransformerPlugin<Partial<QTypstMateOptions>> = (userOpts) => {
  const opts: QTypstMateOptions = { ...defaultOptions, ...userOpts };
  const allProcessors: ProcessorSets = {
    inline: opts.processors.inline ?? DEFAULT_PROCESSORS.inline,
    display: opts.processors.display ?? DEFAULT_PROCESSORS.display,
    codeblock: opts.processors.codeblock ?? DEFAULT_PROCESSORS.codeblock,
  };
  return {
    name: "QTypstMate",
    markdownPlugins() {
      return [remarkMath, remarkPreserveMathMeta];
    },
    htmlPlugins(ctx) {
      const contentDir = path.resolve(ctx.argv.directory);
      return [[rehypeTypstMate, { ...opts, contentDir, allProcessors } satisfies RehypeOptions]];
    },
    externalResources() {
      return {
        css: [
          { content: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" },
          { content: TYPSTMATE_CSS, inline: true },
        ],
      };
    },
  };
};

/** remark-math parses `$$block` as the meta string,
 * but we need to drop it for remark-rehype
 * and pass it on through hProperties (analogous to typst-mate)
 */
function remarkPreserveMathMeta() {
  return (tree: unknown) => {
    const walk = (node: {
      type?: string;
      meta?: string;
      data?: { hProperties?: Record<string, unknown> };
      children?: unknown[];
    }) => {
      if (node.type === "math" && typeof node.meta === "string" && node.meta.length > 0) {
        node.data = {
          ...node.data,
          hProperties: { ...node.data?.hProperties, dataTypstProcessor: node.meta },
        };
      }
      for (const child of node.children ?? []) walk(child as typeof node);
    };
    walk(tree as { children?: unknown[] });
  };
}

/** see unified and quartz transformer doc
 * and LaTeX plugin for reference
 * we are essentially traversing the HTML tree and dispaching the correct
 * processor depending on the expected <code class="???">
 * care must be taken to handle the meta string correctly
 */
function rehypeTypstMate(options: RehypeOptions) {
  const registry = scanTagFiles(options.contentDir, options.importPath);
  return (tree: Root, file: VFile) => {
    const frontmatter = file.data.frontmatter as
      | (NoteFrontmatter & Record<string, unknown>)
      | undefined;
    const notePreamble = buildNotePreamble(frontmatter, registry, options.importPath);
    const engine = resolveMathEngine(frontmatter?.["math-engine"], options.defaultMathEngine);
    const forceLatex = engine === "katex";

    visitParents(tree, "element", (element, parents) => {
      const classes = Array.isArray(element.properties.className)
        ? (element.properties.className as string[])
        : [];

      let kind: ProcessorKind | undefined;
      let scope: Element = element;
      let parent = parents[parents.length - 1];
      let codeblockProcessor: Processor | undefined;

      let displayMeta: string | undefined;
      if (classes.includes("math-inline")) {
        kind = "inline";
      } else if (classes.includes("math-display")) {
        kind = "display";
        // display math becomes <pre><code class="math-display">
        // the `$$block` meta string is inside <pre>
        if (parent?.type === "element" && parent.tagName === "pre") {
          scope = parent;
          parent = parents[parents.length - 2];
          const meta = scope.properties?.dataTypstProcessor;
          if (typeof meta === "string") displayMeta = meta;
        }
      } else if (
        element.tagName === "code" &&
        parent?.type === "element" &&
        parent.tagName === "pre"
      ) {
        const language = classes.find((c) => c.startsWith("language-"))?.slice("language-".length);
        if (!language) return;
        if (language === "math") {
          kind = "display";
          codeblockProcessor =
            options.allProcessors.display[options.allProcessors.display.length - 1];
        } else {
          codeblockProcessor = options.allProcessors.codeblock.find((p) => p.id === language);
          if (!codeblockProcessor) return;
          kind = "codeblock";
        }
        scope = parent;
        parent = parents[parents.length - 2];
      } else {
        return;
      }
      if (!parent || (parent.type !== "element" && parent.type !== "root")) return;

      let code = toText(scope, { whitespace: "pre" });
      let replacement: ElementContent[];
      try {
        // dispatch correct processor
        // `$$block` and `$id:` meta is handled by dispatch{Inline,Block}
        if (forceLatex && kind !== "codeblock") {
          replacement = renderLatex(code, kind);
        } else {
          let processor: Processor;
          if (kind === "inline") {
            ({ processor, code } = dispatchInline(options.allProcessors.inline, code));
          } else if (kind === "display" && !codeblockProcessor) {
            ({ processor, code } = dispatchDisplay(
              options.allProcessors.display,
              code,
              displayMeta,
            ));
          } else {
            processor = codeblockProcessor!;
          }
          replacement = usesLatexRenderer(processor.renderingEngine)
            ? renderLatex(code, kind)
            : renderTypst(code, kind, processor, notePreamble, options);
        }
      } catch (error) {
        file.message(`Failed to render ${kind}: ${String(error)}`, {
          place: element.position,
          source: "qtypst-mate",
        });
        replacement = [errorSpan(code, error, options.errorColor)];
      }

      const index = parent.children.indexOf(scope);
      parent.children.splice(index, 1, ...replacement);
      return SKIP;
    });
  };
}

function renderTypst(
  code: string,
  kind: ProcessorKind,
  processor: Processor,
  notePreamble: string,
  options: RehypeOptions,
): ElementContent[] {
  // baseline is not relevant for display math
  const withBaseline =
    kind === "inline" && processor.format.includes("${CODE}$") && processor.styling != "middle";
  // see rehype-typst for how the qtmpin/qtpstate hackery works
  const template = withBaseline
    ? processor.format.replace("${CODE}$", '$qtmpin("l1"){CODE}$')
    : processor.format;
  const body = processor.useReplaceAll
    ? template.replaceAll("{CODE}", code)
    : template.replace("{CODE}", code);

  // recall: fontSize is the conversion factor fontSize * pt == 1em
  const source = [
    `#let fontsize = ${options.fontSize}pt`,
    processor.noPreamble ? "" : options.preamble,
    notePreamble,
    withBaseline ? BASELINE_PRELUDE : "",
    body,
    withBaseline ? BASELINE_QUERY : "",
  ]
    .filter((part) => part.length > 0)
    .join("\n");

  const result = renderToSVG(
    source,
    { workspace: options.contentDir, fontPaths: options.fontPaths },
    withBaseline,
  );

  // analogous to typst-mate's handling of base color (for dark/light themes etc.)
  const svg = result.svg
    .replaceAll('"#ffffff"', '"var(--typst-bg-color, var(--light, #ffffff))"')
    .replaceAll('"#fff"', '"var(--typst-bg-color, var(--light, #ffffff))"')
    .replaceAll('"#000000"', '"var(--typst-base-color, currentColor)"')
    .replaceAll('"#000"', '"var(--typst-base-color, currentColor)"');
  const root = fromHtmlIsomorphic(svg, { fragment: true });
  const svgEl = root.children[0] as Element;
  const height = parseFloat(String(svgEl.properties.dataHeight));
  const width = parseFloat(String(svgEl.properties.dataWidth));

  if (Number.isFinite(height) && Number.isFinite(width)) {
    svgEl.properties.height = `${height / options.fontSize}em`;
    svgEl.properties.width = `${width / options.fontSize}em`;
    if (kind === "inline") {
      const shift =
        result.baselinePosition !== undefined ? height - result.baselinePosition : height / 2;
      svgEl.properties.style = `vertical-align: -${(shift / options.fontSize).toFixed(4)}em;`;
    }
  }

  const classNames = [`typstmate-${kind}`, `typstmate-style-${processor.styling}`];
  if (processor.id.length > 0) classNames.push(`typstmate-id-${processor.id}`);

  return [
    {
      type: "element",
      tagName: kind === "codeblock" ? "figure" : "span",
      properties: { className: classNames },
      children: root.children as ElementContent[],
    },
  ];
}

function renderLatex(code: string, kind: ProcessorKind): ElementContent[] {
  const html = katex.renderToString(code, {
    displayMode: kind !== "inline",
    throwOnError: false,
    output: "html",
  });

  return fromHtmlIsomorphic(html, { fragment: true }).children as ElementContent[];
}

function errorSpan(code: string, error: unknown, color: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["qtypstmate-error"],
      style: `color: ${color};`,
      title: error instanceof TypstError ? error.message : String(error),
    },
    children: [{ type: "text", value: code }],
  };
}
