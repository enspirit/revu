// revu reads a project; it writes nothing into it. The one exception is this
// file, and only when `revu init` is asked for by name.
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'yaml'

export const CONFIG_NAME = '.revu.yml'

const DECISION_DIRS = [
  'doc/decisions',
  'docs/decisions',
  'doc/adr',
  'docs/adr',
  'decisions',
  'adr',
  'doc/architecture/decisions',
]

// What a project gets when it has not said otherwise. `revu init` writes this
// list out in full, with every parameter visible, so that choosing scopes is
// editing a file rather than remembering a flag.
export const DEFAULT_SCOPES = [
  { use: 'reading' },
  { use: 'changed' },
  { use: 'commit' },
  { use: 'churn', days: 30, top: 15 },
  { use: 'largest', min: 250, top: 15 },
  { use: 'largest', min: 150, top: 15, kind: 'doc' },
  { use: 'untested', min: 80, top: 15 },
  { use: 'unreferenced', min: 20, top: 20 },
  { use: 'links' },
  { use: 'orphans' },
  { use: 'decisions' },
  { use: 'uncited' },
  { use: 'documents' },
  { use: 'todo', top: 50 },
  { use: 'all' },
]

export const detectDecisions = (paths) =>
  DECISION_DIRS.find((dir) => paths.some((p) => p.startsWith(dir + '/'))) ?? null

export const defaults = (root) => ({
  title: basename(root),
  reading: [],
  exclude: [],
  decisions: null,
  scopes: DEFAULT_SCOPES,
  maxFileBytes: 500_000,
})

// A scope is either one of ours, named by `use:` and tuned by the keys beside
// it, or a command of yours. Both carry whatever title and hint you give them.
const scope = (raw, i) => {
  const { use, run, title, hint, ...params } = raw ?? {}
  if (!use && !run) return null
  // The position is part of the id: the same built-in may be declared twice on
  // different parameters, and each is its own scope.
  return { id: `${use ?? 'run'}:${i}`, use: use ?? null, command: run ?? null, title, hint, params }
}

export const merge = (root, raw) => {
  const cfg = { ...defaults(root), ...(raw ?? {}) }
  return {
    ...cfg,
    reading: [...cfg.reading],
    exclude: cfg.exclude.map((p) => p.replace(/\/$/, '')),
    scopes: cfg.scopes.map(scope).filter(Boolean),
  }
}

export const load = (root) => {
  const file = join(root, CONFIG_NAME)
  const raw = existsSync(file) ? parse(readFileSync(file, 'utf8')) : null
  return merge(root, raw)
}

const asYaml = (s) =>
  `  - use: ${s.use}` +
  Object.entries(s)
    .filter(([k]) => k !== 'use')
    .map(([k, v]) => `\n    ${k}: ${v}`)
    .join('')

export const template = (root, reading) =>
  `# Read by revu. Nothing else in this directory is touched, and your remarks
# are kept outside it — see the README.
title: ${basename(root)}

# The order a newcomer should meet this project in.
reading:
${reading.map((p) => `  - ${p}`).join('\n') || '  []'}

# Paths revu should not read at all.
exclude: []

# The scopes offered in the left panel, in this order. Delete what you do not
# want; the numbers are yours to argue with — what counts as a large file is a
# question about this project, not about revu.
scopes:
${DEFAULT_SCOPES.map(asYaml).join('\n')}

# Scopes of your own: anything that prints \`path:line: message\` — a linter, a
# type checker, grep. Each runs only when you enter it, never on load.
#  - title: Lint
#    run: npx oxlint --format=unix
`
