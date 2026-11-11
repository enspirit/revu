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

The project under review is opened read-only. Nothing is added to its tree: no
branch, no scratch file, no `.gitignore` line.

The single exception is `.revu.yml` at the project root — one short file,
written only when you ask for it by name (`revu init`), and read for four
things: the title, the order a newcomer should read in, paths to skip, and the
scopes the project offers.

## Where your remarks are kept

Not in the project — in one JSON file per project, under your state directory:

```
$XDG_STATE_HOME/revu/<name>-<hash>.json      # or ~/.local/state/revu/…
```

`<name>` is the project folder's name and `<hash>` the first eight hex of a
SHA-1 of its absolute path, so two checkouts of the same repository keep
separate reviews. The file is rewritten — temp file, then rename — on every
save, edit and delete, which is why a refresh, a restart or a week away costs
nothing. `revu` prints the path when it starts and shows it under the review
pane. `REVU_HOME` overrides the directory.

The shape is plain, and yours to edit or delete:

```json
{ "root": "/home/you/code/some-project",
  "notes": [ { "id": "db80c8a1", "at": "2026-02-03T09:12:44.102Z",
               "path": "src/pricing.ts", "from": 40, "to": 48,
               "quote": "export const quote = (plan) => …",
               "exact": true, "tag": "must-fix", "body": "Rounds twice." } ] }
```

Two consequences worth knowing: it is **not** in git, so exporting is how a
review leaves your machine; and if you move or rename the project, the hash
changes and you start a fresh review — the old file stays where it was.

## Use

```bash
npm install -g revu            # or: pnpm add -g revu

revu ~/code/some-project       # read and annotate it, in the browser
revu export ~/code/some-project  # the review so far, as markdown, on stdout
revu scopes ~/code/some-project  # every scope — the places to look — as markdown
revu init ~/code/some-project    # write .revu.yml — the only file revu ever writes
```

`--port N` moves the server (default 7777), `--no-open` keeps the browser shut.

## The three panes

**Left, the map — a list of scopes.** A scope is a named set of places to look.
You enter one, work inside it, and leave it; you are in exactly one, or in none.
There is no file tree, because a tree of 600 files is not a question anybody
has — the search box reaches a file whose name you know, and a scope reaches the
ones you do not.

Scopes stack. Every folder in the path above the open file is a door — click
`api/` and you are in a scope of everything under it, with the one you came
from kept underneath. <kbd>Esc</kbd> (or <kbd>⌫</kbd>) walks back out one step
at a time, and the top row always names where that step goes. The file you are
reading stays open the whole time: moving around the map never disturbs the
page.

Every row is the same four things: **what it is called** (with `:line` when the
scope points at one), **where it lives**, **how long it is**, and whatever this
scope has to say about it. A remark you have already made shows as `●2`.

**Centre, the file.** Markdown renders; <kbd>r</kbd> shows its source. Code
shows with line numbers and syntax colour — four colours, not twenty, because
the job is to tell prose from structure, not to decorate. A line you have
already spoken about carries a mark in the gutter. <kbd>w</kbd> hides the map
when a page wants the width.

**Right, the review.** Each remark carries a tag — `must-fix`, `question`,
`scope`, `idea`, `praise`, `note` — the lines it quotes, and what you said.
Click one and you are back where you wrote it: the file opens at its source,
the whole range is selected again, and the remark is marked as the one you came
from. (Selecting a remark's text still just selects it.) <kbd>e</kbd> exports
the lot: copy it, or download it.

## Which scopes, on what numbers

A project says in `.revu.yml` which scopes it offers, in which order, and on
what thresholds — because *what counts as a large file* is a question about
your project, not about revu. `revu init` writes the list out in full so that
choosing is editing a file rather than remembering a flag.

```yaml
scopes:
  - use: reading             # the order declared above, for a newcomer
  - use: changed             # the working tree against HEAD
  - use: changed             # the same built-in twice, differently
    against: main            #   … or this branch as a whole
  - use: churn               # where the agent has been working
    days: 14
    top: 20
  - use: largest             # your call, not ours
    min: 400
  - use: untested
    min: 150
  - use: decisions           # the record, in order
  - use: uncited             # recorded, then cited by nothing
  - use: links               # prose pointing at nothing
  - use: orphans             # documents reachable from nowhere
  - use: todo
  - use: documents
  - use: all                 # last, and rarely what anyone wants
```

Delete what you do not want; only what is listed is offered. Every entry takes
`title:` and `hint:` if ours read wrong. With no `.revu.yml` at all, you get
that list on its default numbers.

None of them claims a defect. They claim a place to look.

### Scopes of your own

The interesting ones are the ones revu cannot guess. Anything that prints a
location — a linter, a type checker, `git grep`, your own script — is a list of
places to look:

```yaml
  - title: Lint
    run: npx oxlint --format=unix
  - title: Says deploy, not publish      # a project's own vocabulary rule
    hint: the word was decided against
    run: git grep -n -i deploy -- '*.md'
```

Output is read in the format every tool already speaks — `path:line: message`,
tsc's `path(line,col): message`, or a bare path. Lines naming a file the project
does not have are dropped, so summaries and stack frames fall away on their own.

**What that executes, and when.** A declared command runs only when you enter
its scope — never on load, never on `revu scopes` — and the row you click shows
the command it will run. It is still a command out of a file in the repository:
if you did not write that `.revu.yml`, read it before clicking.

**Light or dark** follows the system. <kbd>d</kbd> cycles *auto → light →
dark*, and this browser remembers which — for reading dark at a bright desk,
or the other way round.

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
# Review of some-project

2026-02-03 · 3 remarks · 1 must-fix, 1 question, 1 scope

A human read this repository and wrote the remarks below. Each one quotes the
lines it is about; the address is `path:from-to`. Treat a remark as the
requirement, not as a suggestion to paraphrase back.

## Overall

**scope** — Three ways to do caching now. Pick one before adding a fourth.

## src/pricing.ts

### src/pricing.ts:40-48 — must-fix

> export const quote = (plan) => round(plan.base * vat(plan.country))

Rounds twice: `round` here and again in the caller.
```

Every remark repeats its own path. The section heading says it too, and that is
deliberate: remarks get read, quoted and acted on one at a time, and `L40` by
itself is an address to nowhere.

## Limits, stated rather than discovered

Lockfiles, binaries, images and files over 500 kB are not offered — a dead row
is worse than no row. There is no authentication, because the server binds to
`127.0.0.1` and renders your own repository's markdown, raw HTML included: do
not point it at a repository you would not open in a browser. Remarks are per
project path; move the project and you start a fresh review. The palette is one
set of `light-dark()` values, which wants a 2024-or-later browser — fine for
the one you already have open, and the reason the theme is not written twice.

## Build

Three dependencies (`marked`, `yaml`, `highlight.js`), no build step, Node 20
or later. `npm test` runs the suite: the scopes, the signals, the anchor, the
highlighter's line split and the export are pure functions, and that is where
the tests are.

MIT.
