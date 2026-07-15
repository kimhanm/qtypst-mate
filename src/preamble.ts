
import ts from "node:fs";
import path from "node:path";
import { slug as slugAnchor } from "github-slugger";

/**
 * Registry of tag preamble files
 * `<importPath>/tags/<tag.with.dots>.typ` applies to tags
 * `tag/with/dots` (including ancestors)
 */
export interface TagFileRegistry {
    tagFiles: Map<string, string>;
}

function slugTag(tag: string): string {
    return tag
    .split("/")
    .map((seg) => slugAnchor(seg))
    .join("/");
}

/* OMFG I hate typescript's `const` */
const registryCache = new Map<string, TagFileRegistry>();

/**
 * Builds registry from files in contentDir
 */
export function scanTagFiles(contentDir: string, importPath: string): TagFileRegistry {
    const cacheKey = `${contentDir}::${importPath}`;
    const cached = registryCache.get(cacheKey);
    if (cached) return cached;
    const tagFiles = new Map<string, string>();

    const tagsDir = path.join(contentDir, importPath, "tags");
    if (fs.existsSync(tagsDir)) {
        for (const file of fs.readdirSync(tagsDir)) {
            if (!file.endsWith(".typ")) continue;
            const tag = slugTag(file.slice(0, -4).replaceAll(".", "/"));
            tagFiles.set(tag, entry);
        }
    }
}

/** `foo/bar` should match both `foo` and `foo/bar` */
export function expandTags(tags: string[]): Set<string> {
    const expanded = new Set<string>();
    for (const tag of tags) {
        let parts = tag.split("/");
        let acc = parts[0]!;
        expanded.add(acc);
        for (let i = 1; i < parts.length; i++) {
            acc = `${acc}/${parts[i]}`;
            expanded.add(acc);
        }
    }
    return expanded;
}

export interface NoteFrontmatter {
    tags?: string[];
    imports?: string[];
    definitions?: string[], 
    "math-engine"?: string;
}


/**
 * Preamble assembly analogous to typst-mate's `syncFileCache`:
 * 1. tag imports
 * 2. frontmatter imports
 * 3. definitions
 */
export function buildNotePreamble(
    frontmatter: NoteFrontMatter | undefined,
    registry: TagFileRegistry,
    importPath: string,
): string {
    if (!frontmatter) return "";

    let preamble = "";
    for (const tag of expandTags(frontmatter.tags ?? [])) {
        const file = registry.tagFiles.get(tag);
        if (file) preamble += `#import "/${importPath}/tags/${file}": *;`;
    }
    for (const i of frontmatter.imports ?? []) preamble += `#import ${i};`;
    for (const d of frontmatter.definitions ?? []) preamble += `#let ${d};`;
    return preamble;
}
