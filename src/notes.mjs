// Remarks live beside revu, never inside the project under review: the project
// is read-only on principle, and a review is the reviewer's, not the repo's.
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

export const TAGS = ['must-fix', 'question', 'scope', 'idea', 'praise', 'note']

export const storePath = (root) => {
  const base =
    process.env.REVU_HOME ??
    join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'revu')
  const id = createHash('sha1').update(root).digest('hex').slice(0, 8)
  return join(base, `${basename(root).replace(/[^\w.-]/g, '_')}-${id}.json`)
}

export const open = (root) => {
  const file = storePath(root)
  mkdirSync(join(file, '..'), { recursive: true })

  let state
  try {
    state = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    state = { root, notes: [] }
  }

  const flush = () => {
    writeFileSync(file + '.tmp', JSON.stringify(state, null, 2))
    renameSync(file + '.tmp', file)
  }

  return {
    file,
    all: () => state.notes,
    add(note) {
      const made = { id: randomUUID().slice(0, 8), at: new Date().toISOString(), ...note }
      state.notes.push(made)
      flush()
      return made
    },
    update(id, patch) {
      const note = state.notes.find((n) => n.id === id)
      if (!note) return null
      Object.assign(note, patch)
      flush()
      return note
    },
    remove(id) {
      state.notes = state.notes.filter((n) => n.id !== id)
      flush()
    },
  }
}
