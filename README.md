# quartz plugin qtypst-mate

Typst rendering [Quartz](https://quartz.jzhao.xzy) plugin compatible with the Obsidian plugin [typst-mate](https://github.com/azyarashi/obsidian-typst-mate). Scaffolding forked from [quartz-community/latex](https://github.com/quartz-community/latex).
Math and typst blocks are rendered to SVG at build-time.

See examples at <https://zosoz.org/garden/quartz-typst-mate-plugin>.

## Features

- inline (`$...$`) and display (`$$...$$`) math
- tag-based preamble includes (see typst-mate)
- per-file fallback engine `math-engine: katex`
- per-expression fallback engine `$tex: \int_\Omega \mathrm{d} \omega$`
- customizable codeblock processors: ` ```typst `, ` ```fletcher `, ...
- download packges from [Typst Universe](https://typst.app/universe/) (`@preview`)

## Installation

1. Disable the `latex` plugin

```yaml title="quartz.config.yaml"
plugins:
  # ...
  - source: github:quartz-community/latex
    enabled: false
```

2. Add the plugin (TODO: update to `@quartz-community` once it's added there)

```bash
npx quartz plugin add github:kimhanm/qtypst-mate
```

## Documenta

See the [Quartz documentation](https://quartz.jzhao.xyz/plugins/Latex) for more information, as well as the documentation for [typst-mate](https://github.com/azyarashi/obsidian-typst-mate).

## License

MIT
