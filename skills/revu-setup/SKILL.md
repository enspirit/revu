---
name: revu-setup
description: Inspect a repository and write a .revu.yml for revu — a reading order, scopes tuned to this codebase's own numbers, and command scopes wired to the linter, type checker and coverage report the project already has. Use when setting revu up on a project for the first time, or when its scopes have stopped matching the code.
---

# Set revu up on this project

Your job is to produce a `.revu.yml` that makes a human's first hour in this
repository productive — and to wire it to the harness that already exists here,
rather than to the one you would have chosen.

Two rules frame everything below.

- **Nothing is written to the project except `.revu.yml` and, if needed, a
  `.revu/` folder holding small helper scripts.** Say so before you create the
  folder, and keep it to scripts the config actually uses.
- **Never write a command you have not run.** A scope that errors on first
  click is worse than a scope that does not exist. Run it, read its output,
  then write it down.

## 1. Learn what this project is

Read, in this order, whichever exist: `README`, `CONTRIBUTING`, `CLAUDE.md` or
`AGENTS.md`, the architecture or design documents they point at, and the
manifest (`package.json`, `pyproject.toml`, `Gemfile`, `go.mod`, `Cargo.toml`,
`composer.json`). Note the layout — monorepo or single package, where sources
live, where tests live, where prose lives.

From that, decide the **reading order**: the three to eight files a newcomer
should meet, in sequence, to understand the project. Prose first, but a source
file earns a place if it is where the design actually lives. A path that does
not exist is dropped silently, so check each one.

## 2. Find the harness that is already here

Do not guess which tools are installed — look, then run.

| Where to look | What you are looking for |
|---|---|
| `package.json` scripts and devDependencies | `lint`, `typecheck`, `test`, `coverage`; eslint, oxlint, biome, tsc, vitest, jest |
| `pyproject.toml`, `setup.cfg`, `tox.ini` | ruff, flake8, mypy, pytest, coverage |
| `Gemfile`, `Rakefile`, `.rubocop.yml` | rubocop, standard, rspec, simplecov |
| `go.mod`, `.golangci.yml` | `go vet`, golangci-lint |
| `Cargo.toml` | `cargo clippy` |
| `Makefile`, `Justfile`, `Taskfile.yml`, `.emb.yml` | the project's own task names — prefer these |
| CI workflow files | the commands this project actually trusts |
| `coverage/`, `lcov.info`, `coverage.xml`, `.resultset.json` | a coverage report you can turn into a scope |

**Prefer the project's own task runner** (`npm run lint`, `rake lint`,
`just check`) over a raw binary: it carries the flags this project has already
decided on. Fall back to the binary only when the task does something extra —
fixing files, failing the build, starting a server.

## 3. Make each tool print locations

revu reads any line that names a place in the project:

```
path/to/file.ts:42:7: message      # eslint, oxlint, ruff, grep, golangci-lint
path/to/file.ts(42,7): message     # tsc
path/to/file.ts:42                 # a bare location
path/to/file.ts                    # a whole file
```

Anything else on the line is ignored, and a path this project does not have is
dropped — so summaries, banners and stack frames fall away on their own.

Most tools have a flag for this: `--format=unix` (oxlint, ruff, eslint
`--format=compact`), `--out-format=line-number` (golangci-lint),
`--message-format=short` (cargo), `--no-pretty` (tsc), `--format=emacs`
(rubocop, semgrep). Find the flag. If there is none, write a small script in
`.revu/` that converts the output — that is what the folder is for.

A coverage report is worth the effort: the files with the least covered lines
are exactly the scope a reviewer wants. Convert the report to one path per
line, worst first, in `.revu/uncovered.sh` (or `.mjs`, `.rb` — whatever this
project already speaks).

**Then run each command and look at what came out.** It must:

- finish in a few seconds — it runs when a human clicks the scope, not in CI;
- change nothing: no writes, no installs, no network, no git mutation;
- print at least one line naming a real file, when the project has something to
  report. An empty answer is fine *if you have checked that it is the truth*.

Add `|| true` only where a non-zero exit is normal (most linters). revu keeps
stdout and stderr either way.

## 4. Choose numbers from this project, not from the defaults

`largest: min` and `untested: min` are questions about this codebase. Look at
the actual distribution — `wc -l` over the sources, sorted — and set the floor
so the scope holds roughly ten to twenty files: the ones a reviewer would
genuinely call long. Two hundred and fifty lines is unremarkable in one
repository and alarming in another.

Same for `churn: days`: a repository three weeks old wants seven, a decade-old
one wants thirty. Look at `git log` before choosing.

## 5. Write the file

Declare only the scopes that say something here. The built-ins:

| `use:` | parameters | what it holds |
|---|---|---|
| `reading` | — | the order declared above |
| `commit` | `ref` | what one commit touched, `HEAD` by default |
| `changed` | `against` | the working tree, or this branch against a ref |
| `churn` | `days`, `top` | where the work has been |
| `largest` | `min`, `top`, `kind: code\|doc\|any` | long sources, or the prose an agent padded |
| `untested` | `min`, `top` | sources no test names |
| `unreferenced` | `min`, `top` | files nothing else mentions |
| `links` · `orphans` · `uncited` | — | prose pointing nowhere, documents and decisions nothing points at |
| `decisions` · `documents` | — | the record, and the prose |
| `todo` | `top` | TODO, FIXME, XXX, HACK, WIP |
| `all` | — | everything revu can open; keep it last |

Order them the way a reviewer would work: what just changed, then what is
suspicious, then the corpus. Comment each number in the project's own terms —
*why* four hundred lines is the floor here. Drop any scope whose answer is
empty for a structural reason (no decision records, no prose) rather than
leaving it to return nothing forever.

A finished file looks like this:

```yaml
title: acme-api

reading:
  - README.md
  - docs/architecture.md
  - src/domain/pricing.ts # the rules everything else serves

exclude:
  - vendor

scopes:
  - use: commit
  - use: changed
  - use: churn
    days: 14 # this team merges daily
    top: 20
  - use: largest
    min: 400 # p90 here; 250 would list a third of the codebase
  - use: largest
    kind: doc
    min: 200
  - use: untested
    min: 120
  - use: unreferenced
    min: 20
  - use: todo
  - use: all

  - title: Lint
    hint: eslint, as CI runs it
    run: npm run --silent lint -- --format=compact || true
  - title: Types
    hint: tsc --noEmit
    run: npx tsc --noEmit --pretty false || true
  - title: Least covered
    hint: from the last coverage run
    run: .revu/uncovered.sh
```

## 6. Check your work before reporting

Run `revu scopes .` and read it. Every declared scope should appear with a
count that is neither zero-by-accident nor the whole repository. Fix the
numbers and run it again. Then confirm the command scopes by running each one
exactly as written.

Report, briefly:

- the harness you found, and which tools you wired in;
- any tool you **skipped**, and why — not installed, too slow, writes files,
  output impossible to parse;
- the numbers you chose and what you based them on;
- anything you put in `.revu/`.

Do not report success for a scope you did not run.
