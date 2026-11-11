# revu

Read a project an AI wrote. Say what you think of it. Hand back one markdown
text.

An agent can produce a hundred files and fifty decision records in an afternoon.
The bottleneck is no longer writing — it is a human holding an accurate picture
of what was built, and answering in a form the next agent will actually obey.
revu is that reading surface, and nothing else: it opens the documents, the
decision records and the sources, it points at the few places attention is
usually required, it lets you select a paragraph and say something about it, and
it exports **one markdown review** you paste into your agent's next prompt.

It reads any project. It knows nothing about yours.

## It does not touch the project

The project under review is opened read-only, and the remarks you write are
stored **outside it**, under `$XDG_STATE_HOME/revu` (`~/.local/state/revu`),
keyed by the project's path. Nothing is added to the tree, no branch, no
scratch file, no `.gitignore` line.

The single exception is `revu.yml` at the project root — one short file, written
only when you ask for it by name (`revu init`), and read for four things: the
title, the order a newcomer should read in, paths to skip, and scopes of your
own.

## Use

```bash
npm install -g revu          # or: pnpm add -g revu

revu ~/Work/ofi.dev          # read and annotate it, in the browser
revu export ~/Work/ofi.dev   # the review so far, as markdown, on stdout
revu scopes ~/Work/ofi.dev   # every scope — the places to look — as markdown
revu init ~/Work/ofi.dev     # write revu.yml — the only file revu ever writes
```

`--port N` moves the server (default 7777), `--no-open` keeps the browser shut.

## The three panes

**Left, the map — a list of scopes.** A scope is a named set of places to look.
You enter one, work inside it, and leave it (<kbd>Esc</kbd>); you are in exactly
one, or in none. There is no file tree, because a tree of 600 files is not a
question anybody has — the search box reaches a file whose name you know, and a
scope reaches the ones you do not.

Every row is the same four things: **what it is called** (with `:line` when the
scope points at one), **where it lives**, **how long it is**, and whatever this
scope has to say about it. A remark you have already made shows as `●2`.

| Scope | Why it earns its place in a generated repository |
|---|---|
| Read in this order | what `revu.yml` asks a newcomer to meet first |
| Changed, not committed | what the working tree holds that no commit does — the first question after an agent has been writing |
| Decisions | the record, in order |
| Documents | the prose |
| Moving most | 30 days of commits: where the agent is currently churning |
| Largest sources | the one complexity measure that needs no parser |
| No test names it | a heuristic by basename, and labelled as one |
| Broken links | prose and tree drifting apart, and prose drifts first |
| Unlinked documents | a document reachable from nowhere was dropped, not written |
| Uncited decisions | a decision nothing cites is dead, or undocumented in code |
| Left for later | TODO, FIXME, XXX, HACK, WIP |
| Every file | last, and rarely what anyone wants |

A scope with nothing in it does not appear. None of them claims a defect — they
claim a place to look.

### Scopes of your own

The interesting ones are the ones revu cannot guess. Anything that prints a
location — a linter, a type checker, `git grep`, your own script — is a list of
places to look, so declare it in `revu.yml`:

```yaml
scopes:
  - title: Lint
    run: npx oxlint --format=unix
  - title: Says deploy, not publish      # the project's own vocabulary rule
    hint: doc/2-domain-concepts.md
    run: git grep -n -i deploy -- '*.md'
```

Output is read in the format every tool already speaks — `path:line: message`,
tsc's `path(line,col): message`, or a bare path. Lines naming a file the project
does not have are dropped, so summaries and stack frames fall away on their own.

**What that executes, and when.** A declared command runs only when you enter
its scope — never on load, never on `revu scopes` — and the row you click shows
the command it will run. It is still a command out of a file in the repository:
if you did not write that `revu.yml`, read it before clicking.

**Centre, the file.** Markdown renders; <kbd>r</kbd> shows its source. Code
shows with line numbers, and a line you have already spoken about carries a mark
in the gutter. <kbd>w</kbd> hides the map when a page wants the width.

**Right, the review.** Each remark carries a tag — `must-fix`, `question`,
`scope`, `idea`, `praise`, `note` — the lines it quotes, and what you said.
Click one and you are back where you wrote it: the file opens at its source,
the whole range is selected again, and the remark is marked as the one you came
from. (Selecting a remark's text still just selects it.) <kbd>e</kbd> exports
the lot: copy it, or download it.

**Saying something** is two steps, never one: *point*, then *speak*. Click a
line number — <kbd>shift</kbd>-click a second one for a range — or select text
in a rendered document. Then <kbd>c</kbd>. Pointing never steals the keyboard,
so you can click your way down a file and still be reading.

## The anchor

A remark has to come back to a line, because a line is what an agent can be
pointed at. Clicking line numbers gives that exactly. Selecting rendered
markdown does not — rendering drops the syntax — so the selected text is matched
against the source with syntax and whitespace normalised. A partial match still
anchors, and the export says `(approximate anchor)` so nobody trusts the number
more than it deserves.

Whatever you anchored is quoted back at you in the composer: focusing the
textarea drops the browser's own highlight, and a remark written on text you can
no longer see is a remark made blind.

## What comes out

```markdown
# Review of ofi.dev

2026-11-11 · 3 remarks · 1 must-fix, 1 question, 1 scope

A human read this repository and wrote the remarks below. Each one quotes the
lines it is about; the address is `path:from-to`. Treat a remark as the
requirement, not as a suggestion to paraphrase back.

## Overall

**scope** — M1 is growing a studio nobody asked for.

## CLAUDE.md

### CLAUDE.md:67 — must-fix

> 2. **Everything that can be a pure, data-driven, stateless function is one**,

This invariant is not honoured in api/src/html.ts.
```

Every remark repeats its own path. The section heading says it too, and that is
deliberate: remarks get read, quoted and acted on one at a time, and `L67` by
itself is an address to nowhere.

## Limits, stated rather than discovered

Lockfiles, binaries, images and files over 500 kB are not offered — a dead entry
in the tree is worse than no entry. There is no syntax highlighting. There is no
authentication, because the server binds to `127.0.0.1` and renders your own
repository's markdown, raw HTML included: do not point it at a repository you
would not open in a browser. Remarks are per project path; move the project and
you start a fresh review.

## Build

Two dependencies (`marked`, `yaml`), no build step, Node 20 or later.
`npm test` runs the suite: every signal, the anchor and the export are pure
functions, and that is where the tests are.

MIT.
