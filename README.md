# quartz plugin qtypst-mate
Typst rendering [Quartz](https://quartz.jzhao.xzy) plugin compatible with the Obsidian plugin [typst-mate](https://github.com/azyarashi/obsidian-typst-mate).
Math and typst blocks are rendered to SVG at build-time.


Will hopefully be added to `@quartz-community/qtypst-mate`

## Features
- inline (`$...$`) and display (`$$...$$`) math
- tag-based preamble includes (see typst-mate)
- per-file fallback engine `math-engine: katex`
- per-expression fallback engine `$tex: \int_\Omega \mathrm{d} \omega$`
- customizable codeblock processors: ` ```typst `, ` ```fletcher `, ...
- download packges from [Typst Universe](https://typst.app/universe/) (`@preview`) 



## Installation
Disable the `latex` plugin.
```bash
npx quartz plugin add #TODO
```


```yaml title="quartz.config.yaml"
plugins:
  - source: #TODO
    enabled: true
    options:
      renderEngine: katex
```

## Configuration #TODO

| Option           | Type                               | Default     | Description                            |
| ---------------- | ---------------------------------- | ----------- | -------------------------------------- |
| `renderEngine`   | `"katex" \| "mathjax" \| "typst"`  | `"katex"`   | The rendering engine to use for LaTeX. |
| `customMacros`   | `Record<string, string \| Args[]>` | `{}`        | Custom LaTeX macros.                   |
| `katexOptions`   | `KatexOptions`                     | `undefined` | Options for the KaTeX engine.          |
| `mathJaxOptions` | `MathjaxOptions`                   | `undefined` | Options for the MathJax engine.        |
| `typstOptions`   | `TypstOptions`                     | `undefined` | Options for the Typst engine.          |

- The tag-file registry is scanned on build, `quartz serve` has to be ren after adding/renaming files in `<importpath>/tags/`.

## Documentation #TODO
 
See the [Quartz documentation](https://quartz.jzhao.xyz/plugins/Latex) for more information.

## License

MIT
