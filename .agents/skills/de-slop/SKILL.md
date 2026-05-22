---
name: de-slop
description: This skill should be used to remove AI-generated artifacts and unnecessary code before committing. Integrates with desloppify CLI for quantitative scoring and directed fixes. Falls back to LLM-based pattern detection when desloppify is unavailable.
---

# De-Slop Skill

> **Why this skill exists.** This skill enforces *Simplicity First* —
> [karpathy-principles](../karpathy-principles/SKILL.md), principle 2 —
> applied after the fact. AI assistants tend to over-produce filler
> comments, vague TODOs, and excessive docstrings; this skill removes
> the overproduction before it ships.

Remove AI-generated artifacts before committing or creating PRs. Uses `desloppify` for quantitative scoring and directed fixes when available; falls back to LLM-based pattern detection otherwise.

> See [EXAMPLES.md](./EXAMPLES.md) for ❌/✅ code pairs illustrating each
> scan category below.

## When to Use

This skill should be invoked when the user:
- Says "de-slop", "clean up slop", "remove AI artifacts", or "clean before commit"
- Is about to commit changes and mentions cleaning/reviewing code
- Asks to check for unnecessary comments, TODOs, or files
- Wants to prepare code for PR by removing AI-generated artifacts
- Is at end of `/sdlc:implement` and the de-slop gate is triggered

## Primary Workflow (desloppify-powered)

### 0. Check desloppify availability

```bash
uvx desloppify --version
```

If this fails, fall back to the **LLM-based Workflow** below.

### 1. Install/update workflow guide (once per session)

```bash
uvx desloppify update-skill claude
```

Follow the output — it installs the workflow guide into context. Do not augment or override the instructions it provides.

### 2. Scan the target path

Determine the path to scan. Default is `.` unless the user specifies otherwise.

```bash
uvx desloppify scan --path {path}
```

Read the scan output carefully. It contains:
- **Strict score** — quantitative measure of AI artifact density
- **Issue list** — specific findings with file and line references
- **Agent instructions** — follow these verbatim; do not augment or reinterpret

Record the **before score** for the final report.

### 3. Iterative fix loop

Run `next` until there are no more issues:

```bash
uvx desloppify next
```

Each call to `next` tells you:
- Which file to edit
- What issue to fix
- The resolve command to run after fixing

For each issue:
1. Fix it using the Edit tool (show before/after)
2. Run the resolve command given by `next`
3. Call `next` again

Repeat until `next` reports no more issues.

**Safety rules during fix loop:**
- Never touch `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Never auto-delete test files — flag them for manual review instead
- Show before/after for every code edit
- When unsure whether a change is correct, flag it rather than auto-fix

### 4. Final scan

```bash
uvx desloppify scan --path {path}
```

Report **before score → after score**.

---

## Fallback Workflow (LLM-based)

Use this when `uvx desloppify --version` fails.

### 1. Determine Comparison Base

**Ask user** what to compare against (or use sensible default):
- No args: Compare against main/master branch
- Branch name provided: Compare against that branch

```bash
# Get default branch
git remote show origin | grep "HEAD branch" | cut -d ":" -f 2 | xargs

# Get changed files
git diff --name-only {BASE}...HEAD

# Get change summary
git diff --stat {BASE}...HEAD
```

If no remote, fall back to:
```bash
git diff --name-only main...HEAD
# or
git diff --name-only master...HEAD
```

### 2. Scan for Slop Patterns (Dry Run Only)

Scan all changed files for these patterns. **DO NOT modify anything yet.**

#### A. Unnecessary Markdown Files

**Flag for deletion:**
- Filenames matching: `NOTES.md`, `PLAN.md`, `ARCHITECTURE.md`, `THOUGHTS.md`, `IDEAS.md`, `SCRATCH.md`, `TEMP.md`, `TODO.md`
- Case-insensitive match
- Only if they appear in changed files

**Never touch:**
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- Anything in `docs/**` directory
- Any markdown with specific project purpose

#### B. Redundant Comments

Comments that just restate what the next line obviously does.

**Detection:**
- Single-line comment immediately before code
- Comment essentially restates the code
- Adds no context, reasoning, or "why"

See [EXAMPLES.md](./EXAMPLES.md#category-b--redundant-comments) for ❌/✅ pairs.

#### C. AI TODO Comments

Pattern: `# TODO: (Add|Consider|Might|Should|Could|May|Probably)`

Flag the vague, generated-as-filler form. Keep specific, actionable TODOs
that reference a real follow-up (ticket, decision, or external dependency).

See [EXAMPLES.md](./EXAMPLES.md#category-c--ai-todo-comments) for ❌/✅ pairs.

#### D. Excessive Docstrings

Flag docstrings that are excessively long for trivial functions.

**Check for:**
- Function has ≤5 lines of actual code
- Docstring has >3 lines
- Docstring just restates what code obviously does

See [EXAMPLES.md](./EXAMPLES.md#category-d--excessive-docstrings) for ❌/✅ pairs.

#### E. Mock-Heavy Tests

Flag tests with excessive mocking that test nothing real.

**Pattern:**
- Count `@patch` decorators per test function
- Flag if >3 patches
- Note: CLAUDE.md says "no mocking in tests"

#### F. Fake Data in Comments/Docs

Flag suspiciously specific claims without citation:

**Patterns:**
- "according to studies" (no link)
- "research indicates" (no source)
- "X% of users" (no citation)
- Specific performance metrics without benchmark

### 3. Present Findings with Numbered Selection

Display all findings with clear numbering and actions:

```
Scanned X files, found Y slop patterns

[1] NOTES.md (45 lines)
    → DELETE: Unnecessary markdown file

[2] src/user.py:23-28 (6 lines)
    → REMOVE redundant comments

[3] src/api.py:15-25 (11 lines)
    → SIMPLIFY excessive docstring on get_name()

[4] src/utils.py:42
    → REMOVE AI TODO: # TODO: Add error handling

[5] tests/test_user.py:50-70 (test_create_with_mocks)
    → FLAG: Mock-heavy (5 @patch decorators)
    Review manually

---
Select items to clean:
  • Enter numbers: 1 2 4
  • Range: 1-4
  • 'all' - clean items 1-4 (skips flags)
  • 'none' - cancel

Selection: _
```

- Show ±3 lines of context for code issues
- Separate "actions" (delete/remove/simplify) from "flags" (review needed)
- "all" only applies to action items, never flags

### 4. Execute User Selection

Parse user input (numbers, ranges, 'all', 'none').

For file deletions: `git rm {FILE}`

For code cleanup: Use Edit tool to remove redundant comments, simplify docstrings, remove AI TODOs. Show before/after for each edit.

For flagged items: Display file path and line numbers, ask user to review manually.

### 5. Summary Report

```
Cleaned:
  • 2 files deleted
  • 12 redundant comments removed
  • 3 docstrings simplified
  • 8 AI TODOs removed
  • 67 total lines removed

Flagged for manual review:
  • tests/test_user.py:50-70 (mock-heavy, 5 patches)

Next steps:
  1. Review flagged items (if any)
  2. Run tests: bun test
  3. Verify changes: git diff
  4. Commit: /commit
```

---

## Safety Rules

**Always follow these regardless of workflow:**

1. **Never touch:** `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/**`, test files (only flag)
2. **When unsure:** Flag for review, don't auto-fix
3. **Show before/after** for all code changes
4. **Confirm before** deleting >5 files or removing >50 lines total
5. **Preserve formatting:** Keep indentation when removing comments
