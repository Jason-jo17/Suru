# ShuruKar evaluation layer

Turns collected founder answers into a reviewable assessment, and the screen a
reviewer works in.

```
raw answers  →  dossier  →  Laya  →  assessment  →  results screen
 (CSV/JSON)    (compact,    (typed    (bands,       (list + filters
               identity-    answers)  flags)         + drill-down)
               stripped)
```

Stage 3 is the only stage that calls a model, and the only one allowed to be
slow or to fail.

## Running it

```bash
npm install
cp .env.example .env          # DATABASE_URL at minimum
npm run db:push

npm run ingest -- test/candidates.json
npm run score                 # works with or without LAYA_API_KEY
npm run dev                   # http://localhost:3000/candidates
```

With `LAYA_API_KEY` unset the pipeline still runs end to end and every candidate
lands `unscored`. That is the correct, visible state — not a failure.

```bash
npm run acceptance            # the spec's acceptance suite, on a scratch database
npm run typecheck
npm run build
```

### Exercising the scored path locally

`test/stubLaya.ts` is a **test harness**, not a scorer and never a fallback. It
serves the Laya routes so the scored code path, the band arithmetic and the
reviewer screen can be exercised without a key. It says nothing about whether
Laya would return those labels.

```bash
npm run stub:laya
LAYA_API_KEY=test LAYA_BASE_URL=http://localhost:4555 npm run score
LAYA_API_KEY=test LAYA_BASE_URL=http://localhost:4555 npm run acceptance
```

## The constraints this is built from

| | Where it lives |
|---|---|
| Laya reads text only, 512 tokens per question | `src/lib/distil/buildDossier.ts` — 400-token budget, decisive fields first, five protected from truncation |
| Laya generates nothing; every answer is a typed label | `src/lib/assemble/labels.ts` — all meaning is in code; the reviewer-facing explanation is assembled from labels |
| Probabilities are uncalibrated — band and rank, never a percentage | `src/lib/assemble/labels.ts` bands; `src/lib/query.ts` within-band rank. Nothing auto-rejects. |
| Laya is never a hard dependency | `src/lib/laya/client.ts` never throws. Any non-200, timeout or network error → null → `unscored`, still in the human queue. No LLM fallback on 401. |
| Identity never reaches the model | `src/lib/distil/identity.ts` — name, gender, age, caste/community, photographs, institution *brands*. Role and duration stay. |
| The dossier is immutable and versioned | `buildDossier` only ever appends. An unchanged rebuild reuses its row; it never rewrites one. |
| Scores from different question-set versions are never compared | `questionSetVersion` is a content hash of `test/question-sets.json`, recorded on every run and on every assessment. Ranking groups by it. |
| Missing evidence is not bad evidence | `unclear` / `not_asked` / `unverifiable` are excluded from a fit, lower confidence and route to a human. They never cap a band. |

## Stages

**1 — Ingest** (`src/lib/ingest/`). Column headers are not stable: the
Hindi-first form ships Hindi sentences as headers. `fieldMap.ts` maps every
known header to a stable `fieldId` and `assertAllMapped()` throws listing
anything it has not seen, before a single row is written. A silently dropped
column looks exactly like a founder who did not answer.

The SEED Bank record (aspiration, block, registration status, constraint) is
written here, not in the pipeline, so a founder who answered through the router
and stopped still has a complete record.

**2 — Distil** (`src/lib/distil/`). Orders fields by decisiveness per scenario,
strips identity, marks provenance (`VERIFIED <date>:` for a dated external
figure, `CLAIMED:` for the founder's own number), and holds a 400-token budget
by dropping the least decisive fields first. It records what was said; it never
rates, ranks or softens anything.

**3 — Score** (`src/lib/laya/client.ts`). Single and batch (≤64 states per
call), health and whoami. Honours `Retry-After` on 429, backs off on 503 —
expect a few minutes of that after any deployment. Non-English routes to
`convaiinnovations/laya-multilingual`.

**4 — Assemble** (`src/lib/assemble/`). Deterministic arithmetic, no second
model call. Floors rather than averages: below a fit's floor the whole
assessment is capped and the reason named in `cappedBy`. Fit weights differ per
scenario. `constraint_type` is weighted near zero and surfaced prominently
instead — asking for help is not a weakness.

**5 — Results** (`src/app/candidates/`). List and detail. The list and the CSV
export parse the same URL through the same `parseFilters`/`buildCandidateWhere`
in `src/lib/query.ts`, so an export can never disagree with the view it was
taken from. `j`/`k` move between candidates; `a`/`h`/`i` decide; `n` writes a
note. There is no single headline number anywhere.

`reviewerDecision` and `reviewerNote` are the calibration set. Thresholds come
from comparing them against the model's bands — label the 12 fixtures by hand,
run them, and compare. Where Laya disagrees with your reading, the usual cause
is a label that overlaps another or a question asking two things at once:
rewrite it in `test/question-sets.json` and re-run.

## What this deliberately does not do

No auto-reject, no pass/fail, no single score shown to anyone. No LLM fallback
when Laya is down. No editing of a stored dossier. No scoring of
`constraint_type`. No founder-facing view — every label here is worded for an
internal reader.
