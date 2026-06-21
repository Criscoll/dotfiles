---
name: commit-message
description: >-
  Guide writing Git commit messages following the what-and-why-not-how philosophy. Auto-invoke BEFORE writing a commit message, drafting a commit log, or describing changes in a pull request. Trigger phrases: "commit message", "write a commit", "draft a commit", "good commit message", "conventional commit", "commit log", "commit subject", "commit body".
disable-model-invocation: false
---

# Commit Message Style Guide

Write commit messages that communicate **context** — the *why* behind a change,
not the *how*. The code tells you how; only the message can tell you why.

## Core Principle: What and Why, Not How

A well-crafted commit message explains:

| Dimension | Where it lives | Should the commit message cover it? |
|---|---|---|
| **What** changed | Diff + subject line | Subject line only (short summary) |
| **Why** it changed | Commit body | **Yes** — this is the message's job |
| **How** it changed | Source code itself | **No** — trust the code and code comments |

A commit body should answer:

- What was the problem this change solves?
- What was wrong with the old approach?
- Why was this particular solution chosen?
- Are there any side effects, trade-offs, or non-obvious consequences?

## Subject Line

- **Separate from body by a blank line.** Git tools (`log`, `shortlog`, `format-patch`) rely on this. A subject-only message is fine for trivial changes.
- **50 characters or fewer.** 72 is the hard cap.
- **Capitalize the first letter.**
- **No trailing period.**
- **Imperative mood.** It must complete the sentence: *"If applied, this commit will _____"*.

## Body

- **Wrap at 72 characters.** Git never wraps automatically.
- **Explain what and why, not how.** The diff and the source code describe the implementation. Use the body for context that the diff cannot convey.
- **Use bullet points for lists of related points, with blank lines between them.**
- **Reference issue/PR numbers at the bottom** if applicable.

## When a Single Line Is Enough

A subject-only commit is fine when the change is trivially obvious from the diff
itself. For example:

```
Fix typo in user guide introduction
```

Add a body whenever the change needs context: why the old approach didn't work,
what trade-offs were considered, or what ripple effects exist.

## Template

```
{imperative subject line ≤50 chars}

{blank line}

{body — explain what problem this solves and why this approach was chosen.
Wrap at 72 characters. Leave the how to the source code.}

{blank line}

Resolves: #{issue}
```