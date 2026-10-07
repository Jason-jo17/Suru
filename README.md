# Suru — ShuruKar Founder Evaluation & Triage System

An end-to-end evaluation layer and high-density reviewer workbench built for the ShuruKar startup program.

```
raw answers  →  dossier  →  Laya  →  assessment  →  results screen
 (CSV/JSON)    (compact,    (typed    (bands,       (list + filters
               identity-    answers)  flags)         + drill-down)
               stripped)
```

---

## Architecture & Components

1. **`shurukar-eval/`**: Full Next.js 15 + Prisma + TypeScript evaluation application:
   - **Ingest**: explicit column-header → stable-field map covering the Hindi-first form, which throws on any unmapped column rather than dropping it silently. Writes the SEED Bank record, so a founder who stopped answering still has one.
   - **Distiller**: identity-stripped, provenance-marked dossier inside a 400-token budget, ordered by decisiveness per scenario. Immutable and versioned — a re-score appends, never rewrites.
   - **Laya client**: single and batch (≤64 states), health and whoami, `Retry-After` on 429 and backoff on 503. It never throws: any non-200, timeout or network error marks the assessment `unscored` and leaves the candidate in the human queue. No fallback scorer.
   - **Assembly**: deterministic arithmetic over typed labels — floors rather than averages, per-scenario fit weights, bands plus a within-band rank. Missing evidence routes to a human instead of lowering a band.
   - **Reviewer workbench**: filterable list and per-candidate drill-down showing each question's label, probability distribution and confidence, the dossier exactly as sent, and the raw answers. The CSV export shares the list's filter code, so the two can never disagree.

2. **`filtration_system.py`**:
   - Python prototype implementing Filter 1 (effort qualification) and Filter 2 (Laya AI decision engine).

3. **`ShuruKar_Bihar_Pilot_Timeline_and_Outcomes.xlsx`**:
   - Baseline cohort intake data and pilot timeline outcomes.

---

## Getting Started

```bash
cd shurukar-eval
npm install
cp .env.example .env
npm run db:push

npm run ingest -- test/candidates.json
npm run score          # runs with or without LAYA_API_KEY
npm run dev            # http://localhost:3000/candidates
```

With `LAYA_API_KEY` unset the pipeline still runs end to end and every candidate
lands `unscored` — the correct, visible state rather than a failure.

`npm run acceptance` runs the acceptance suite against a scratch database.

See [`shurukar-eval/README.md`](shurukar-eval/README.md) for the stages, the
constraints each one is built from, and how to exercise the scored path locally.

## Reviewer keyboard shortcuts

- `/` focus search
- `J` / `K` next / previous candidate
- `A` advance · `H` hold · `I` needs info
- `N` jump to the note field
