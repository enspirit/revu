// How a row says what it is, in a column two hundred pixels wide. Everything
// here is a pure function of a path or a list, and tested — the panel has been
// made unreadable twice by getting exactly this wrong.

export const baseOf = (path) => path.slice(path.lastIndexOf('/') + 1)

export const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '')

// Folders truncate from the left, on a slash: `software/api/src/` tells you
// nothing that `…/api/src/` does not, and the head is the half every sibling
// shares. Cutting from the right leaves `software/…` on every row — which is
// how twenty documents became indistinguishable.
const KEPT = 2

export const tailOf = (dir) => {
  const parts = dir.split('/').filter(Boolean)
  return parts.length <= KEPT ? dir : `…/${parts.slice(-KEPT).join('/')}/`
}

// A label most rows repeat is a fact about the scope, not about any file in
// it: "modified" printed a hundred and sixty times, while the names it pushed
// out were the only thing that differed. Said once in the hint, the rows that
// do *not* carry it keep theirs — and those are the interesting ones.
export const commonLabel = (items) => {
  if (items.length < 2) return { label: '', all: false }
  const counts = new Map()
  for (const item of items) {
    const label = item.label ?? ''
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const [label, n] = [...counts].sort((a, b) => b[1] - a[1])[0]
  return label && n > items.length / 2 ? { label, all: n === items.length } : { label: '', all: false }
}
