# RÉIA — Profitability Ledger

Internal finance dashboard for RÉIA's two stores (RS Puram Flagship, Réia Aisle).
Tracks gross/net profit, GST, store overheads, daily expenses, and a merchandise
report (best-selling categories, gold colors, per-store performance).

## 1. Install dependencies

```bash
npm install
```

## 2. Set up Supabase

1. Create a free project at https://supabase.com
2. Go to Project > SQL Editor > New Query, paste the contents of
   `supabase/schema.sql`, and run it. This creates the `sales`, `overheads`,
   and `expenses` tables.
3. Go to Project > Settings > API and copy your **Project URL** and
   **anon public key**.

## 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and paste in your Supabase URL and anon key.
`.env.local` is already git-ignored — never commit it.

## 4. Run locally

```bash
npm run dev
```

Open the printed localhost URL. Try adding one sale and one overhead entry
to confirm data is saving to Supabase (check the Table Editor in your
Supabase project to see the rows land there).

## 5. Deploy to Vercel

- Push this project to a GitHub repo
- In Vercel: New Project > import the repo
- In Vercel's project Settings > Environment Variables, add:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  (same values as your `.env.local`)
- Deploy. Vercel will auto-redeploy on every future push to the repo.

## Notes on the numbers

- **Gold** is treated as pass-through at cost — no margin is attributed to
  gold price movement, since your buy/sell gold rates float with the market.
- **Margin** comes from two levers only:
  - Making/wastage: (rate charged − ₹1,000/g cost) × gold weight
  - Diamond: (₹35,000 − ₹10,000) × diamond carat weight
- **GST (3%)** is calculated on top of the sale price and shown per-sale and
  in monthly totals, but excluded from revenue/profit — it's a pass-through
  tax, not income.
- Flags on the Insights tab are recalculated automatically from whatever data
  exists — no manual configuration needed.

## Project structure

```
├── index.html
├── package.json
├── vite.config.js
├── .env.local.example
├── supabase/
│   └── schema.sql          ← run this in Supabase SQL Editor
└── src/
    ├── main.jsx             ← React entry point
    ├── App.jsx               ← the dashboard itself
    ├── supabaseClient.js     ← Supabase client setup
    └── useSupaTable.js       ← generic Supabase-backed data hook
```
