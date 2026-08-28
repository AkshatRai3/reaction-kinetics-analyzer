# Reaction Kinetics Analyzer

A lightweight React + Vite client-side application for undergraduate reaction-kinetics analysis.

## Features

- Manual time/concentration data entry
- CSV upload and sample CSV download
- Zero-, first-, and second-order integrated rate-law testing
- Ordinary least-squares linear regression
- R², RMSE, slope, intercept, and rate constant
- Predicted concentration from the selected kinetic model
- Error-based percentage metric (explicitly not called R² accuracy)
- Accordion/dropdown results
- Experimental vs predicted plot
- Linearized plots for C vs t, ln(C) vs t, and 1/C vs t
- Responsive academic/scientific UI
- No backend or database

## Project structure

reaction-kinetics-analyzer/
- index.html
- package.json
- vite.config.js
- README.md
- sample-data/
  - reaction-kinetics-sample.csv
- src/
  - main.jsx
  - kinetics.js
  - styles.css

## Run locally

Requirements: Node.js 18+ recommended.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`.

## Calculation engine

For each candidate order, the app transforms the concentration data and performs ordinary least-squares regression against time:

- Zero order: y = C; slope = -k
- First order: y = ln(C); slope = -k
- Second order: y = 1/C; slope = k

R² is calculated from residual and total sums of squares in the transformed coordinates.

After selecting the valid model with the highest R², the app reconstructs concentration in the original concentration space:

- Zero order: C_pred = intercept + slope*t
- First order: C_pred = exp(intercept + slope*t)
- Second order: C_pred = 1/(intercept + slope*t)

RMSE is then calculated between observed and predicted concentration values in the original concentration units.

The displayed percentage metric is:

percentage = max(0, min(100, (1 - RMSE / mean(observed concentration)) * 100))

This is deliberately described as an error-based percentage metric rather than claiming that it represents the probability that the selected reaction order is correct.

## Scientific validation

The implementation does not hard-code a reaction-order answer. Every result is computed from the supplied data.

For a classroom validation exercise, create synthetic datasets using:
- C = C0 - kt for zero order
- C = C0 exp(-kt) for first order
- C = 1/(1/C0 + kt) for second order

Then enter the generated data and verify that the corresponding transformed plot has the largest R² and that the recovered k is close to the input k.

## Notes

- Positive concentration is required because first- and second-order transformations use ln(C) and 1/C.
- A duplicate time value is rejected.
- A non-negative concentration is required.
- The app is intended for educational analysis of single-reactant integrated rate-law data. For noisy or mechanistically complex systems, users should not treat the highest R² alone as definitive proof of reaction order.
