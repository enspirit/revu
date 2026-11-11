import assert from 'node:assert/strict'
import { test } from 'node:test'
import { merge } from '../src/config.mjs'
import { parseStatus } from '../src/project.mjs'
import { parseLocations } from '../src/run.mjs'
import { catalogue, headers, sized } from '../src/scopes.mjs'

const project = (files, config = {}) => {
  const corpus = new Map(files.map(([path, kind, n]) => [path, { kind, lines: Array(n).fill('x') }]))
  return {
    corpus,
    paths: files.map(([path]) => path),
    files: files.map(([path, kind]) => ({ path, kind })),
    config: merge('/tmp/p', config),
  }
}

const sample = project([
  ['README.md', 'doc', 10],
  ['doc/a.md', 'doc', 20],
  ['doc/decisions/0001-x.md', 'decision', 30],
  ['src/a.ts', 'code', 400],
])

test('the reading order is a scope, and only when one is configured', () => {
  const ids = catalogue(sample).map((s) => s.id)
  assert.ok(!ids.includes('reading'), 'no revu.yml reading order, no scope')

  const asked = project(
    [
      ['README.md', 'doc', 10],
      ['doc/a.md', 'doc', 20],
    ],
    { reading: ['README.md', 'nowhere.md'] },
  )
  const reading = catalogue(asked).find((s) => s.id === 'reading')
  assert.deepEqual(reading.items, [{ path: 'README.md', label: '' }], 'a path that is gone is dropped')
})

test('the working tree is a scope when it holds anything', () => {
  const changes = [{ path: 'src/a.ts', label: 'modified' }, { path: 'gone.ts', label: 'deleted' }]
  const working = catalogue(sample, { changes }).find((s) => s.id === 'working')
  assert.deepEqual(working.items, [{ path: 'src/a.ts', label: 'modified' }])
  assert.equal(catalogue(sample, { changes: [] }).find((s) => s.id === 'working'), undefined)
})

test('a declared command is a scope with no count until it is entered', () => {
  const declared = project([['src/a.ts', 'code', 4]], {
    scopes: [{ title: 'Lint', run: 'npx oxlint --format=unix' }],
  })
  const head = headers(catalogue(declared)).at(-1)
  assert.deepEqual(head, {
    id: 'run:0',
    title: 'Lint',
    hint: 'npx oxlint --format=unix',
    command: 'npx oxlint --format=unix',
    count: null,
  })
})

test('every row carries the length of its file', () => {
  assert.deepEqual(sized([{ path: 'src/a.ts' }, { path: 'nowhere.ts' }], sample.corpus), [
    { path: 'src/a.ts', size: 400 },
    { path: 'nowhere.ts', size: null },
  ])
})

test('a tool is read through the format they all share', () => {
  const known = new Set(['src/a.ts', 'doc/a.md', 'src/b.ts'])
  const out = [
    'src/a.ts:12:4: no-unused-vars: `x` is never read', // oxlint, eslint, grep
    'src/b.ts(31,9): error TS2345: not assignable', // tsc
    './doc/a.md:7', // a bare location
    'src/a.ts', // a whole file
    'node_modules/foo/index.js:1: not ours',
    'Found 2 problems.',
  ].join('\n')

  assert.deepEqual(parseLocations(out, known), [
    { path: 'src/a.ts', line: 12, label: 'no-unused-vars: `x` is never read' },
    { path: 'src/b.ts', line: 31, label: 'error TS2345: not assignable' },
    { path: 'doc/a.md', line: 7, label: '' },
    { path: 'src/a.ts', line: null, label: '' },
  ])
})

test('the same place twice is one row', () => {
  const known = new Set(['a.ts'])
  assert.equal(parseLocations('a.ts:1: one\na.ts:1: again', known).length, 1)
})

test('git status is read for what changed and how', () => {
  assert.deepEqual(parseStatus(' M src/a.ts\n?? new.ts\nR  old.ts -> src/b.ts\nA  src/c.ts'), [
    { path: 'src/a.ts', label: 'modified' },
    { path: 'new.ts', label: 'untracked' },
    { path: 'src/b.ts', label: 'renamed' },
    { path: 'src/c.ts', label: 'added' },
  ])
})
