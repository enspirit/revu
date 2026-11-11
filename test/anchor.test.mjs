import assert from 'node:assert/strict'
import { test } from 'node:test'
import { locate } from '../src/anchor.mjs'

const lines = [
  '# The rules',
  '',
  '1. **Modules are separated by a published contract.** A module',
  '   states its public interface; nothing crosses a boundary.',
  '',
  '2. Everything that can be a pure function is one.',
]

test('a quote inside one line anchors to that line, exactly', () => {
  assert.deepEqual(locate(lines, 'Everything that can be a pure function is one.'), {
    from: 6,
    to: 6,
    exact: true,
  })
})

test('a quote spanning wrapped prose anchors to the whole range', () => {
  const quote = 'Modules are separated by a published contract. A module states its public'
  assert.deepEqual(locate(lines, quote), { from: 3, to: 4, exact: true })
})

test('markdown syntax dropped by rendering does not prevent the match', () => {
  assert.equal(locate(lines, 'The rules').from, 1)
})

test('a long quote whose tail drifted still anchors, and says it is approximate', () => {
  const at = locate(lines, 'Everything that can be a pure function is one, with unit tests, always.')
  assert.equal(at.from, 6)
  assert.equal(at.exact, false)
})

test('text that is not there anchors nowhere', () => {
  assert.equal(locate(lines, 'a sentence from another repository'), null)
  assert.equal(locate(lines, '   '), null)
})
