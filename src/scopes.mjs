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
    items: (p, par, git) => git.changes(par.against).filter((c) => p.corpus.has(c.path)),
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
        items: built.items(project, declared.params, git),
      }
    })
    .filter(Boolean)

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
