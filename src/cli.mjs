#!/usr/bin/env node
// revu — read a project an AI wrote, annotate it, hand back one markdown review.
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CONFIG_NAME, template } from './config.mjs'
import { render } from './export.mjs'
import * as notes from './notes.mjs'
import { gitFacts, openProject } from './project.mjs'
import { catalogue, sized } from './scopes.mjs'
import { serve } from './server.mjs'
import { welcome } from './welcome.mjs'

const { version: VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const USAGE = `revu — read a project, annotate it, hand back one markdown review.

  revu [path]              read and annotate it in the browser (default)
  revu export [path]       print the review written so far, as markdown
  revu scopes [path]       print every scope — the places to look — as markdown
  revu init [path]         write ${CONFIG_NAME} — the only file revu ever writes

  --port N                 default 7777      --no-open    do not open a browser
  --force                  overwrite ${CONFIG_NAME}

Remarks are kept outside the project, under $XDG_STATE_HOME/revu.
`

const argv = process.argv.slice(2)
const positional = []
const flags = new Map()
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (!arg.startsWith('-')) positional.push(arg)
  else if (arg === '--port') flags.set('--port', argv[(i += 1)])
  else flags.set(arg, true)
}
const flag = (name) => flags.has(name)
const value = (name, fallback) => flags.get(name) ?? fallback

const COMMANDS = new Set(['export', 'scopes', 'init', 'serve'])
const named = COMMANDS.has(positional[0])
const command = named ? positional[0] : 'serve'
const root = resolve(positional[named ? 1 : 0] ?? '.')

const openBrowser = (url) => {
  const cmd = { darwin: 'open', win32: 'start' }[process.platform] ?? 'xdg-open'
  execFile(cmd, [url], () => {})
}

const LISTED = 20

const asList = (scopes, corpus) =>
  scopes
    .map((s) => {
      const head = `## ${s.title} — ${s.hint}`
      if (s.command) return `${head}\n\n_not run here; entering this scope in the browser runs it._`
      const items = sized(s.items, corpus)
      const rows = items
        .slice(0, LISTED)
        .map(
          (i) =>
            `- \`${i.path}${i.line ? ':' + i.line : ''}\`` +
            `${i.label ? ' ' + i.label : ''}${i.size == null ? '' : ` (${i.size} lines)`}`,
        )
      if (items.length > LISTED) rows.push(`- … and ${items.length - LISTED} more`)
      return `${head}\n\n${rows.join('\n')}`
    })
    .join('\n\n')

if (flag('--help') || flag('-h')) {
  process.stdout.write(USAGE)
} else if (command === 'init') {
  const file = join(root, CONFIG_NAME)
  if (existsSync(file) && !flag('--force')) {
    process.stderr.write(`${CONFIG_NAME} already exists. Pass --force to replace it.\n`)
    process.exit(1)
  }
  const project = openProject(root)
  const reading = project.files.filter((f) => f.kind === 'doc').slice(0, 8)
  writeFileSync(file, template(root, reading.map((f) => f.path)))
  process.stdout.write(`wrote ${file}\n`)
} else if (command === 'export') {
  const project = openProject(root)
  process.stdout.write(
    render(project.config.title, notes.open(root).all(), { order: project.files.map((f) => f.path) }),
  )
} else if (command === 'scopes') {
  const project = openProject(root)
  const all = catalogue(project, gitFacts(root))
  process.stdout.write(
    `# Scopes — ${project.config.title}\n\nEach one is a list of places to look.\n\n` +
      `${asList(all, project.corpus)}\n`,
  )
} else {
  const port = Number(value('--port', 7777))
  const project = openProject(root)
  const { doc, decision, code } = project.counts
  // Once per machine, before anything else: the store does not exist until a
  // first remark is saved, which makes it an honest "have we met?".
  if (!existsSync(notes.storeDir()))
    process.stdout.write(welcome(VERSION, notes.storeDir(), process.stdout.isTTY))

  await serve({ root, port })
  const url = `http://127.0.0.1:${port}`
  process.stdout.write(
    `revu ${url}\n  ${project.config.title}: ${doc} documents, ${decision} decisions, ${code} sources\n` +
      `  remarks in ${notes.storePath(root)}\n`,
  )
  if (!flag('--no-open')) openBrowser(url)
}
