// The read side, in one place: everything that touches the project under review
// happens here, and nothing here writes.
import { execFileSync } from 'node:child_process'
import { detectDecisions, load } from './config.mjs'
import { classify, listFiles, readLines } from './scan.mjs'

export const commitCounts = (root, since = '30 days ago') => {
  const counts = new Map()
  try {
    const log = execFileSync(
      'git',
      ['-C', root, 'log', `--since=${since}`, '--name-only', '--pretty=format:'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
    for (const path of log.split('\n'))
      if (path) counts.set(path, (counts.get(path) ?? 0) + 1)
  } catch {
    /* not a git repository, or an empty history: the signal simply has nothing to say */
  }
  return counts
}

const STATUS = { M: 'modified', A: 'added', '?': 'untracked', R: 'renamed', D: 'deleted', C: 'copied' }

// `XY path`, and `R  old -> new` for a rename. What the working tree holds that
// no commit does yet — the first question when an agent has been writing.
export const parseStatus = (text) =>
  text
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      label: STATUS[line[0] === ' ' ? line[1] : line[0]] ?? 'changed',
      path: line.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''),
    }))

export const workingChanges = (root) => {
  try {
    return parseStatus(
      execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }),
    )
  } catch {
    return []
  }
}

export const openProject = (root) => {
  const config = load(root)
  const paths = listFiles(root)
  config.decisions ??= detectDecisions(paths)

  const files = classify(paths, config)
  const corpus = new Map()
  for (const { path, kind } of files) {
    const lines = readLines(root, path, config.maxFileBytes)
    if (lines) corpus.set(path, { kind, lines })
  }

  // Only files we could actually read are offered: a binary or an oversized one
  // would open to nothing, and a dead entry in the tree is worse than no entry.
  const readable = files.filter((f) => corpus.has(f.path))
  const counts = { doc: 0, decision: 0, code: 0 }
  for (const f of readable) counts[f.kind] += 1

  return { root, config, files: readable, corpus, counts, paths }
}
