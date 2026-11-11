// A scope is a named list of places to look, and it is the only thing the left
// panel knows how to draw. The reading order is one, every signal is one, and
// so is whatever a linter prints — which is the point: new kinds of attention
// arrive as new scopes, not as new panels.
import { signals } from './signals.mjs'

const of = (corpus, kind) =>
  [...corpus].filter(([, f]) => f.kind === kind).map(([path]) => ({ path, label: '' }))

export const catalogue = (project, { commits = new Map(), changes = [] } = {}) => {
  const { corpus, config, files, paths } = project
  const reading = config.reading.filter((p) => corpus.has(p)).map((path) => ({ path, label: '' }))
  const working = changes.filter((c) => corpus.has(c.path))

  return [
    reading.length && { id: 'reading', title: 'Read in this order', hint: 'as revu.yml asks', items: reading },
    // What no commit holds yet: when an agent has been writing, this is the
    // first question, and it is not the same as thirty days of churn.
    working.length && {
      id: 'working',
      title: 'Changed, not committed',
      hint: 'the working tree against HEAD',
      items: working,
    },
    { id: 'decisions', title: 'Decisions', hint: 'the record, in order', items: of(corpus, 'decision') },
    { id: 'documents', title: 'Documents', hint: 'the prose', items: of(corpus, 'doc') },
    ...signals(corpus, { commits, paths }),
    // Last, and rarely what anyone wants: the search box reaches a file whose
    // name you know, and a scope reaches the ones you do not.
    { id: 'all', title: 'Every file', hint: 'everything revu can open', items: files.map((f) => ({ path: f.path, label: '' })) },
    ...config.scopes,
  ].filter(Boolean)
}

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
