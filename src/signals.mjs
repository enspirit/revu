// Cheap, generic, no language parsing: every signal below is a function of the
// corpus and nothing else. They do not say a thing is wrong — they say a human
// should look here first. Keep them that way; a signal that cries wolf stops
// being read, and then the whole pane stops being read.
import { ext } from './scan.mjs'

// `[TODO.md](./TODO.md)` is a link to a file, not work left undone — and in a
// repository that keeps a human-work list, that link is everywhere.
const TODO = /\b(TODO|FIXME|XXX|HACK|WIP)\b(?!\.md)/
const TEST_PATH = /(^|\/)(test|tests|spec|__tests__|e2e)\/|\.(test|spec)\./i
const TESTABLE = new Set(['ts', 'tsx', 'js', 'mjs', 'cjs', 'rb', 'py', 'go', 'rs', 'ex', 'java'])

const dirOf = (path) => path.slice(0, path.lastIndexOf('/') + 1)

const normalize = (path) => {
  const out = []
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

// A root-absolute target is a URL in every project that serves pages, so it is
// not ours to check: only a relative one names a file we could look for.
export const resolveLink = (from, target) => {
  const clean = target.split('#')[0].split('?')[0]
  if (!clean || clean.startsWith('/') || clean.startsWith('//')) return null
  if (/^[a-z]+:/i.test(clean)) return null
  return normalize(dirOf(from) + clean)
}

export const links = (lines) => {
  const found = []
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/\]\(\s*([^)\s]+)/g)) found.push({ target: m[1], line: i + 1 })
  })
  return found
}

const codeLines = (lines) => lines.filter((l) => l.trim() !== '').length

const docs = (corpus) => [...corpus].filter(([, f]) => f.kind !== 'code')

// A link that resolves to nothing is the cheapest proof that prose and tree
// have drifted — and in an AI-written repo, prose drifts first. Checked against
// every path in the project, not against what revu opens: a link to VERSION or
// to a lockfile is sound even though neither is worth reading here.
export const brokenLinks = (corpus, paths = [...corpus.keys()]) => {
  const exists = (p) => paths.some((k) => k === p || k.startsWith(p + '/'))
  const items = []
  for (const [path, file] of docs(corpus))
    for (const { target, line } of links(file.lines)) {
      const resolved = resolveLink(path, target)
      if (resolved && !exists(resolved)) items.push({ path, line, label: target })
    }
  return items
}

// Written, then forgotten: a document nothing points at is either the entry
// point or a thought the agent dropped. Root files are entry points by nature.
export const orphanDocs = (corpus) => {
  const pointed = new Set()
  for (const [path, file] of docs(corpus))
    for (const { target } of links(file.lines)) {
      const r = resolveLink(path, target)
      if (r) pointed.add(r)
    }
  return docs(corpus)
    .filter(([path]) => /\.mdx?$/.test(path) && path.includes('/') && !pointed.has(path))
    .map(([path]) => ({ path, label: 'linked from nowhere' }))
}

// A decision nobody cites is a decision nobody kept: either it is dead, or the
// code that depends on it never says so.
export const uncitedDecisions = (corpus) => {
  const decisions = [...corpus].filter(([, f]) => f.kind === 'decision')
  const others = [...corpus].filter(([, f]) => f.kind !== 'decision')
  return decisions
    .map(([path]) => {
      const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '')
      const number = base.match(/^\d+/)?.[0]
      const cited = others.some(([, f]) =>
        f.lines.some((l) => l.includes(base) || (number && l.includes(number))),
      )
      return cited ? null : { path, label: 'cited nowhere else' }
    })
    .filter(Boolean)
}

// Size is the one complexity measure that needs no parser and never lies about
// the cost of reading the file. Every row in the panel already shows its line
// count, so this signal is an ordering, not a label.
export const bigFiles = (corpus, { min = 250, top = 15, kind = 'code' } = {}) =>
  [...corpus]
    .filter(([, f]) => kind === 'any' || f.kind === kind || (kind === 'doc' && f.kind === 'decision'))
    .map(([path, f]) => ({ path, n: f.lines.length }))
    .filter(({ n }) => n >= min)
    .sort((a, b) => b.n - a.n)
    .slice(0, top)
    .map(({ path }) => ({ path, label: '' }))

export const todos = (corpus, { top = 50 } = {}) => {
  const items = []
  for (const [path, file] of corpus)
    file.lines.forEach((text, i) => {
      if (TODO.test(text)) items.push({ path, line: i + 1, label: text.trim().slice(0, 120) })
    })
  return items.slice(0, top)
}

// Heuristic, and named as one: a source file whose basename appears in no test
// path. It over-reports entry points and under-reports a test that covers by
// behaviour rather than by name.
export const untested = (corpus, { min = 80, top = 15 } = {}) => {
  const testPaths = [...corpus.keys()].filter((p) => TEST_PATH.test(p))
  return [...corpus]
    .filter(([p, f]) => f.kind === 'code' && TESTABLE.has(ext(p)) && !TEST_PATH.test(p))
    .map(([path, f]) => ({ path, n: codeLines(f.lines) }))
    .filter(({ path, n }) => {
      const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.\w+$/, '')
      return n >= min && !testPaths.some((t) => t.includes(base))
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, top)
    .map(({ path }) => ({ path, label: 'no test names it' }))
}

const WORD = /[A-Za-z0-9_-]+/g
const ENTRY = new Set(['index', 'main', 'mod', 'init', 'readme'])
// `.revu.yml` is referred to as "revu": a leading dot is part of the filename,
// never part of how anything names it.
const stem = (path) =>
  path
    .slice(path.lastIndexOf('/') + 1)
    .replace(/^\./, '')
    .replace(/\.\w+$/, '')
    .toLowerCase()

// A file nothing else names — dead weight, or a thing the agent wrote and then
// forgot it had. One pass over every word in the project records who said it
// first and whether anybody else did, which answers the question for every
// file at once. Conventional entry points are skipped: nothing imports an
// `index` by name, and that is not a finding.
export const unreferenced = (corpus, { min = 1, top = 20 } = {}) => {
  const said = new Map()
  for (const [path, file] of corpus)
    for (const line of file.lines)
      for (const [word] of line.matchAll(WORD)) {
        const token = word.toLowerCase()
        const heard = said.get(token)
        if (!heard) said.set(token, { first: path, elsewhere: false })
        else if (heard.first !== path) heard.elsewhere = true
      }

  const items = []
  for (const [path, file] of corpus) {
    const base = stem(path)
    // A test is found by a glob, not by name: nothing referring to it is the
    // normal case, not a finding.
    if (ENTRY.has(base) || TEST_PATH.test(path) || file.lines.length < min) continue
    const heard = said.get(base)
    if (!heard || (heard.first === path && !heard.elsewhere))
      items.push({ path, label: 'named nowhere else' })
  }
  return items.slice(0, top)
}

export const churn = (counts, { top = 15 } = {}) =>
  [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([path, n]) => ({ path, label: `${n} commits` }))

export const signals = (corpus, { commits = new Map(), paths } = {}) =>
  [
    { id: 'churn', title: 'Moving most', hint: 'commits in the last 30 days', items: churn(commits) },
    { id: 'big', title: 'Largest sources', hint: 'longest first', items: bigFiles(corpus) },
    { id: 'untested', title: 'No test names it', hint: 'heuristic, by basename', items: untested(corpus) },
    { id: 'broken', title: 'Broken links', hint: 'prose pointing at nothing', items: brokenLinks(corpus, paths) },
    { id: 'orphan', title: 'Unlinked documents', hint: 'reachable from nowhere', items: orphanDocs(corpus) },
    { id: 'uncited', title: 'Uncited decisions', hint: 'recorded, then dropped', items: uncitedDecisions(corpus) },
    { id: 'todo', title: 'Left for later', hint: 'TODO, FIXME, XXX, HACK, WIP', items: todos(corpus) },
  ].filter((g) => g.items.length > 0)
