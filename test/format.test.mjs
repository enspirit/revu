import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseOf, commonLabel, dirOf, tailOf } from '../web/format.js'

test('a row names the file, and says where from its tail', () => {
  assert.equal(baseOf('software/api/src/html.ts'), 'html.ts')
  assert.equal(dirOf('software/api/src/html.ts'), 'software/api/src/')
  assert.equal(dirOf('README.md'), '')
})

test('a folder is cut from the left, on a slash', () => {
  assert.equal(tailOf('software/api/src/'), '…/api/src/')
  assert.equal(tailOf('doc/decisions/'), 'doc/decisions/', 'short enough to keep whole')
  assert.equal(tailOf('doc/'), 'doc/')
  assert.equal(tailOf(''), '', 'a file at the root is nowhere in particular')
})

test('the tail is what tells two files of the same name apart', () => {
  const a = tailOf(dirOf('software/website/src/content/pages/security.en.md'))
  const b = tailOf(dirOf('software/studio/src/content/security.en.md'))
  assert.notEqual(a, b)
  assert.equal(a, '…/content/pages/')
})

test('a label most rows repeat belongs to the scope, not to the rows', () => {
  const all = [{ label: 'modified' }, { label: 'modified' }]
  assert.deepEqual(commonLabel(all), { label: 'modified', all: true })
})

test('the rows unlike the others keep their label, and the hint says mostly', () => {
  const mixed = [{ label: 'modified' }, { label: 'modified' }, { label: 'untracked' }]
  assert.deepEqual(commonLabel(mixed), { label: 'modified', all: false })
})

test('labels that are all different are each worth reading', () => {
  const churn = [{ label: '9 commits' }, { label: '4 commits' }, { label: '2 commits' }]
  assert.deepEqual(commonLabel(churn), { label: '', all: false })
})

test('nothing is said about one row, or about rows saying nothing', () => {
  assert.deepEqual(commonLabel([{ label: 'modified' }]), { label: '', all: false })
  assert.deepEqual(commonLabel([{ label: '' }, { label: '' }]), { label: '', all: false })
  assert.deepEqual(commonLabel([]), { label: '', all: false })
})
