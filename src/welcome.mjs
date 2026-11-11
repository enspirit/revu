// The first time revu runs on a machine, it says the two things a newcomer
// cannot guess: what to do next, and where the remarks go. npm swallows
// postinstall output by default, so this is the only place the message would
// actually be read — and a tool whose point is that it writes nothing has no
// business adding an install hook anyway.
const bold = (s, tty) => (tty ? `\u001b[1m${s}\u001b[0m` : s)
const dim = (s, tty) => (tty ? `\u001b[2m${s}\u001b[0m` : s)

export const welcome = (version, dir, tty = false) =>
  `
  ${bold(`revu ${version}`, tty)} — a reading surface for code you did not write.

  ${bold('Your remarks are kept outside the project', tty)}, one JSON file per project in
  ${dim(dir, tty)}
  Nothing is written into the repository you are reading, and nothing leaves
  this machine. ${bold('e', tty)} exports the review as one markdown text.

  ${bold('revu init .', tty)} writes a ${bold('.revu.yml', tty)} — the only file revu ever puts in a
  project — where you choose which scopes it offers, and on what numbers.

  ${dim('Why this exists: https://revu.enspirit.be', tty)}
`
