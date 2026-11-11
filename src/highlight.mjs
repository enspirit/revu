// Colour for the source view. The constraint that shapes this file: the view
// is one row per line, because a line is what a remark is anchored to — so the
// highlighter's output has to be cut into lines without a span ever crossing
// one, and if the cut does not come out even, we show plain text instead.
import hljs from 'highlight.js'
import { ext } from './scan.mjs'

const BY_EXT = {
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  tsx: 'typescript',
  mts: 'typescript',
  // A single-file component is close enough to markup for the parts that
  // matter: tags, attributes, strings, comments.
  vue: 'xml',
  astro: 'xml',
  svelte: 'xml',
  html: 'xml',
  htm: 'xml',
  feature: 'gherkin',
  toml: 'ini',
  tf: 'terraform',
  hcl: 'terraform',
  zsh: 'bash',
  sh: 'bash',
  h: 'c',
  hpp: 'cpp',
  pl: 'perl',
  prisma: 'typescript',
}

const BY_NAME = {
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Rakefile: 'ruby',
  Gemfile: 'ruby',
  Justfile: 'makefile',
  Procfile: 'yaml',
}

export const languageFor = (path) => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const name = BY_NAME[base] ?? BY_EXT[ext(path)] ?? ext(path)
  return hljs.getLanguage(name) ? name : null
}

// highlight.js happily opens a span on one line and closes it three lines
// later. Close what is open at every newline and reopen it on the next, so
// each line stands alone.
export const splitLines = (html) => {
  const open = []
  const out = []
  let line = ''
  for (const token of html.split(/(<[^>]+>|\n)/)) {
    if (token === '') continue
    if (token === '\n') {
      out.push(line + '</span>'.repeat(open.length))
      line = open.join('')
    } else if (token.startsWith('</')) {
      open.pop()
      line += token
    } else if (token.startsWith('<')) {
      open.push(token)
      line += token
    } else line += token
  }
  out.push(line + '</span>'.repeat(open.length))
  return out
}

const MAX_LINES = 6000

export const highlight = (path, lines) => {
  const language = languageFor(path)
  if (!language || lines.length > MAX_LINES) return null
  try {
    const { value } = hljs.highlight(lines.join('\n'), { language, ignoreIllegals: true })
    const rows = splitLines(value)
    // The gutter is the contract. If the cut disagrees with the file, plain
    // text is the right answer, not a view whose line 40 is somebody else's.
    return rows.length === lines.length ? rows : null
  } catch {
    return null
  }
}
