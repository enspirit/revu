// One page, no framework. The whole client is: fetch a snapshot, draw three
// panes, and post a remark. State is small enough to redraw whole panes.
const $ = (sel) => document.querySelector(sel)
const make = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const kid of kids) node.append(kid)
  return node
}

const api = {
  map: (fresh) => fetch(`/api/map${fresh ? '?fresh=1' : ''}`).then((r) => r.json()),
  file: (path) => fetch(`/api/file?path=${encodeURIComponent(path)}`).then((r) => r.json()),
  scope: (id) => fetch(`/api/scope?id=${encodeURIComponent(id)}`).then((r) => r.json()),
  notes: () => fetch('/api/notes').then((r) => r.json()),
  add: (note) =>
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(note),
    }).then((r) => r.json()),
  edit: (id, patch) =>
    fetch(`/api/notes?id=${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => r.json()),
  drop: (id) => fetch(`/api/notes?id=${id}`, { method: 'DELETE' }),
  markdown: () => fetch('/api/export').then((r) => r.text()),
}

const state = {
  map: null,
  file: null,
  view: 'prose',
  sel: null,
  notes: [],
  filter: '',
  active: null,
  scope: null, // the one scope we are inside, or null for the list of them
}

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '')
const baseOf = (path) => path.slice(path.lastIndexOf('/') + 1)
const addressOf = (n) =>
  n.from == null ? 'whole file' : n.from === n.to ? `L${n.from}` : `L${n.from}-${n.to}`

/* ---------- the map is a list of scopes, and you are in one or none ---------- */

const remarkCounts = () => {
  const counts = new Map()
  for (const n of state.notes) if (n.path) counts.set(n.path, (counts.get(n.path) ?? 0) + 1)
  return counts
}

// One row shape everywhere: what the file is called, where it lives, how much
// of it there is, and what this scope has to say about it. A word or two sits
// on the same line; a grep match takes its own, because a row you cannot
// identify is a row you cannot use.
const INLINE_LABEL = 24

const itemRow = (item, counts) => {
  const at = item.line ? `${item.path}:${item.line}` : item.path
  const long = (item.label ?? '').length > INLINE_LABEL
  const row = make('a', { className: 'file', title: `${at}${item.label ? ' — ' + item.label : ''}` }, [
    make('span', { className: 'base', textContent: baseOf(item.path) + (item.line ? ':' + item.line : '') }),
    make('span', { className: 'where', textContent: dirOf(item.path) }),
  ])
  const n = counts.get(item.path)
  if (n) row.append(make('span', { className: 'n', textContent: `●${n}` }))
  if (item.label && !long) row.append(make('span', { className: 'said', textContent: item.label }))
  if (item.size != null)
    row.append(make('span', { className: 'size', title: `${item.size} lines`, textContent: item.size }))
  if (long) row.append(make('span', { className: 'said line-two', textContent: item.label }))
  if (state.file?.path === item.path) row.classList.add('on')
  row.onclick = () => openFile(item.path, item.line)
  return row
}

const drawList = () => {
  const list = $('#list')
  list.replaceChildren()
  const counts = remarkCounts()

  // Typing is its own scope, made on the spot and left by clearing the box.
  if (state.filter) {
    const hits = state.map.files.filter((f) => f.path.toLowerCase().includes(state.filter))
    list.append(make('div', { className: 'section' }, [
      make('span', { textContent: `matching “${state.filter}”` }),
      make('span', { className: 'count', textContent: hits.length }),
    ]))
    for (const hit of hits.slice(0, 200)) list.append(itemRow(hit, counts))
    return
  }

  if (state.scope) {
    const back = make('div', { className: 'section back' }, [
      make('span', { textContent: `‹ ${state.scope.title}` }),
      make('span', { className: 'count', textContent: state.scope.items.length }),
    ])
    back.onclick = exitScope
    list.append(back, make('div', { className: 'hint scope-hint', textContent: state.scope.hint }))
    if (state.scope.error)
      list.append(make('p', { className: 'hint', textContent: state.scope.error }))
    if (!state.scope.items.length)
      list.append(make('p', { className: 'hint', textContent: 'Nothing here. That is an answer too.' }))
    for (const item of state.scope.items) list.append(itemRow(item, counts))
    return
  }

  for (const scope of state.map.scopes) {
    const row = make('div', { className: 'scope', title: scope.command ?? scope.hint }, [
      make('div', { className: 'top' }, [
        make('b', { textContent: scope.title }),
        make('span', { className: 'spacer' }),
        make('span', { className: 'count', textContent: scope.count ?? '·' }),
      ]),
      make('div', { className: 'hint', textContent: scope.hint }),
    ])
    row.onclick = () => enterScope(scope.id)
    list.append(row)
  }
}

const enterScope = async (id) => {
  const pending = state.map.scopes.find((s) => s.id === id)
  if (pending?.command) {
    state.scope = { ...pending, items: [], hint: `running ${pending.command}…` }
    drawList()
  }
  const scope = await api.scope(id)
  if (scope.items) state.scope = scope
  drawList()
}

const exitScope = () => {
  state.scope = null
  drawList()
}

/* ---------- file ---------- */

const drawFile = () => {
  const content = $('#content')
  content.replaceChildren()
  content.classList.remove('empty')
  $('#path').title = state.file.path
  $('#path').replaceChildren(
    make('span', { className: 'pdir', textContent: dirOf(state.file.path) }),
    make('span', { className: 'pbase', textContent: baseOf(state.file.path) }),
  )
  $('#toggle').hidden = !state.file.html
  $('#toggle').textContent = state.view === 'prose' ? 'source ( r )' : 'rendered ( r )'

  if (state.view === 'prose' && state.file.html) {
    content.append(make('div', { className: 'prose', innerHTML: state.file.html }))
    return
  }
  const src = make('div', { className: 'src' })
  state.file.lines.forEach((line, i) => {
    const no = i + 1
    const row = make('div', { className: 'row' }, [
      make('span', { className: 'ln', textContent: String(no) }),
      make('code', { textContent: line }),
    ])
    row.dataset.line = no
    row.querySelector('.ln').onclick = (ev) => pickLine(no, ev.shiftKey)
    src.append(row)
  })
  content.append(src)
  paintNoted()
  paintSelection()
}

// Marks are repainted rather than redrawn: saving a remark must not scroll the
// file back to the top under the reader.
const paintNoted = () => {
  const noted = new Set()
  for (const n of state.notes)
    if (n.path === state.file?.path && n.from) for (let i = n.from; i <= n.to; i += 1) noted.add(i)
  for (const row of document.querySelectorAll('.row'))
    row.classList.toggle('noted', noted.has(Number(row.dataset.line)))
}

const paintSelection = () => {
  const { from, to } = state.sel ?? {}
  for (const row of document.querySelectorAll('.row')) {
    const n = Number(row.dataset.line)
    row.classList.toggle('on', from != null && n >= from && n <= to)
  }
  $('#comment').classList.toggle('ready', from != null)
  $('#comment').firstChild.textContent = from == null ? 'comment ' : `comment ${addressOf(state.sel)} `
}

// Clicking a line points at it; `c` is what speaks. Opening the composer on
// every click would steal the focus from a reader who is only looking around.
const pickLine = (no, extend) => {
  state.sel =
    extend && state.sel?.from != null
      ? { path: state.file.path, from: Math.min(state.sel.from, no), to: Math.max(state.sel.from, no) }
      : { path: state.file.path, from: no, to: no }
  paintSelection()
}

const scrollToLine = (line) =>
  document.querySelector(`.row[data-line="${line}"]`)?.scrollIntoView({ block: 'center' })

// `from`/`to` reopen a range: a remark is walked back to the lines it was made
// on, not merely to the file. `active` is the remark we came from, if any.
const openFile = async (path, from, to, active = null) => {
  state.file = await api.file(path)
  if (state.file.error) return
  state.active = active
  state.view = from || !state.file.html ? 'source' : 'prose'
  state.sel = from ? { path, from, to: to ?? from } : null
  drawFile()
  paintSelection()
  drawList()
  closeComposer()
  drawReview()
  if (from) scrollToLine(from)
}

// Back to what I was looking at when I said this. A remark about the whole
// project has no lines to return to, so it stays where it is.
const revisit = (note) => note.path && openFile(note.path, note.from, note.to, note.id)

/* ---------- composer ---------- */

// What a remark is about, in order of precision: the text you selected, the
// lines you clicked, or — if you asked for neither — the file you are reading.
const takeSelection = () => {
  if (!state.file) return null
  const text = state.view === 'prose' ? window.getSelection()?.toString().trim() : ''
  if (text) return { path: state.file.path, quote: text }
  return state.sel ?? { path: state.file.path }
}

const closeComposer = () => {
  const box = $('#composer')
  box.hidden = true
  box.replaceChildren()
}

const drawComposer = (note) => {
  const box = $('#composer')
  const target = note ?? state.sel
  if (!target) return closeComposer()
  const where = note
    ? `editing — ${note.path ? note.path + ' ' + addressOf(note) : 'overall'}`
    : target.overall
      ? 'a remark about the whole project'
      : `${target.path}  ${target.from ? addressOf(target) : target.quote ? 'selected text' : 'the whole file'}`
  const preview =
    note?.quote ??
    target.quote ??
    (target.from ? state.file.lines.slice(target.from - 1, target.to).join('\n') : '')

  const tags = make(
    'select',
    {},
    state.map.tags.map((t) =>
      make('option', { value: t, textContent: t, selected: (note?.tag ?? 'note') === t }),
    ),
  )
  const body = make('textarea', {
    placeholder: 'What should change, and why. Be concrete — an agent will read this.',
    value: note?.body ?? '',
  })
  const save = make('button', { className: 'primary', textContent: '⌘⏎ save' })
  const cancel = make('button', { textContent: 'cancel' })

  const commit = async () => {
    if (!body.value.trim()) return
    if (note) await api.edit(note.id, { tag: tags.value, body: body.value })
    else
      await api.add({
        path: target.overall ? null : target.path,
        from: target.from ?? null,
        to: target.to ?? null,
        quote: target.quote ?? null,
        tag: tags.value,
        body: body.value,
      })
    state.sel = null
    state.notes = await api.notes()
    closeComposer()
    drawReview()
    drawList()
    paintNoted()
    paintSelection()
  }
  save.onclick = commit
  cancel.onclick = () => {
    state.sel = null
    closeComposer()
    paintSelection()
  }
  body.onkeydown = (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) commit()
    if (ev.key === 'Escape') cancel.onclick()
  }

  box.replaceChildren(make('div', { className: 'where', textContent: where }))
  if (preview) box.append(make('blockquote', { textContent: preview }))
  box.append(tags, body, make('div', { className: 'acts-row' }, [save, cancel]))
  box.hidden = false
  body.focus()
}

/* ---------- review ---------- */

const drawReview = () => {
  const order = state.map.files.map((f) => f.path)
  const rank = (p) => (p ? (order.indexOf(p) < 0 ? order.length : order.indexOf(p)) : -1)
  const sorted = [...state.notes].sort(
    (a, b) => rank(a.path) - rank(b.path) || (a.from ?? 0) - (b.from ?? 0),
  )
  const tags = new Map()
  for (const n of sorted) tags.set(n.tag, (tags.get(n.tag) ?? 0) + 1)
  $('#tally').textContent = sorted.length
    ? [...tags].map(([t, n]) => `${n} ${t}`).join(' · ')
    : 'nothing said yet'

  const box = $('#remarks')
  box.replaceChildren()
  if (!sorted.length)
    box.append(
      make('p', {
        className: 'hint',
        textContent:
          'Remarks land here, newest file first, and leave as one markdown text. Nothing is written into the project.',
      }),
    )
  let path = undefined
  for (const note of sorted) {
    if (note.path !== path) {
      path = note.path
      box.append(make('div', { className: 'dir', textContent: path ?? 'overall' }))
    }
    const at = make('span', { className: 'at', textContent: note.path ? addressOf(note) : '—' })
    const edit = make('button', { textContent: 'edit' })
    edit.onclick = () => drawComposer(note)
    const drop = make('button', { textContent: 'delete' })
    drop.onclick = async () => {
      await api.drop(note.id)
      state.notes = await api.notes()
      drawReview()
      drawList()
      paintNoted()
    }
    const classes = ['remark']
    if (note.path === state.file?.path) classes.push('here')
    if (note.id === state.active) classes.push('active')
    if (note.path) classes.push('back')
    const card = make('div', { className: classes.join(' ') }, [
      make('div', { className: 'top' }, [
        make('span', { className: `tag ${note.tag}`, textContent: note.tag }),
        at,
        make('span', { className: 'spacer' }),
        make('span', { className: 'acts' }, [edit, drop]),
      ]),
    ])
    if (note.quote) card.append(make('blockquote', { textContent: note.quote }))
    card.append(make('p', { className: 'body', textContent: note.body }))
    // The whole card is the way back, except its buttons — and except when you
    // were selecting this card's own text rather than clicking it. A selection
    // left behind somewhere else on the page is none of its business.
    card.onclick = (ev) => {
      const picked = window.getSelection()
      if (ev.target.closest('button')) return
      if (picked && !picked.isCollapsed && card.contains(picked.anchorNode)) return
      revisit(note)
    }
    box.append(card)
  }
}

/* ---------- shell ---------- */

const sheet = async () => {
  $('#markdown').value = await api.markdown()
  $('#sheet').showModal()
}

const boot = async (fresh) => {
  state.map = await api.map(fresh)
  state.notes = await api.notes()
  state.scope = null // re-reading the project makes any entered scope stale
  $('#title').textContent = state.map.title
  const { doc, decision, code } = state.map.counts
  $('#counts').textContent = `${doc} documents · ${decision} decisions · ${code} sources`
  $('#store').textContent = state.map.store
  document.title = `revu — ${state.map.title}`
  drawList()
  drawReview()
}

$('#search').oninput = (ev) => {
  state.filter = ev.target.value.trim().toLowerCase()
  drawList()
}
// Switching between the rendering and the source should land you on the same
// paragraph: on the selected lines if there are any, on the same fraction of
// the file otherwise.
$('#toggle').onclick = () => {
  const content = $('#content')
  const span = Math.max(1, content.scrollHeight - content.clientHeight)
  const ratio = content.scrollTop / span
  state.view = state.view === 'prose' ? 'source' : 'prose'
  drawFile()
  if (state.sel?.from) scrollToLine(state.sel.from)
  else content.scrollTop = ratio * Math.max(1, content.scrollHeight - content.clientHeight)
}
$('#wide').onclick = () => document.body.classList.toggle('wide')
$('#refresh').onclick = () => boot(true)
$('#comment').onclick = () => {
  state.sel = takeSelection()
  if (state.sel) drawComposer()
}
$('#overall').onclick = () => {
  state.sel = { overall: true }
  drawComposer()
}
$('#export').onclick = sheet
$('#close').onclick = () => $('#sheet').close()
$('#copy').onclick = () => navigator.clipboard.writeText($('#markdown').value)
$('#download').onclick = () => {
  const blob = new Blob([$('#markdown').value], { type: 'text/markdown' })
  const link = make('a', { href: URL.createObjectURL(blob), download: `review-${state.map.title}.md` })
  link.click()
  URL.revokeObjectURL(link.href)
}

// Every shortcut consumes its key: `c` opens the composer and focuses it, and
// without this the same keystroke lands in the textarea as text.
const SHORTCUTS = {
  c: () => state.file && $('#comment').onclick(),
  r: () => state.file?.html && $('#toggle').onclick(),
  w: () => $('#wide').onclick(),
  e: () => sheet(),
  '/': () => $('#search').focus(),
  Escape: () => exitScope(),
}

document.addEventListener('keydown', (ev) => {
  // Escape leaves a scope from anywhere, including the search box.
  if (ev.key === 'Escape' && ev.target === $('#search')) {
    ev.target.value = ''
    state.filter = ''
    ev.target.blur()
    return drawList()
  }
  if (ev.metaKey || ev.ctrlKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return
  if (!SHORTCUTS[ev.key]) return
  ev.preventDefault()
  SHORTCUTS[ev.key]()
})

boot()
