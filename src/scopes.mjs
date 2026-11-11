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
  unreferenced,
  untested,
} from './signals.mjs'

const paths = (items) => items.map((path) => ({ path, label: '' }))
const of = (corpus, kind) => paths([...corpus].filter(([, f]) => f.kind === kind).map(([path]) => path))

// What a row of this scope is *about*. A row shows the filename, the folder it
// is in, and at most one number on the right — never four things competing for
// two hundred pixels. Which number depends on the question the scope asks:
// "which files are long?" wants the length; "what did the agent touch?" wants
// the status; a linter wants its message, and that does not fit on the line at
// all, so it goes underneath.
const LENGTH = { metric: 'size' } // the number of lines, on the right
const STATE = { metric: 'label' } // what this scope measured, on the right
const MESSAGE = { metric: 'none', detail: 'label' } // what a tool said, underneath

// Each built-in says what it is called, what it is for — in terms of the
// numbers it was given — and how to find its items.
const BUILT_IN = {
  reading: { row: LENGTH,
    title: 'Read in this order',
    hint: 'as .revu.yml asks',
    items: (p) => paths(p.config.reading.filter((path) => p.corpus.has(path))),
  },
  changed: { row: STATE,
    title: (par) => (par.against ? 'On this branch' : 'Changed, not committed'),
    hint: (par) => (par.against ? `everything this branch has that ${par.against} does not` : 'the working tree against HEAD'),
    items: (p, par, git) => git.changes(par.against),
  },
  decisions: { row: LENGTH, title: 'Decisions', hint: 'the record, in order', items: (p) => of(p.corpus, 'decision') },
  documents: { row: LENGTH, title: 'Documents', hint: 'the prose', items: (p) => of(p.corpus, 'doc') },
  commit: { row: LENGTH,
    title: (par) => (par.ref && par.ref !== 'HEAD' ? `In ${par.ref}` : 'The last commit'),
    hint: 'what that one commit touched',
    items: (p, par, git) => git.commit(par.ref ?? 'HEAD'),
  },
  churn: { row: STATE,
    title: 'Moving most',
    hint: (par) => `commits in the last ${par.days ?? 30} days`,
    items: (p, par, git) => churn(git.commits(par.days ?? 30), par),
  },
  largest: { row: LENGTH,
    // The same measure answers two questions: which sources have grown too
    // long, and which documents an agent padded out.
    title: (par) => (par.kind === 'doc' ? 'Longest documents' : 'Largest sources'),
    hint: (par) =>
      `${par.min ?? 250} lines or more, longest first` + (par.kind === 'doc' ? ', prose only' : ''),
    items: (p, par) => bigFiles(p.corpus, par),
  },
  unreferenced: { row: LENGTH,
    title: 'Named nowhere else',
    hint: 'no other file so much as mentions them',
    items: (p, par) => unreferenced(p.corpus, par),
  },
  untested: { row: LENGTH,
    title: 'No test names it',
    hint: (par) => `${par.min ?? 80} lines or more, heuristic, by basename`,
    items: (p, par) => untested(p.corpus, par),
  },
  links: { row: MESSAGE, title: 'Broken links', hint: 'prose pointing at nothing', items: (p) => brokenLinks(p.corpus, p.paths) },
  orphans: { row: LENGTH, title: 'Unlinked documents', hint: 'reachable from nowhere', items: (p) => orphanDocs(p.corpus) },
  uncited: { row: LENGTH, title: 'Uncited decisions', hint: 'recorded, then dropped', items: (p) => uncitedDecisions(p.corpus) },
  todo: { row: MESSAGE, title: 'Left for later', hint: 'TODO, FIXME, XXX, HACK, WIP', items: (p, par) => todos(p.corpus, par) },
  all: { row: LENGTH, title: 'Every file', hint: 'everything revu can open', items: (p) => paths(p.files.map((f) => f.path)) },
}

const say = (value, params) => (typeof value === 'function' ? value(params) : value)

const NO_GIT = { commits: () => new Map(), changes: () => [], commit: () => [] }

export const catalogue = (project, git = NO_GIT) =>
  project.config.scopes
    .map((declared) => {
      if (declared.command)
        return {
          id: declared.id,
          title: declared.title ?? declared.command,
          hint: declared.hint ?? declared.command,
          command: declared.command,
          row: MESSAGE, // a tool speaks in sentences, and they go underneath
        }
      const built = BUILT_IN[declared.use]
      if (!built) return null // a name we do not have is a typo, not a crash
      return {
        id: declared.id,
        title: declared.title ?? say(built.title, declared.params),
        hint: declared.hint ?? say(built.hint, declared.params),
        row: built.row,
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
  row: LENGTH,
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
