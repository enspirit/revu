import assert from 'node:assert/strict'
import { test } from 'node:test'
import { render } from '../src/export.mjs'

const notes = [
  { id: 'a', path: 'src/late.ts', from: 10, to: 12, quote: 'const x = 1', tag: 'must-fix', body: 'Name it.' },
  { id: 'b', path: 'doc/arch.md', from: 4, to: 4, quote: '# Architecture', tag: 'question', body: 'Why two?' },
  { id: 'c', path: null, from: null, to: null, tag: 'scope', body: 'M1 is drifting.' },
]
const out = render('ofi.dev', notes, {
  order: ['doc/arch.md', 'src/late.ts'],
  date: new Date('2026-11-11T09:00:00Z'),
})

test('the review is one markdown text, dated and tallied', () => {
  assert.match(out, /^# Review of ofi\.dev\n/)
  assert.match(out, /2026-11-11 · 3 remarks · 1 must-fix, 1 question, 1 scope/)
})

test('a remark about the whole project is said first, under Overall', () => {
  assert.ok(out.indexOf('## Overall') < out.indexOf('## doc/arch.md'))
  assert.match(out, /\*\*scope\*\* — M1 is drifting\./)
})

test('files follow the reading order, not the order remarks were made', () => {
  assert.ok(out.indexOf('## doc/arch.md') < out.indexOf('## src/late.ts'))
})

test('every remark carries its own path, not only its lines', () => {
  assert.match(out, /### src\/late\.ts:10-12 — must-fix\n\n> const x = 1\n\nName it\./)
  assert.match(out, /### doc\/arch\.md:4 — question/)
})

test('a remark about a whole file addresses the file', () => {
  const one = render('p', [{ path: 'a.md', from: null, to: null, tag: 'note', body: 'b' }])
  assert.match(one, /### a\.md — note/)
})

test('an approximate anchor says so, so nobody trusts the line number', () => {
  const one = render('p', [{ path: 'a.md', from: 2, to: 2, quote: 'x', tag: 'note', body: 'b', exact: false }])
  assert.match(one, /### a\.md:2 — note \(approximate anchor\)/)
})

test('an empty review is still a valid text', () => {
  assert.match(render('p', []), /^# Review of p\n\n\d{4}-\d\d-\d\d · 0 remarks\n/)
})
