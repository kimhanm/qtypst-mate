import { defineConfig } from "tsup";
import { readFile } from "fs/promises";
import { dirname } from "path";
import type { Plugin } from "esbuild";

// jsdom's XMLHttpRequest-impl.js calls require.resolve("./xhr-sync-worker.js") at load time.
// When bundled, this resolves relative to dist/ where the file doesn't exist.
// rehype-mathjax never uses synchronous XHR, so we patch it to null at build time.
// See: https://github.com/evanw/esbuild/issues/1311
const jsdomPatch: Plugin = {
  name: "jsdom-patch",
  setup(build) {
    build.onLoad({ filter: /XMLHttpRequest-impl\.js$/ }, async (args) => {
      let contents = await readFile(args.path, "utf8");
      contents = contents.replace(
        'const syncWorkerFile = require.resolve ? require.resolve("./xhr-sync-worker.js") : null;',
        "const syncWorkerFile = null;",
      );
      return { contents, loader: "js", resolveDir: dirname(args.path) };
    });
  },
};

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  splitting: false,
  noExternal: ["@quartz-community/types", "@quartz-community/utils"],
  outDir: "dist",
  platform: "node",
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
  esbuildPlugins: [jsdomPatch],
  esbuildOptions(options) {
    options.define = {
      ...options.define,
      PACKAGE_VERSION: '"3.2.1"',
    };
  },
});
