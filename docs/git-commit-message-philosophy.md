# Git Commit Message Philosophy

Based on Chris Beams' classic post: [How to Write a Git Commit Message](https://cbea.ms/git-commit/)

## Core Idea

A commit message exists to communicate **context** — the *why* behind a change, not the *how*. The code itself tells you what changed and how; only a well-written commit message can tell you *why* it changed.

> *"A diff will tell you what changed, but only the commit message can properly tell you why."*

## What vs. How vs. Why

| Dimension | Where to find it |
|---|---|
| **What** changed | In the diff — visible via `git show`, `git diff`, `git log -p` |
| **How** it changed | In the code — the implementation is self-explanatory |
| **Why** it changed | **In the commit message** — the only place this lives |

**The rule:** explain what problem the commit solves, what was wrong before, why this approach was chosen. Leave the implementation details to the source code.

> *"In most cases, you can leave out details about how a change has been made. Code is generally self-explanatory in this regard (and if the code is so complex that it needs to be explained in prose, that's what source comments are for). Just focus on making clear the reasons why you made the change in the first place."*

## Why It Matters

Establishing context for a piece of code is wasteful. Every future developer (including your future self) who looks at a change has to reconstruct the reasoning behind it. A good commit message eliminates that waste permanently. As Peter Hutterer wrote:

> *"A commit message shows whether a developer is a good collaborator."*

Without a meaningful message, the context is lost forever once the author moves on. The commit log is a maintainer's most powerful tool.

## The Seven Rules (Summary)

1. **Separate subject from body with a blank line** — Git tools (`log`, `shortlog`, `format-patch`) rely on this distinction.
2. **Limit the subject line to 50 characters** — forces concise thinking; treat 72 as the hard cap.
3. **Capitalize the subject line.**
4. **Do not end the subject line with a period** — trailing punctuation wastes precious 50-char space.
5. **Use the imperative mood in the subject line** — it should complete the sentence: "If applied, this commit will *[subject]*".
6. **Wrap the body at 72 characters** — Git never wraps text automatically; 72 leaves room for indentation while staying under 80.
7. **Use the body to explain *what* and *why* vs. *how*** — the most important rule.

## When a Single Line Is Enough

Not every commit needs a body. Simple, self-explanatory changes (e.g., *"Fix typo in introduction to user guide"*) can stand alone — the reader can see the exact change in the diff. The body exists for changes that need context: why the old approach didn't work, what trade-offs were considered, what side effects exist.

## Reference

- Full article: [How to Write a Git Commit Message](https://cbea.ms/git-commit/)
- Peter Hutterer's original: [On commit messages](http://who-t.blogspot.co.at/2009/12/on-commit-messages.html)
- Tim Pope's [commit message conventions](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html)