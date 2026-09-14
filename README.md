# Reaction Kinetics Analyzer

A client-side React + Vite + TypeScript scientific calculator for time–concentration reaction kinetics.

## Run

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Included
- Integral method: zero, first and second order linearizations with regression and R² comparison.
- Differential method: numerical endpoint/central differences and ln(rate) vs ln(concentration) regression.
- Manual editable table and CSV drag/drop upload.
- Unit selectors, validation, sample CSV download, responsive UI and persistent light/dark mode.
- Recharts visualizations and a short dynamically selected calculation explanation.

## Sample mechanism CSVs

Multi-species uploads use a `Time` column followed by one column per species. The
first species column is used for apparent-order fitting; all species columns are
used for mechanism screening.

- [Reversible A ⇌ B](sample-data/reversible-A-to-B.csv)
- [Series A → I → P](sample-data/series-A-to-I-to-P.csv)
- [Parallel A → B and C](sample-data/parallel-A-to-B-and-C.csv)
- [Autocatalytic A + B](sample-data/autocatalytic-A-plus-B.csv)

## Scientific note
The analyzer uses the units selected by the user for display. The supplied data are assumed to be internally consistent with those units. The numerical differentiation method uses forward/backward differences at endpoints and central differences at interior points, as specified in the project brief.
