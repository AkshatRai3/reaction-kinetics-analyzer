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

## Scientific note
The analyzer uses the units selected by the user for display. The supplied data are assumed to be internally consistent with those units. The numerical differentiation method uses forward/backward differences at endpoints and central differences at interior points, as specified in the project brief.
