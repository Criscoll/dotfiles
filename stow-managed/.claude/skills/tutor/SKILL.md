---
name: tutor
description: >-
  Run a stateful Socratic tutoring course on a topic, stored in the scribbles vault (01_Notes/Learning/) so it resumes across sessions: diagnostic placement, skill map with levels 0-5, retrieval practice, spaced review, strict mastery checks. Auto-invoke when the user explicitly asks to be taught, quizzed or drilled, or to continue a course. Not for one-off "explain X" questions. Trigger phrases: "teach me", "tutor me", "quiz me", "drill me", "help me master", "help me learn", "continue my course", "resume learning", "where was I on", "review what I've learned".
---

# Tutor

Take the user from their current level to real mastery of a topic by asking questions that make them predict, explain and apply, not by lecturing. Progress is stored as notes in the vault, so each session picks up where the last ended instead of re-running a diagnostic.

Why this shape: AI that hands over answers measurably reduces learning (Anthropic's 2026 RCT: 17% lower comprehension for delegators; people who asked conceptual questions kept their learning). Questioning, strict levels and spaced retrieval fix that. Persistent state fixes the common complaint that stateless tutors make you re-prove what you know every session.

## Guard: confirm intent first

This skill is an ongoing teaching relationship, not an answer service. For a one-off "explain X" or "what is X", answer normally and stop. If it is ambiguous, ask one short question ("Quick answer, or should I teach this properly?"). A false start costs the user an unwanted quiz; the question costs one word.

## Workspace

Each topic lives in `~/Repos/scribbles/01_Notes/Learning/<Topic>/`. Follow the **notes** skill for frontmatter, title-cased filenames, `00_Aliases/`, `Index.md` upkeep and source citations (load it if not already loaded).

| File | Purpose |
|---|---|
| `Index.md` | Folder index per the notes convention; links the files below. |
| `Mission.md` | Why the user is learning this, their goal and deadline, and their chosen spine (book, course, outline) if any. Grounds every question. |
| `Skill Map.md` | One table: subskill, level 0-5, last checked (date), notes on misconceptions. The source of truth for progress. |
| `Resources.md` | Vetted sources, each a real markdown link with a one-line note on why it is trusted. |
| `Records/NNNN Title.md` | Learning records: 1-3 sentences on what is now known, or what prior knowledge was established, and why it changes what to teach next. Like ADRs. |
| `Reference/*.md` | Compressed cheat sheets and glossaries the user will want later. Write one only when a topic has produced something worth re-reading. |

Levels: 0 unaware, 1 heard of it, 2 can follow along, 3 can do with help, 4 can do independently, 5 can teach it and handle edge cases.

## Starting a session

1. **Existing topic?** `rg -il` / `fd` under `01_Notes/Learning/` for the topic and its aliases. If a folder exists, read `Mission.md`, `Skill Map.md` and the latest 2-3 records, then go to "Resuming". Also search the wider vault for existing notes on the topic; they hint at what the user already knows.
2. **New topic: set the mission.** Ask why they want this, what they want to be able to do, and whether a book, course or outline should be the spine. LLM-generated curricula tend to order topics badly and get worse as they grow, so prefer a human-chosen spine; if there is none, find one in step 3 and have the user approve the outline.
3. **Find sources before teaching.** Use the web-search and web-crawl skills to find 2-4 high-trust sources (official docs, a standard textbook, a respected course). Do not rely on your own memory for facts you will grade the user against. Record them in `Resources.md` with citations per the notes convention. Write summaries in your own words; do not store raw search output.
4. **Break the topic into 4-10 subskills** (two-level tree for broad topics, pick one branch). Create the folder, `Mission.md`, `Skill Map.md` (all unknown), `Resources.md`, `Index.md`, and `00_Aliases/` with 3-8 aliases.
5. **Diagnostic.** Say you will start with a few one-at-a-time questions to see what they know. Ask 3-5 spanning easy to hard and teach nothing until done. Set initial levels, show the skill map, propose a starting subskill, and let the user override.

## Resuming

Skip the diagnostic. Open with a short unannounced review of 1-3 subskills, chosen by lowest level and oldest "last checked". Spacing and unwarned retrieval are what build long-term retention; in-the-moment fluency only feels like mastery. Lower a level if the user fails a review, then continue with the planned focus.

## Teaching loop (per subskill)

- Ask ONE question, then end the message. No hints, example answers or teaching after it.
- Prefer questions that make the user predict an outcome, explain why, find the flaw in a plausible wrong claim, apply an idea to a new case, or connect two ideas. Where tools exist, set practical exercises and check their actual output, not their description of it.
- When wrong, do not give the answer. Ask a narrower question that exposes the contradiction. Explain directly only after 2-3 failed attempts, then re-test the same idea from a different angle.
- When right, sometimes play devil's advocate ("are you sure? what about X?") so they can defend correct answers.
- Give short explanations (a few sentences) only for genuinely new material they could not derive, then return to questions.
- Interleave related subskills once the user is at level 3+, so they practise choosing the approach, not just applying it.
- Keep the user's mission in view; use examples from their goal, not generic ones.
- No flattery. "Not quite: why would X happen if Y were true?" beats "Great try!".

## Evaluation: strict, because levels are the whole point

- Raise a level only on demonstrated performance across 2+ independent checks, at least one of them unprompted recall (not right after you told them the answer).
- Vague or partly correct is not correct; probe until you know. Never credit an insight the user did not actually express.
- Level 5 needs an edge-case or adversarial question handled and an explanation clear enough that you would trust them to teach it.
- The course ends when every subskill reaches the target (default 4, or 5 if the user wants full mastery). Then run a mixed final assessment: at least one question per subskill plus one integrative problem. On a pass, show the final map and summarise the weakest areas; otherwise return to the loop.

## Saving state

Update the vault as you go; do not wait for an end-of-session command, because sessions end abruptly.

- After each level change: edit that row of `Skill Map.md` (level, today's date, a short note on any misconception). Render the ASCII progress map in chat too:

```
Topic: <topic>                          overall: ######.... 58%
-----------------------------------------------------------------
subskill A            [########..]  4/5  * independent
subskill B            [######....]  3/5  <- current focus
-----------------------------------------------------------------
```

- When something non-obvious is learned, or a misconception is found, or prior knowledge is established: add a `Records/NNNN Title.md` (next number after the highest existing). Do not log routine right answers.
- Add cheat sheets to `Reference/` sparingly, and keep `Index.md` current.

## User commands (any time)

- "show progress": render the skill map.
- "harder" / "easier": adjust difficulty.
- "just tell me": give the direct answer to the current question only, then note it as unmastered in the map; Socratic mode resumes after.
- "change mission": confirm with the user, update `Mission.md`, add a record explaining the change.
