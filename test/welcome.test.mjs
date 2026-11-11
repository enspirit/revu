import assert from 'node:assert/strict'
import { test } from 'node:test'
import { welcome } from '../src/welcome.mjs'

const text = welcome('1.0.0', '/home/you/.local/state/revu')

test('the first run says the two things a newcomer cannot guess', () => {
  assert.match(text, /revu 1\.0\.0/)
  assert.match(text, /\/home\/you\/\.local\/state\/revu/, 'where the remarks go')
  assert.match(text, /revu init \./, 'what to do next')
  assert.match(text, /revu\.enspirit\.dev/)
})

test('it is plain text unless a terminal is listening', () => {
  assert.ok(!text.includes('\u001b'), 'no escape codes when piped to a file')
  assert.ok(welcome('1.0.0', '/x', true).includes('\u001b'), 'bold when a terminal is there')
})
