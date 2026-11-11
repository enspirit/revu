import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DEFAULT_SCOPES } from '../src/config.mjs'

const SKILL = new URL('../skills/revu-setup/SKILL.md', import.meta.url)
const text = readFileSync(SKILL, 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('the skill is a skill: frontmatter an agent runtime can read', () => {
  const [, front] = text.split('---\n', 3)
  assert.match(front, /^name: revu-setup$/m)
  assert.match(front, /^description: .{80,}$/m, 'the description is what decides whether it is loaded')
})

test('it tells the agent the three things revu can parse', () => {
  for (const shape of ['path/to/file.ts:42:7: message', 'path/to/file.ts(42,7): message'])
    assert.ok(text.includes(shape), `${shape} is a format a tool out there prints`)
})

test('it names every built-in scope, so an agent is not inventing them', () => {
  for (const { use } of DEFAULT_SCOPES)
    assert.ok(new RegExp(`\`${use}\``).test(text), `the skill never mentions the ${use} scope`)
})

test('it ships with the package, or `revu --skill` would be a promise we break', () => {
  assert.ok(manifest.files.includes('skills'))
})
