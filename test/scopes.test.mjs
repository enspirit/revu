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

const FILES = [
  ['README.md', 'doc', 10],
  ['doc/a.md', 'doc', 20],
  ['doc/decisions/0001-x.md', 'decision', 30],
  ['src/small.ts', 'code', 90],
  ['src/big.ts', 'code', 400],
]

const git = { commits: () => new Map([['src/big.ts', 7]]), changes: () => [{ path: 'src/big.ts', label: 'modified' }] }

test('a built-in is offered only when the config asks for it', () => {
  const asked = project(FILES, { scopes: [{ use: 'decisions' }] })
  assert.deepEqual(
    catalogue(asked, git).map((s) => s.title),
    ['Decisions'],
  )
})

test('its parameters reach it, and the hint says what they were', () => {
  const asked = project(FILES, { scopes: [{ use: 'largest', min: 500 }, { use: 'largest', min: 100 }] })
  const [strict, loose] = catalogue(asked, git)
  assert.deepEqual(strict.items, [], 'nothing is 500 lines here')
  assert.deepEqual(
    loose.items.map((i) => i.path),
    ['src/big.ts'],
  )
  assert.equal(loose.hint, '100 lines or more, longest first')
  assert.notEqual(strict.id, loose.id, 'the same built-in twice is two scopes')
})

test('a title and a hint of your own win over ours', () => {
  const asked = project(FILES, { scopes: [{ use: 'churn', days: 7, title: 'This week', hint: 'since Monday' }] })
  const [scope] = catalogue(asked, git)
  assert.equal(scope.title, 'This week')
  assert.equal(scope.hint, 'since Monday')
})

test('the reading order drops a path the project no longer has', () => {
  const asked = project(FILES, { reading: ['README.md', 'gone.md'], scopes: [{ use: 'reading' }] })
  assert.deepEqual(catalogue(asked, git)[0].items, [{ path: 'README.md', label: '' }])
})

test('a name we do not have is a typo in a file, not a crash', () => {
  const asked = project(FILES, { scopes: [{ use: 'nonsense' }, { use: 'documents' }] })
  assert.deepEqual(
    catalogue(asked, git).map((s) => s.title),
    ['Documents'],
  )
})

test('a declared command is a scope with no count until it is entered', () => {
  const asked = project(FILES, { scopes: [{ title: 'Lint', run: 'npx oxlint --format=unix' }] })
  assert.deepEqual(headers(catalogue(asked, git)), [
    {
      id: 'run:0',
      title: 'Lint',
      hint: 'npx oxlint --format=unix',
      command: 'npx oxlint --format=unix',
      count: null,
    },
  ])
})

test('every row carries the length of its file', () => {
  const { corpus } = project(FILES)
  assert.deepEqual(sized([{ path: 'src/big.ts' }, { path: 'nowhere.ts' }], corpus), [
    { path: 'src/big.ts', size: 400 },
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
  assert.equal(parseLocations('a.ts:1: one\na.ts:1: again', new Set(['a.ts'])).length, 1)
})

test('git status is read for what changed and how', () => {
  assert.deepEqual(parseStatus(' M src/a.ts\n?? new.ts\nR  old.ts -> src/b.ts\nA  src/c.ts'), [
    { path: 'src/a.ts', label: 'modified' },
    { path: 'new.ts', label: 'untracked' },
    { path: 'src/b.ts', label: 'renamed' },
    { path: 'src/c.ts', label: 'added' },
  ])
})
