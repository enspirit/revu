// A remark made on rendered markdown has to come back to source lines, because
// the line is what an agent can be pointed at. Rendering drops syntax, so the
// match is done on text stripped of it, and a partial match still anchors —
// approximately, and it says so.
const norm = (s) =>
  s
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const locate = (lines, quote) => {
  const q = norm(quote)
  if (!q) return null

  const spans = []
  let joined = ''
  lines.forEach((line, i) => {
    const text = norm(line)
    if (!text) return
    if (joined) joined += ' '
    spans.push({ start: joined.length, line: i + 1 })
    joined += text
  })

  const probe = [q, q.slice(0, 80), q.slice(0, 40), q.slice(0, 16)].find(
    (p) => p.length > 3 && joined.includes(p),
  )
  if (!probe) return null

  const start = joined.indexOf(probe)
  const end = start + (probe === q ? q.length : probe.length)
  const lineAt = (offset) => {
    let found = spans[0]?.line ?? 1
    for (const s of spans) if (s.start <= offset) found = s.line
    return found
  }
  return { from: lineAt(start), to: lineAt(Math.max(start, end - 1)), exact: probe === q }
}
