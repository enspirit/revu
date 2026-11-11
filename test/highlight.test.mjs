import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlight, languageFor, splitLines } from '../src/highlight.mjs'

test('a language is found by extension, by filename, or not at all', () => {
  assert.equal(languageFor('src/a.ts'), 'ts')
  assert.equal(languageFor('src/a.mjs'), 'javascript')
  assert.equal(languageFor('app/Button.vue'), 'xml')
  assert.equal(languageFor('ops/Dockerfile'), 'dockerfile')
  assert.equal(languageFor('notes.unheardof'), null)
})

test('a span opened on one line is closed and reopened on the next', () => {
  assert.deepEqual(splitLines('<span class="c">one\ntwo</span>\nthree'), [
    '<span class="c">one</span>',
    '<span class="c">two</span>',
    'three',
  ])
})

test('a file comes back as one row per line, coloured', () => {
  const lines = ['/* what this does', '   over two lines */', 'const x = "hi"']
  const rows = highlight('a.ts', lines)
  assert.equal(rows.length, lines.length, 'the gutter and the colours must agree')
  assert.ok(rows[0].includes('hljs-comment') && rows[1].includes('hljs-comment'))
  assert.ok(rows[2].includes('hljs-string'))
})

test('an unknown language is plain text, not a guess', () => {
  assert.equal(highlight('notes.unheardof', ['anything']), null)
})

test('the line count is preserved even when the source ends in a newline', () => {
  const lines = 'const a = 1\n\nconst b = 2\n'.split('\n')
  assert.equal(highlight('a.js', lines).length, lines.length)
})
