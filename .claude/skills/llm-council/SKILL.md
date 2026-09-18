---
name: llm-council
description: >
  Multi-agent PR review guardrail. Runs several specialist reviewers in parallel over a
  diff, then synthesises their findings into one ranked list with the disagreements kept
  visible. Replaces CodeRabbit, which skips this repo because it is public with fewer
  than 10 stars. Use when the user says "council review", "review this PR", "/llm-council",
  before merging anything, or when a branch is about to be pushed for review.
argument-hint: "PR number, branch name, or nothing for the current diff"
user-invocable: true
disable-model-invocation: false
---

# LLM Council Review

A review guardrail for this repo. CodeRabbit posts on every PR but **never actually
reviews** — it skips public repos under 10 stars, so its green check means "skipped",
not "approved". Until that changes, this is the review.

Runs on the Claude Code subscription, so it costs no API spend and has no external
quota to exhaust. That is deliberate: this repo's CI already depends on Gemini free-tier
quota, which has failed repeatedly.

## When to use

- Before merging any PR — especially one with no human reviewer.
- After finishing a branch, before pushing it.
- Any time the diff touches the sensitive areas listed below.

## How it works

Pick the panel from what the diff actually touches. Run them **in parallel, in one
message** — they are independent, and serialising them wastes time.

| Agent | Send it a diff that... |
|---|---|
| `pr-review-toolkit:code-reviewer` | always — baseline correctness and house style |
| `pr-review-toolkit:silent-failure-hunter` | adds try/except, fallbacks, timeouts, or degraded paths |
| `pr-review-toolkit:pr-test-analyzer` | adds logic without tests, or changes test behaviour |
| `pr-review-toolkit:code-simplifier` | is large, repetitive, or grew during review |
| `pr-review-toolkit:comment-analyzer` | adds substantial comments or docstrings |
| `pr-review-toolkit:type-design-analyzer` | introduces or reshapes types |

Three or four is usually right. All six on a two-line change is noise.

### Briefing each agent

Each agent starts cold — it has not seen the conversation and does not know why the
change exists. A terse prompt gets a shallow review. Give it:

1. **Where the code is** — worktree path and the branch to diff against `origin/master`.
2. **Why the change exists** — the bug or requirement behind it.
3. **What you already know is arguable** — name your own doubts and invite attack on
   them. This is where the real value comes from; an agent told "be adversarial about
   X" finds things a generic "review this" never will.
4. **Repo constraints** — tell it to read `CLAUDE.md` when the diff touches anything
   regulatory, PII-related, or legally constrained.
5. **Output shape** — "concrete findings with file:line, most severe first, no preamble."

### Synthesising

Findings are input, not verdicts. You are accountable for what ships, so:

- **Verify before repeating.** An agent's finding is a claim. Check it against the code
  before passing it to the user as fact.
- **Keep disagreement visible.** If two agents conflict, say so and give your read.
  Do not average them into mush.
- **Say what you rejected and why.** A finding you dismissed is information.
- **Rank by consequence** — what breaks in production, not what is untidy.

## This repo's sensitive areas

From `CLAUDE.md`. A diff touching any of these gets the full panel and a careful read:

- **Identity / verification / credentials** — the stateless verify-and-forget model.
  Source documents must never persist or reach a shareable page.
- **Shareable routes** (`/c/`, `/d/share/`) — banded claims and signature only. A raw
  document, name, DOB or figure here is a **critical** finding.
- **Regulatory boundaries** — no counterparty matching, no funds handling, no success
  fees, no insurance sales, no routing by nationality. Each has a licensing regime
  behind it.
- **Anything touching production** — the QA agent runs with `allow_all()` against the
  live site.

## Examples

```
/llm-council              # current uncommitted diff
/llm-council 84           # PR #84
/llm-council fix/my-branch
```

A good briefing, for contrast with "review PR #84":

> Review `fix/location-enrich-latency-budget` at `/Users/venkat/rental-platform-location-timeout`,
> diffed against `origin/master`. It bounds a POI lookup that could hang a user-facing
> endpoint for 18s. Be adversarial about one thing specifically: it converts a timeout
> into an empty-but-successful result and caches that for an hour, so one blip poisons
> a grid square. Is that a silent failure I should not ship? Findings with file:line,
> no preamble.
