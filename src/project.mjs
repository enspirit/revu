// The read side, in one place: everything that touches the project under review
// happens here, and nothing here writes.
import { execFileSync } from 'node:child_process'
import { detectDecisions, load } from './config.mjs'
import { classify, listFiles, readLines } from './scan.mjs'

// stderr is swallowed: "your current branch has no commits yet" is an answer
// here, not a message for the person reading a review.
const git = (root, args) =>
  execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })

export const commitCounts = (root, days = 30) => {
  const counts = new Map()
  try {
    const log = git(root, ['log', `--since=${days} days ago`, '--name-only', '--pretty=format:'])
    for (const path of log.split('\n')) if (path) counts.set(path, (counts.get(path) ?? 0) + 1)
  } catch {
    /* not a git repository, or an empty history: the scope simply has nothing to say */
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

// Without a ref: what the working tree holds that no commit does. With one:
// everything this branch has that the ref does not.
export const changedFiles = (root, against) => {
  try {
    if (!against) return parseStatus(git(root, ['status', '--porcelain']))
    return git(root, ['diff', '--name-only', `${against}...HEAD`])
      .split('\n')
      .filter(Boolean)
      .map((path) => ({ path, label: `not in ${against}` }))
  } catch {
    return []
  }
}

// What one commit touched. `HEAD` is the usual question — "what did the agent
// just do?" — but any ref answers.
export const commitFiles = (root, ref = 'HEAD') => {
  try {
    return git(root, ['show', '--name-only', '--pretty=format:', ref])
      .split('\n')
      .filter(Boolean)
      .map((path) => ({ path, label: '' }))
  } catch {
    return []
  }
}

// The git questions a scope may ask, answered once each. Injected rather than
// imported so the catalogue stays a function of its inputs.
export const gitFacts = (root) => {
  const once = (cache, key, answer) => (cache.has(key) ? cache : cache.set(key, answer())).get(key)
  const log = new Map()
  const diff = new Map()
  const show = new Map()
  return {
    commits: (days) => once(log, days, () => commitCounts(root, days)),
    changes: (against = '') => once(diff, against, () => changedFiles(root, against || undefined)),
    commit: (ref = 'HEAD') => once(show, ref, () => commitFiles(root, ref)),
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
