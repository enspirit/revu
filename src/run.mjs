// Any tool that prints a place in a file can propose a scope. The format is
// the one every static analyser already speaks: `path:line: message`, or tsc's
// `path(line,col): message`, or a bare path. Nothing is parsed per tool.
import { execFile } from 'node:child_process'

const UNIX = /^([^\s:]+):(\d+)(?::\d+)?:?\s*(.*)$/
const MSVC = /^([^\s(]+)\((\d+)(?:,\d+)?\):\s*(.*)$/
const BARE = /^([^\s:]+)$/

const tidy = (path) => path.replace(/^\.\//, '')

export const parseLocations = (text, known) => {
  const seen = new Set()
  const items = []
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-*]\s+/, '')
    if (!line) continue
    const m = MSVC.exec(line) ?? UNIX.exec(line) ?? BARE.exec(line)
    if (!m) continue
    const path = tidy(m[1])
    // A path the project does not have is a tool talking about something else
    // — a summary line, a node_modules frame, its own name.
    if (!known.has(path)) continue
    const at = m[2] ? Number(m[2]) : null
    const key = `${path}:${at}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ path, line: at, label: (m[3] ?? '').trim().slice(0, 140) })
  }
  return items
}

// The command is the user's own, declared in their revu.yml and shown on the
// row they clicked. A non-zero exit is normal here: a linter that found
// something says so that way.
export const runCommand = (root, command, timeout = 30_000) =>
  new Promise((resolve) => {
    execFile(
      process.env.SHELL?.includes('fish') ? 'sh' : (process.env.SHELL ?? 'sh'),
      ['-c', command],
      { cwd: root, timeout, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) =>
        resolve({ out: `${stdout}\n${stderr}`, failed: Boolean(err && !stdout && !stderr), error: err?.message ?? null }),
    )
  })
