import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectDecisions, merge } from '../src/config.mjs'
import { classify, ext, kindOf, order } from '../src/scan.mjs'

test('a file is prose, a decision, code, or nothing revu should open', () => {
  assert.equal(kindOf('doc/3-architecture.md', 'doc/decisions'), 'doc')
  assert.equal(kindOf('doc/decisions/0042-m1.md', 'doc/decisions'), 'decision')
  assert.equal(kindOf('software/core/src/urls.ts', 'doc/decisions'), 'code')
  assert.equal(kindOf('software/core/urls.png', 'doc/decisions'), null)
  assert.equal(kindOf('pnpm-lock.yaml', null), null, 'a lockfile is not a source')
  assert.equal(kindOf('world/Dockerfile', null), 'code')
  assert.equal(ext('a/b.test.ts'), 'ts')
})

test('the decisions folder is found where projects actually keep it', () => {
  assert.equal(detectDecisions(['doc/decisions/0001-x.md']), 'doc/decisions')
  assert.equal(detectDecisions(['docs/adr/0001-x.md']), 'docs/adr')
  assert.equal(detectDecisions(['src/index.ts']), null)
})

test('excluded paths are never read', () => {
  const config = merge('/tmp/p', { exclude: ['software/website/'], decisions: null })
  const files = classify(['software/website/src/a.ts', 'software/core/src/b.ts'], config)
  assert.deepEqual(
    files.map((f) => f.path),
    ['software/core/src/b.ts'],
  )
})

test('reading order wins, then prose, then decisions, then code', () => {
  const files = [
    { path: 'src/a.ts', kind: 'code' },
    { path: '.agents/skills/x/SKILL.md', kind: 'doc' },
    { path: 'doc/b.md', kind: 'doc' },
    { path: 'doc/decisions/0001.md', kind: 'decision' },
    { path: 'README.md', kind: 'doc' },
    { path: 'CLAUDE.md', kind: 'doc' },
  ]
  assert.deepEqual(
    order(files, ['CLAUDE.md']).map((f) => f.path),
    [
      'CLAUDE.md',
      'README.md',
      'doc/b.md',
      '.agents/skills/x/SKILL.md',
      'doc/decisions/0001.md',
      'src/a.ts',
    ],
  )
})

test('a folder is listed whole before its subfolders', () => {
  const files = ['doc/sub/a.md', 'doc/z.md', 'doc/a.md'].map((path) => ({ path, kind: 'doc' }))
  assert.deepEqual(
    order(files, []).map((f) => f.path),
    ['doc/a.md', 'doc/z.md', 'doc/sub/a.md'],
  )
})
