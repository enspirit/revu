// A scope is a named list of places to look, and it is the only thing the left
// panel knows how to draw. The reading order is one, every signal is one, and
// so is whatever a linter prints — which is the point: new kinds of attention
// arrive as new scopes, not as new panels.
//
// Which ones a project offers, and on what thresholds, is its own business:
// everything here is chosen and tuned in .revu.yml.
import {
  bigFiles,
  brokenLinks,
  churn,
  orphanDocs,
  todos,
  uncitedDecisions,
  untested,
} from './signals.mjs'

const paths = (items) => items.map((path) => ({ path, label: '' }))
const of = (corpus, kind) => paths([...corpus].filter(([, f]) => f.kind === kind).map(([path]) => path))

// Each built-in says what it is called, what it is for — in terms of the
// numbers it was given — and how to find its items.
const BUILT_IN = {
  reading: {
    title: 'Read in this order',
    hint: 'as .revu.yml asks',
    items: (p) => paths(p.config.reading.filter((path) => p.corpus.has(path))),
  },
  changed: {
    title: (par) => (par.against ? `Changed against ${par.against}` : 'Changed, not committed'),
    hint: (par) => (par.against ? 'this branch, as a whole' : 'the working tree against HEAD'),
    items: (p, par, git) => git.changes(par.against),
  },
  decisions: { title: 'Decisions', hint: 'the record, in order', items: (p) => of(p.corpus, 'decision') },
  documents: { title: 'Documents', hint: 'the prose', items: (p) => of(p.corpus, 'doc') },
  churn: {
    title: 'Moving most',
    hint: (par) => `commits in the last ${par.days ?? 30} days`,
    items: (p, par, git) => churn(git.commits(par.days ?? 30), par),
  },
  largest: {
    title: 'Largest sources',
    hint: (par) => `${par.min ?? 250} lines or more, longest first`,
    items: (p, par) => bigFiles(p.corpus, par),
  },
  untested: {
    title: 'No test names it',
    hint: (par) => `${par.min ?? 80} lines or more, heuristic, by basename`,
    items: (p, par) => untested(p.corpus, par),
  },
  links: { title: 'Broken links', hint: 'prose pointing at nothing', items: (p) => brokenLinks(p.corpus, p.paths) },
  orphans: { title: 'Unlinked documents', hint: 'reachable from nowhere', items: (p) => orphanDocs(p.corpus) },
  uncited: { title: 'Uncited decisions', hint: 'recorded, then dropped', items: (p) => uncitedDecisions(p.corpus) },
  todo: { title: 'Left for later', hint: 'TODO, FIXME, XXX, HACK, WIP', items: (p, par) => todos(p.corpus, par) },
  all: { title: 'Every file', hint: 'everything revu can open', items: (p) => paths(p.files.map((f) => f.path)) },
}

const say = (value, params) => (typeof value === 'function' ? value(params) : value)

export const catalogue = (project, git = { commits: () => new Map(), changes: () => [] }) =>
  project.config.scopes
    .map((declared) => {
      if (declared.command)
        return {
          id: declared.id,
          title: declared.title ?? declared.command,
          hint: declared.hint ?? declared.command,
          command: declared.command,
        }
      const built = BUILT_IN[declared.use]
      if (!built) return null // a name we do not have is a typo, not a crash
      return {
        id: declared.id,
        title: declared.title ?? say(built.title, declared.params),
        hint: declared.hint ?? say(built.hint, declared.params),
        // git knows about files revu will not open — a lockfile, a binary, a
        // path just deleted. A row that opens nothing is worse than no row.
        items: built.items(project, declared.params, git).filter((i) => project.corpus.has(i.path)),
      }
    })
    .filter(Boolean)

// Reached by clicking a folder in the path above a file, never listed: there
// are as many of these as there are folders, and they are a way of moving
// rather than a place to look. Everything underneath, not just the children —
// one list, no tree.
export const FOLDER = 'folder:'

export const folderScope = (files, prefix) => ({
  id: FOLDER + prefix,
  title: `In ${prefix}/`,
  hint: 'everything under this folder',
  within: prefix, // the rows drop it from their folder column: it is the title
  items: files.filter((f) => f.path.startsWith(prefix + '/')).map((f) => ({ path: f.path, label: '' })),
})

// Rows carry the file's length wherever they appear, so "how much is there to
// read" never needs a second question.
export const sized = (items, corpus) =>
  items.map((item) => ({ ...item, size: corpus.get(item.path)?.lines.length ?? null }))

export const headers = (scopes) =>
  scopes.map(({ id, title, hint, command, items }) => ({
    id,
    title,
    hint,
    command: command ?? null,
    count: items?.length ?? null,
  }))
