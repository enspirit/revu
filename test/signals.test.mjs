import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bigFiles,
  brokenLinks,
  links,
  orphanDocs,
  resolveLink,
  signals,
  todos,
  uncitedDecisions,
  unreferenced,
  untested,
} from '../src/signals.mjs'

const corpus = (entries) =>
  new Map(Object.entries(entries).map(([path, [kind, text]]) => [path, { kind, lines: text.split('\n') }]))

const sample = corpus({
  'README.md': ['doc', 'See [the architecture](doc/arch.md) and [a ghost](doc/ghost.md).'],
  'doc/arch.md': ['doc', '# Architecture\n\nDecision [0001](decisions/0001-one.md) applies.'],
  'doc/lost.md': ['doc', '# Nobody points here'],
  'doc/decisions/0001-one.md': ['decision', '# One'],
  'doc/decisions/0002-two.md': ['decision', '# Two'],
  'src/big.ts': ['code', Array.from({ length: 300 }, (_, i) => `const x${i} = ${i}`).join('\n')],
  'src/small.ts': ['code', 'export const one = 1 // TODO: name it'],
  'test/big.test.ts': ['code', 'import "../src/big.ts"'],
})

test('a relative link resolves against the document that holds it', () => {
  assert.equal(resolveLink('doc/arch.md', './decisions/0001.md#why'), 'doc/decisions/0001.md')
  assert.equal(resolveLink('doc/arch.md', '../README.md'), 'README.md')
  assert.equal(resolveLink('doc/arch.md', 'https://example.com'), null)
  assert.equal(resolveLink('doc/arch.md', '#a-section'), null)
  assert.equal(resolveLink('doc/arch.md', '/pricing/'), null, 'a served URL, not a file')
})

test('a link to a file revu does not open is still a sound link', () => {
  const docs = corpus({ 'doc/x.md': ['doc', 'the [number](../VERSION) is stated here'] })
  assert.deepEqual(brokenLinks(docs, ['doc/x.md', 'VERSION']), [])
  assert.equal(brokenLinks(docs, ['doc/x.md']).length, 1)
})

test('links are found with the line that holds them', () => {
  assert.deepEqual(links(['a', 'see [x](y.md)']), [{ target: 'y.md', line: 2 }])
})

test('a link pointing at nothing is reported once, with its line', () => {
  assert.deepEqual(brokenLinks(sample), [{ path: 'README.md', line: 1, label: 'doc/ghost.md' }])
})

test('a nested document nothing links to is an orphan; a root document is not', () => {
  assert.deepEqual(
    orphanDocs(sample).map((i) => i.path),
    ['doc/lost.md', 'doc/decisions/0002-two.md'],
  )
})

test('a decision cited nowhere outside the decisions folder is reported', () => {
  assert.deepEqual(
    uncitedDecisions(sample).map((i) => i.path),
    ['doc/decisions/0002-two.md'],
  )
})

test('the largest sources are an ordering, over a floor — the row shows the size', () => {
  assert.deepEqual(bigFiles(sample, { min: 100 }), [{ path: 'src/big.ts', label: '' }])
  assert.deepEqual(bigFiles(sample, { min: 1000 }), [])
})

test('what was left for later is quoted with its address', () => {
  assert.deepEqual(todos(sample), [
    { path: 'src/small.ts', line: 1, label: 'export const one = 1 // TODO: name it' },
  ])
})

test('a source file no test path names is reported; one that is named is not', () => {
  assert.deepEqual(
    untested(sample, { min: 10 }).map((i) => i.path),
    [],
  )
  const alone = corpus({ 'src/alone.ts': ['code', 'const a = 1\nconst b = 2'] })
  assert.deepEqual(
    untested(alone, { min: 1 }).map((i) => i.path),
    ['src/alone.ts'],
  )
})

test('a group with nothing to say does not appear at all', () => {
  const ids = signals(corpus({ 'README.md': ['doc', '# Quiet'] })).map((g) => g.id)
  assert.deepEqual(ids, [])
})

test('a file nothing else names is found; one that is named, or a test, is not', () => {
  const corpus = (entries) =>
    new Map(Object.entries(entries).map(([path, text]) => [path, { kind: 'code', lines: text.split('\n') }]))

  const files = corpus({
    'src/index.ts': "import { used } from './used'",
    'src/used.ts': 'export const used = 1',
    'src/leftover.ts': 'export const forgotten = 2',
    'test/leftover.test.ts': 'nothing names this either',
    '.revu.yml': 'title: revu',
    'src/revu.ts': 'export const revu = 3',
  })

  assert.deepEqual(
    unreferenced(files).map((i) => i.path),
    ['src/leftover.ts'],
    'an entry point, a test and a file others mention are all expected to be unnamed or named',
  )
})
