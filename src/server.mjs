// The HTTP edge. Thin by intent: every answer below is a pure function of the
// project snapshot and the note store, serialised.
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { locate } from './anchor.mjs'
import { render } from './export.mjs'
import * as notes from './notes.mjs'
import { highlight } from './highlight.mjs'
import { gitFacts, openProject } from './project.mjs'
import { parseLocations, runCommand } from './run.mjs'
import { catalogue, FOLDER, folderScope, headers, sized } from './scopes.mjs'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', 'web')
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css' }
const MAX_QUOTE_LINES = 40

marked.setOptions({ gfm: true, breaks: false })

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' })
  res.end(body)
}
const json = (res, body, code = 200) => send(res, code, 'application/json', JSON.stringify(body))

const body = (req) =>
  new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1e6) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}))
    req.on('error', reject)
  })

const excerpt = (lines, from, to) => {
  const slice = lines.slice(from - 1, Math.min(to, from - 1 + MAX_QUOTE_LINES))
  return slice.join('\n') + (to - from + 1 > MAX_QUOTE_LINES ? '\n…' : '')
}

export const serve = ({ root, port, host = '127.0.0.1' }) => {
  let project = openProject(root)
  let scopes = catalogue(project, gitFacts(root))
  const store = notes.open(root)

  const reopen = () => {
    project = openProject(root)
    scopes = catalogue(project, gitFacts(root))
  }

  const map = () => ({
    title: project.config.title,
    root,
    store: store.file,
    counts: project.counts,
    tags: notes.TAGS,
    files: sized(
      project.files.map((f) => ({ path: f.path, label: '' })),
      project.corpus,
    ),
    scopes: headers(scopes),
  })

  const scope = async (id) => {
    if (id.startsWith(FOLDER)) {
      const folder = folderScope(project.files, id.slice(FOLDER.length))
      return folder.items.length ? { ...folder, items: sized(folder.items, project.corpus) } : null
    }
    const found = scopes.find((s) => s.id === id)
    if (!found) return null
    if (!found.command) return { ...found, items: sized(found.items, project.corpus) }

    const { out, failed, error } = await runCommand(root, found.command)
    const items = parseLocations(out, new Set(project.paths))
    return { ...found, items: sized(items, project.corpus), ran: found.command, error: failed ? error : null }
  }

  // Three forms of the same file: the lines (what a remark is anchored to and
  // quoted from), the rendering (prose only), and the coloured lines.
  const file = (path) => {
    const found = project.corpus.get(path)
    if (!found) return null
    const html = found.kind === 'code' ? null : marked.parse(found.lines.join('\n'))
    return { path, kind: found.kind, lines: found.lines, html, tokens: highlight(path, found.lines) }
  }

  // A remark arrives either as a line range (source view) or as selected text
  // (rendered view); the second is anchored back to lines before it is stored.
  const place = (input) => {
    const found = project.corpus.get(input.path)
    if (!found) return { path: null, from: null, to: null, quote: '', exact: true }
    let { from, to } = input
    let exact = true
    if (from == null && input.quote) {
      const at = locate(found.lines, input.quote)
      if (at) ({ from, to, exact } = at)
    }
    if (from == null) return { path: input.path, from: null, to: null, quote: input.quote ?? '', exact }
    return { path: input.path, from, to: to ?? from, quote: excerpt(found.lines, from, to ?? from), exact }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    const p = url.pathname
    try {
      if (p === '/' || p === '/index.html') return send(res, 200, TYPES.html, readFileSync(join(WEB, 'index.html')))
      if (p === '/app.js' || p === '/app.css')
        return send(res, 200, TYPES[p.split('.').pop()], readFileSync(join(WEB, p.slice(1))))

      if (p === '/api/map') {
        if (url.searchParams.has('fresh')) reopen()
        return json(res, map())
      }
      if (p === '/api/scope') {
        const found = await scope(url.searchParams.get('id') ?? '')
        return found ? json(res, found) : json(res, { error: 'no such scope' }, 404)
      }
      if (p === '/api/file') {
        const found = file(url.searchParams.get('path') ?? '')
        return found ? json(res, found) : json(res, { error: 'not in this project' }, 404)
      }
      if (p === '/api/export')
        return send(
          res,
          200,
          'text/markdown',
          render(project.config.title, store.all(), { order: project.files.map((f) => f.path) }),
        )

      if (p === '/api/notes') {
        if (req.method === 'GET') return json(res, store.all())
        if (req.method === 'POST') {
          const input = await body(req)
          const tag = notes.TAGS.includes(input.tag) ? input.tag : 'note'
          const placed = input.path ? place(input) : { path: null }
          return json(res, store.add({ ...placed, tag, body: String(input.body ?? '') }), 201)
        }
        const id = url.searchParams.get('id')
        if (req.method === 'PATCH') {
          const input = await body(req)
          const patch = {}
          if (notes.TAGS.includes(input.tag)) patch.tag = input.tag
          if (input.body != null) patch.body = String(input.body)
          const updated = store.update(id, patch)
          return updated ? json(res, updated) : json(res, { error: 'no such remark' }, 404)
        }
        if (req.method === 'DELETE') {
          store.remove(id)
          return json(res, { ok: true })
        }
      }
      json(res, { error: 'no such route' }, 404)
    } catch (err) {
      json(res, { error: err.message }, 500)
    }
  })

  return new Promise((resolve) => server.listen(port, host, () => resolve(server)))
}
