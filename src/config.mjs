// revu reads a project; it writes nothing into it. The one exception is this
// file, and only when `revu init` is asked for by name.
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'yaml'

export const CONFIG_NAME = 'revu.yml'

const DECISION_DIRS = [
  'doc/decisions',
  'docs/decisions',
  'doc/adr',
  'docs/adr',
  'decisions',
  'adr',
  'doc/architecture/decisions',
]

export const detectDecisions = (paths) =>
  DECISION_DIRS.find((dir) => paths.some((p) => p.startsWith(dir + '/'))) ?? null

export const defaults = (root) => ({
  title: basename(root),
  reading: [],
  exclude: [],
  decisions: null,
  scopes: [],
  maxFileBytes: 500_000,
})

// A declared scope is a command and a name. It is never run on load — only when
// a reader enters it, with the command shown on the row they click.
const scope = (raw, i) => ({
  id: `run:${i}`,
  title: raw.title ?? raw.run,
  hint: raw.hint ?? raw.run,
  command: raw.run,
})

export const merge = (root, raw) => {
  const cfg = { ...defaults(root), ...(raw ?? {}) }
  return {
    ...cfg,
    reading: [...cfg.reading],
    exclude: cfg.exclude.map((p) => p.replace(/\/$/, '')),
    scopes: cfg.scopes.filter((s) => s?.run).map(scope),
  }
}

export const load = (root) => {
  const file = join(root, CONFIG_NAME)
  const raw = existsSync(file) ? parse(readFileSync(file, 'utf8')) : null
  return merge(root, raw)
}

export const template = (root, reading) =>
  `# Read by revu (https://github.com/blambeau/revu). Nothing else here is touched.
title: ${basename(root)}

# The order a newcomer should meet this project in. Everything else follows.
reading:
${reading.map((p) => `  - ${p}`).join('\n') || '  []'}

# Paths revu should not read at all.
exclude: []

# Scopes of your own. Anything that prints \`path:line: message\` — a linter, a
# type checker, grep — is a list of places to look. Each runs only when you
# enter it, never on load.
# scopes:
#   - title: Lint
#     run: npx oxlint --format=unix
#   - title: Types
#     run: npx tsc --noEmit
`
