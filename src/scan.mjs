// What counts as a readable file, and in what order a human should meet it.
// The walk is the only I/O here; everything below it is a function of a path list.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SKIP_DIR = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  '.astro',
  '.venv',
  'vendor',
])

const DOC_EXT = new Set(['md', 'mdx', 'adoc', 'txt'])

// Deliberately not "every text file": a lockfile or a minified asset is noise in
// a review, and a reviewer who wants it can still open it in an editor.
const CODE_EXT = new Set(
  (
    'ts tsx js mjs cjs jsx vue svelte astro py rb go rs java kt swift php ex exs ' +
    'sql sh bash zsh elo yml yaml toml json tf hcl css scss less html xml feature ' +
    'gradle rake gemspec cmake proto graphql prisma'
  ).split(' '),
)

const NAMED = new Set(['Dockerfile', 'Makefile', 'Rakefile', 'Gemfile', 'Procfile', 'Justfile'])

const NOISE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|Gemfile\.lock|.*\.min\.(js|css))$/

export const ext = (path) => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

export const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

export const kindOf = (path, decisionsDir) => {
  if (NOISE.test(path)) return null
  const e = ext(path)
  if (DOC_EXT.has(e)) return decisionsDir && path.startsWith(decisionsDir + '/') ? 'decision' : 'doc'
  const base = path.slice(path.lastIndexOf('/') + 1)
  if (CODE_EXT.has(e) || NAMED.has(base)) return 'code'
  return null
}

// git knows the ignore rules better than any list we could keep, so ask it first.
const gitFiles = (root) => {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return out.split('\n').filter(Boolean)
}

const walk = (root, dir = root, acc = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.github') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) walk(root, full, acc)
    } else if (e.isFile()) acc.push(relative(root, full).split(sep).join('/'))
  }
  return acc
}

export const listFiles = (root) => {
  try {
    return gitFiles(root)
  } catch {
    return walk(root)
  }
}

export const readLines = (root, path, maxBytes) => {
  const full = join(root, path)
  if (statSync(full).size > maxBytes) return null
  const text = readFileSync(full, 'utf8')
  if (text.includes('\u0000')) return null
  return text.split('\n')
}

// Reading order: what the config asks for first, then prose, then the record of
// decisions, then the code — the order a human builds a mental model in.
const RANK = { doc: 0, decision: 1, code: 2 }

// A root file is the way in; a dotted folder is instructions for tools, and a
// human reads it last if at all.
const depth = (path) => (!path.includes('/') ? 0 : path.startsWith('.') ? 2 : 1)

export const order = (files, reading) =>
  [...files].sort((a, b) => {
    const ra = reading.indexOf(a.path)
    const rb = reading.indexOf(b.path)
    if (ra !== rb) return (ra < 0 ? Infinity : ra) - (rb < 0 ? Infinity : rb)
    if (RANK[a.kind] !== RANK[b.kind]) return RANK[a.kind] - RANK[b.kind]
    if (depth(a.path) !== depth(b.path)) return depth(a.path) - depth(b.path)
    // Folder first, then filename: sorting whole paths would put `doc/x/a.md`
    // between two files of `doc/`, and the list would leave a folder and come
    // back to it.
    const dir = dirOf(a.path).localeCompare(dirOf(b.path))
    return dir !== 0 ? dir : a.path.localeCompare(b.path)
  })

export const classify = (paths, config) => {
  const files = []
  for (const path of paths) {
    if (config.exclude.some((p) => path.startsWith(p))) continue
    const kind = kindOf(path, config.decisions)
    if (kind) files.push({ path, kind })
  }
  return order(files, config.reading)
}
