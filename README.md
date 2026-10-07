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
   - **Deterministic Dossier Distiller**: Truncates and formats intake responses into strict token budgets (≤400 tokens per candidate) with decisive question ordering.
   - **Laya Decision Client**: Evaluates candidate dossiers using calibrated checkpoints (`convaiinnovations/laya-multilingual` for non-English), with built-in retry-after backoff and market contradiction routing.
   - **Tri-Fit Assessment Engine**: Computes Founder-Problem (FP), Problem-Solution (PS), and Solution-Market (SM) scores, assigns evaluation bands (`strong`, `promising`, `early`, `unscored`), and flags anomalies.
   - **Institutional Reviewer Workbench**: Spreadsheet-grade interface with real-time cohort statistics ribbon, formula-style search filters, high-density data grid, and keyboard-driven decision shortcuts (`A` Advance, `H` Hold, `I` Needs Info, `J`/`K` navigation).
   - **Export API**: Streams filtered candidate evaluation cohorts directly to CSV.

2. **`filtration_system.py`**:
   - Python prototype implementing Filter 1 (effort qualification) and Filter 2 (Laya AI decision engine).

3. **`ShuruKar_Bihar_Pilot_Timeline_and_Outcomes.xlsx`**:
   - Baseline cohort intake data and pilot timeline outcomes.

---

## Getting Started

### 1. Setup & Ingest Pipeline
```bash
cd shurukar-eval
npm install

# Run database migrations
npx prisma db push

# Ingest test cohort and execute evaluation pipeline
npx ts-node scripts/ingest.ts
npx ts-node scripts/runPipeline.ts
```

### 2. Run the Reviewer Workbench
```bash
npm run dev
```
Open [http://localhost:3000/candidates](http://localhost:3000/candidates) to access the evaluation workbench.

---

## Reviewer Keyboard Shortcuts
- `/` : Focus search bar
- `J` : Navigate to Next candidate
- `K` : Navigate to Previous candidate
- `A` : Mark candidate as **Advance**
- `H` : Mark candidate as **Hold**
- `I` / `N` : Mark candidate as **Needs Info**
