// The whole point of the tool: one markdown text, addressed to whoever writes
// the next change — human or agent. Pure function of the notes.
const PREAMBLE =
  'A human read this repository and wrote the remarks below. Each one quotes the ' +
  'lines it is about; the address is `path:from-to`. Treat a remark as the ' +
  'requirement, not as a suggestion to paraphrase back.'

const quote = (text) =>
  text
    .split('\n')
    .map((l) => `> ${l}`.trimEnd())
    .join('\n')

// Every remark names its own file. The section heading above it says the same
// thing, and that repetition is the point: a remark is read, quoted and acted
// on one at a time, and `L56-57` alone would be an address to nowhere.
const address = (note) =>
  note.from == null
    ? note.path
    : note.from === note.to
      ? `${note.path}:${note.from}`
      : `${note.path}:${note.from}-${note.to}`

const tally = (notes) => {
  const counts = new Map()
  for (const n of notes) counts.set(n.tag, (counts.get(n.tag) ?? 0) + 1)
  return [...counts].map(([tag, n]) => `${n} ${tag}`).join(', ')
}

export const render = (title, notes, { order = [], date = new Date() } = {}) => {
  const rank = (p) => (order.indexOf(p) < 0 ? order.length : order.indexOf(p))
  const overall = notes.filter((n) => !n.path)
  const placed = notes
    .filter((n) => n.path)
    .sort((a, b) => rank(a.path) - rank(b.path) || (a.from ?? 0) - (b.from ?? 0))

  const out = [
    `# Review of ${title}`,
    '',
    `${date.toISOString().slice(0, 10)} · ${notes.length} remark${notes.length === 1 ? '' : 's'}` +
      (notes.length ? ` · ${tally(notes)}` : ''),
    '',
    PREAMBLE,
  ]

  if (overall.length) {
    out.push('', '## Overall')
    for (const n of overall) out.push('', `**${n.tag}** — ${n.body.trim()}`)
  }

  let current = null
  for (const n of placed) {
    if (n.path !== current) {
      out.push('', `## ${n.path}`)
      current = n.path
    }
    out.push('', `### ${address(n)} — ${n.tag}${n.exact === false ? ' (approximate anchor)' : ''}`)
    if (n.quote?.trim()) out.push('', quote(n.quote))
    out.push('', n.body.trim())
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}
