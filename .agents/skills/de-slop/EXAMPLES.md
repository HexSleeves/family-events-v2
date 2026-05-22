# de-slop — Examples

Good/bad code pairs illustrating each scan category in
[`SKILL.md`](./SKILL.md). The detection heuristics live in `SKILL.md`; this
file shows what each heuristic catches.

---

## Category B — Redundant comments

❌ **Wrong (Python).** Comment restates what the next line obviously does.

```python
# Create user
user = User()

# Save to database
db.save(user)
```

❌ **Wrong (TypeScript).** Same pattern in another language.

```typescript
// Initialize the counter
const counter = 0;

// Return the result
return result;
```

✅ **Right.** Comment carries information the code doesn't — a *why*, an
invariant, or a workaround.

```python
# Cached for retry; underlying API rate-limits at 5 req/s.
user = User.from_cache(user_id)
```

---

## Category C — AI TODO comments

❌ **Wrong.** Vague, non-actionable, generated as filler.

```python
# TODO: Add error handling
# TODO: Consider edge cases
# TODO: Might need optimization
# TODO: Should validate input
```

✅ **Right.** Specific, actionable, anchored to a real follow-up.

```python
# TODO: Handle timezone conversion for EU users (ticket #123)
# TODO: Replace with new API endpoint after v2 launch
```

---

## Category D — Excessive docstrings

❌ **Wrong.** Multi-paragraph docstring on a one-liner that needs none.

```python
def get_name(self) -> str:
    """Get the name property.

    This method returns the name property of the object.
    It retrieves the stored name value and returns it to the caller.
    The name is a string representing the object's name.

    Returns:
        str: The name of the object
    """
    return self.name
```

✅ **Right.** Docstring earns its space by explaining behavior the signature
doesn't reveal.

```python
def parse_date(s: str, tz: str = "UTC") -> datetime:
    """Parse date string with timezone handling.

    Supports ISO 8601 and common formats. Falls back to UTC
    if timezone parsing fails.
    """
```

---

## Attribution

The ❌/✅ paired-block convention is borrowed from
[`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills)
(MIT). See [`../karpathy-principles/ATTRIBUTION.md`](../karpathy-principles/ATTRIBUTION.md).
