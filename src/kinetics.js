// src/kinetics.js

/**
 * Reaction Kinetics Analysis Engine
 *
 * Supports:
 *  - Zero-order
 *  - First-order
 *  - Second-order
 *  - Third-order
 *  - Arbitrary fractional n-th order
 *
 * General rate law:
 *
 *      -dC/dt = k C^n
 *
 * For n !== 1:
 *
 *      C(t) = [ C0^(1-n) + (n-1)kt ]^(1/(1-n))
 *
 * For n = 1:
 *
 *      C(t) = C0 exp(-kt)
 *
 * The engine provides:
 *  - Linear regression
 *  - R²
 *  - RMSE
 *  - MAE
 *  - Percentage prediction accuracy
 *  - Classical integer-order analysis
 *  - Fractional n-th order fitting
 */

// ---------------------------------------------------------
// Utility functions
// ---------------------------------------------------------

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateR2(actual, predicted) {
  if (
    !actual.length ||
    actual.length !== predicted.length ||
    actual.length < 2
  ) {
    return NaN;
  }

  const actualMean = mean(actual);

  const ssTot = actual.reduce(
    (sum, value) => sum + Math.pow(value - actualMean, 2),
    0
  );

  const ssRes = actual.reduce(
    (sum, value, i) => sum + Math.pow(value - predicted[i], 2),
    0
  );

  if (ssTot === 0) return ssRes === 0 ? 1 : 0;

  return 1 - ssRes / ssTot;
}

export function calculateRMSE(actual, predicted) {
  if (
    !actual.length ||
    actual.length !== predicted.length
  ) {
    return NaN;
  }

  const mse =
    actual.reduce(
      (sum, value, i) =>
        sum + Math.pow(value - predicted[i], 2),
      0
    ) / actual.length;

  return Math.sqrt(mse);
}

export function calculateMAE(actual, predicted) {
  if (
    !actual.length ||
    actual.length !== predicted.length
  ) {
    return NaN;
  }

  return (
    actual.reduce(
      (sum, value, i) =>
        sum + Math.abs(value - predicted[i]),
      0
    ) / actual.length
  );
}

export function formatK(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const abs = Math.abs(value);
  if (abs >= 1000 || abs < 0.01) {
    return value.toExponential(3);
  }

  return Number(value).toFixed(4).replace(/\.0+$|(?<=\.\d)0+$/g, "");
}

export function unitForK(order, concentrationUnit = "mol/L", timeUnit = "min") {
  if (Math.abs(order - 1) < 1e-8) {
    return `${timeUnit}⁻¹`;
  }

  if (Math.abs(order) < 1e-8) {
    return `${concentrationUnit}·${timeUnit}⁻¹`;
  }

  const exponent = 1 - order;

  if (Math.abs(exponent - 1) < 1e-8) {
    return `${concentrationUnit}·${timeUnit}⁻¹`;
  }

  return `${concentrationUnit}^(${Number(exponent).toFixed(2).replace(/\.00$/, "")})·${timeUnit}⁻¹`;
}

export function accuracyPercent(model) {
  if (!model || !Number.isFinite(model.accuracy)) {
    return 0;
  }

  return Math.max(0, Math.min(100, model.accuracy));
}

/**
 * Percentage prediction accuracy.
 *
 * This is based on normalized RMSE:
 *
 * Accuracy (%) = max(0, 100 * (1 - RMSE / mean(|C|)))
 *
 * This should NOT be confused with R².
 */
export function calculateAccuracy(actual, predicted) {
  if (!actual.length) return NaN;

  const rmse = calculateRMSE(actual, predicted);
  const meanAbsoluteConcentration =
    mean(actual.map((value) => Math.abs(value)));

  if (meanAbsoluteConcentration === 0) return NaN;

  return Math.max(
    0,
    100 * (1 - rmse / meanAbsoluteConcentration)
  );
}

// ---------------------------------------------------------
// Linear regression
// ---------------------------------------------------------

/**
 * Ordinary least-squares linear regression.
 *
 * Fits:
 *
 *      y = slope * x + intercept
 */
export function linearRegression(x, y) {
  if (
    !Array.isArray(x) ||
    !Array.isArray(y) ||
    x.length !== y.length ||
    x.length < 2
  ) {
    throw new Error(
      "At least two matching x-y data points are required."
    );
  }

  const n = x.length;

  const xMean = mean(x);
  const yMean = mean(y);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator +=
      (x[i] - xMean) *
      (y[i] - yMean);

    denominator +=
      Math.pow(x[i] - xMean, 2);
  }

  if (denominator === 0) {
    throw new Error(
      "Regression cannot be performed because all time values are identical."
    );
  }

  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;

  const predicted = x.map(
    (value) => slope * value + intercept
  );

  const r2 = calculateR2(y, predicted);

  return {
    slope,
    intercept,
    r2,
    predicted,
  };
}

// ---------------------------------------------------------
// Data validation
// ---------------------------------------------------------

export function validateData(data) {
  if (!Array.isArray(data)) {
    throw new Error("Invalid data format.");
  }

  if (data.length < 3) {
    throw new Error(
      "At least 3 valid data points are required."
    );
  }

  const cleaned = [];

  for (let i = 0; i < data.length; i++) {
    const t = Number(data[i].time);
    const c = Number(data[i].concentration);

    if (!Number.isFinite(t)) {
      throw new Error(
        `Invalid time value at row ${i + 1}.`
      );
    }

    if (!Number.isFinite(c)) {
      throw new Error(
        `Invalid concentration value at row ${i + 1}.`
      );
    }

    if (c < 0) {
      throw new Error(
        `Concentration cannot be negative at row ${i + 1}.`
      );
    }

    cleaned.push({
      time: t,
      concentration: c,
    });
  }

  // Check duplicate time values
  const times = cleaned.map((row) => row.time);

  const uniqueTimes = new Set(times);

  if (uniqueTimes.size !== times.length) {
    throw new Error(
      "Duplicate time values were found. Each time value must be unique."
    );
  }

  return cleaned;
}

// ---------------------------------------------------------
// Prediction equations
// ---------------------------------------------------------

/**
 * Predict concentration for arbitrary reaction order n.
 *
 * Rate law:
 *
 *      -dC/dt = k C^n
 */
export function predictConcentration(C0, t, k, order) {
  if (
    !Number.isFinite(C0) ||
    !Number.isFinite(t) ||
    !Number.isFinite(k) ||
    !Number.isFinite(order)
  ) {
    return NaN;
  }

  if (C0 <= 0) return NaN;

  // First-order special case
  if (Math.abs(order - 1) < 1e-8) {
    return C0 * Math.exp(-k * t);
  }

  const exponent = 1 - order;

  const value =
    Math.pow(C0, exponent) +
    (order - 1) * k * t;

  // Physical solution does not exist beyond this point
  if (value <= 0) {
    return NaN;
  }

  return Math.pow(value, 1 / exponent);
}

/**
 * Generate predictions for a dataset.
 */
export function predictDataset(data, C0, k, order) {
  return data.map((point) =>
    predictConcentration(
      C0,
      point.time,
      k,
      order
    )
  );
}

// ---------------------------------------------------------
// Classical integrated rate-law models
// ---------------------------------------------------------

/**
 * Zero-order:
 *
 *      C = C0 - kt
 *
 * Linear form:
 *
 *      C vs t
 */
export function calculateZeroOrder(data) {
  const validated = validateData(data);

  const time = validated.map((p) => p.time);
  const concentration = validated.map(
    (p) => p.concentration
  );

  const regression = linearRegression(
    time,
    concentration
  );

  const k = -regression.slope;

  const C0 = concentration[0];

  const predicted = predictDataset(
    validated,
    C0,
    k,
    0
  );

  return {
    order: 0,
    label: "Zero Order",
    transformation: "C vs t",
    x: time,
    y: concentration,
    transformedY: concentration,
    slope: regression.slope,
    intercept: regression.intercept,
    k,
    r2: regression.r2,
    predicted,
    rmse: calculateRMSE(
      concentration,
      predicted
    ),
    mae: calculateMAE(
      concentration,
      predicted
    ),
    accuracy: calculateAccuracy(
      concentration,
      predicted
    ),
  };
}

/**
 * First-order:
 *
 *      ln(C) = ln(C0) - kt
 */
export function calculateFirstOrder(data) {
  const validated = validateData(data);

  if (
    validated.some(
      (p) => p.concentration <= 0
    )
  ) {
    return {
      order: 1,
      label: "First Order",
      valid: false,
      error:
        "First-order analysis requires all concentration values to be greater than zero.",
    };
  }

  const time = validated.map((p) => p.time);

  const transformed = validated.map(
    (p) => Math.log(p.concentration)
  );

  const regression = linearRegression(
    time,
    transformed
  );

  const k = -regression.slope;

  const C0 = validated[0].concentration;

  const predicted = predictDataset(
    validated,
    C0,
    k,
    1
  );

  const concentration =
    validated.map(
      (p) => p.concentration
    );

  return {
    order: 1,
    label: "First Order",
    transformation: "ln(C) vs t",
    x: time,
    y: concentration,
    transformedY: transformed,
    slope: regression.slope,
    intercept: regression.intercept,
    k,
    r2: regression.r2,
    predicted,
    rmse: calculateRMSE(
      concentration,
      predicted
    ),
    mae: calculateMAE(
      concentration,
      predicted
    ),
    accuracy: calculateAccuracy(
      concentration,
      predicted
    ),
    valid: true,
  };
}

/**
 * Second-order:
 *
 *      1/C = 1/C0 + kt
 */
export function calculateSecondOrder(data) {
  const validated = validateData(data);

  if (
    validated.some(
      (p) => p.concentration <= 0
    )
  ) {
    return {
      order: 2,
      label: "Second Order",
      valid: false,
      error:
        "Second-order analysis requires all concentration values to be greater than zero.",
    };
  }

  const time = validated.map((p) => p.time);

  const transformed = validated.map(
    (p) => 1 / p.concentration
  );

  const regression = linearRegression(
    time,
    transformed
  );

  const k = regression.slope;

  const C0 = validated[0].concentration;

  const predicted = predictDataset(
    validated,
    C0,
    k,
    2
  );

  const concentration =
    validated.map(
      (p) => p.concentration
    );

  return {
    order: 2,
    label: "Second Order",
    transformation: "1/C vs t",
    x: time,
    y: concentration,
    transformedY: transformed,
    slope: regression.slope,
    intercept: regression.intercept,
    k,
    r2: regression.r2,
    predicted,
    rmse: calculateRMSE(
      concentration,
      predicted
    ),
    mae: calculateMAE(
      concentration,
      predicted
    ),
    accuracy: calculateAccuracy(
      concentration,
      predicted
    ),
    valid: true,
  };
}

/**
 * Third-order:
 *
 *      1/C² = 1/C0² + 2kt
 */
export function calculateThirdOrder(data) {
  const validated = validateData(data);

  if (
    validated.some(
      (p) => p.concentration <= 0
    )
  ) {
    return {
      order: 3,
      label: "Third Order",
      valid: false,
      error:
        "Third-order analysis requires all concentration values to be greater than zero.",
    };
  }

  const time = validated.map((p) => p.time);

  const transformed = validated.map(
    (p) =>
      1 /
      Math.pow(p.concentration, 2)
  );

  const regression = linearRegression(
    time,
    transformed
  );

  // slope = 2k
  const k = regression.slope / 2;

  const C0 = validated[0].concentration;

  const predicted = predictDataset(
    validated,
    C0,
    k,
    3
  );

  const concentration =
    validated.map(
      (p) => p.concentration
    );

  return {
    order: 3,
    label: "Third Order",
    transformation: "1/C² vs t",
    x: time,
    y: concentration,
    transformedY: transformed,
    slope: regression.slope,
    intercept: regression.intercept,
    k,
    r2: regression.r2,
    predicted,
    rmse: calculateRMSE(
      concentration,
      predicted
    ),
    mae: calculateMAE(
      concentration,
      predicted
    ),
    accuracy: calculateAccuracy(
      concentration,
      predicted
    ),
    valid: true,
  };
}

// ---------------------------------------------------------
// General n-th order linearized analysis
// ---------------------------------------------------------

/**
 * Calculate the linearized model for arbitrary n.
 *
 * For n !== 1:
 *
 *      C^(1-n) = C0^(1-n) + (n-1)kt
 *
 * Therefore:
 *
 *      y = C^(1-n)
 *
 * and:
 *
 *      k = slope / (n-1)
 */
export function calculateNthOrderLinearized(
  data,
  order
) {
  const validated = validateData(data);

  if (!Number.isFinite(order)) {
    throw new Error(
      "Reaction order must be a valid number."
    );
  }

  if (Math.abs(order - 1) < 1e-8) {
    return calculateFirstOrder(
      validated
    );
  }

  if (
    validated.some(
      (p) => p.concentration <= 0
    )
  ) {
    return {
      order,
      label: `${order}-th Order`,
      valid: false,
      error:
        "Concentration must be greater than zero for this transformation.",
    };
  }

  const time = validated.map(
    (p) => p.time
  );

  const transformed = validated.map(
    (p) =>
      Math.pow(
        p.concentration,
        1 - order
      )
  );

  const regression = linearRegression(
    time,
    transformed
  );

  const k =
    regression.slope /
    (order - 1);

  const C0 =
    validated[0].concentration;

  const predicted = predictDataset(
    validated,
    C0,
    k,
    order
  );

  const concentration =
    validated.map(
      (p) => p.concentration
    );

  const validPredictions =
    predicted.every(
      (value) => Number.isFinite(value)
    );

  if (!validPredictions) {
    return {
      order,
      label: `${order}-th Order`,
      valid: false,
      error:
        "The fitted kinetic model predicts a non-physical concentration for part of the time range.",
    };
  }

  return {
    order,
    label: `${order}-th Order`,
    transformation:
      `C^(1-${order}) vs t`,
    x: time,
    y: concentration,
    transformedY: transformed,
    slope: regression.slope,
    intercept: regression.intercept,
    k,
    r2: regression.r2,
    predicted,
    rmse: calculateRMSE(
      concentration,
      predicted
    ),
    mae: calculateMAE(
      concentration,
      predicted
    ),
    accuracy: calculateAccuracy(
      concentration,
      predicted
    ),
    valid: true,
  };
}

// ---------------------------------------------------------
// Fractional order search
// ---------------------------------------------------------

/**
 * Search over a range of reaction orders.
 *
 * Example:
 *
 *      minOrder = 0
 *      maxOrder = 5
 *      step = 0.01
 *
 * This tests:
 *
 *      0.00
 *      0.01
 *      0.02
 *      ...
 *      5.00
 *
 * The best model is selected using
 * the highest R².
 */
export function searchFractionalOrder(
  data,
  minOrder = 0,
  maxOrder = 5,
  step = 0.01
) {
  const validated = validateData(data);

  if (
    !Number.isFinite(minOrder) ||
    !Number.isFinite(maxOrder) ||
    !Number.isFinite(step)
  ) {
    throw new Error(
      "Invalid reaction-order search parameters."
    );
  }

  if (step <= 0) {
    throw new Error(
      "Order search step must be greater than zero."
    );
  }

  if (minOrder > maxOrder) {
    throw new Error(
      "Minimum order cannot be greater than maximum order."
    );
  }

  const results = [];

  for (
    let order = minOrder;
    order <= maxOrder + step / 2;
    order += step
  ) {
    // Avoid floating-point values such as 1.00000000001
    const n = Number(
      order.toFixed(10)
    );

    try {
      const result =
        calculateNthOrderLinearized(
          validated,
          n
        );

      if (
        result.valid &&
        Number.isFinite(result.r2) &&
        Number.isFinite(result.k)
      ) {
        results.push(result);
      }
    } catch {
      // Ignore invalid candidate orders
    }
  }

  if (!results.length) {
    throw new Error(
      "No valid reaction-order model could be fitted to the supplied data."
    );
  }

  // Sort by highest R²
  results.sort(
    (a, b) => b.r2 - a.r2
  );

  const best = results[0];

  return {
    best,
    results,
    minOrder,
    maxOrder,
    step,
  };
}

// ---------------------------------------------------------
// Complete analysis
// ---------------------------------------------------------

/**
 * Perform complete reaction kinetics analysis.
 *
 * By default:
 *
 *      n = 0 to 5
 *      step = 0.01
 *
 * This means fractional reaction orders are supported.
 */
export function analyzeKinetics(
  data,
  options = {}
) {
  const validated = validateData(data);

  const {
    minOrder = 0,
    maxOrder = 5,
    step = 0.01,
    useFractionalSearch = true,
  } = options;

  // Classical models
  const zeroOrder =
    calculateZeroOrder(validated);

  const firstOrder =
    calculateFirstOrder(validated);

  const secondOrder =
    calculateSecondOrder(validated);

  const thirdOrder =
    calculateThirdOrder(validated);

  let fractionalSearch = null;

  if (useFractionalSearch) {
    fractionalSearch =
      searchFractionalOrder(
        validated,
        minOrder,
        maxOrder,
        step
      );
  }

  /*
   * Select the best model based on
   * highest R².
   *
   * The fractional search includes
   * integer orders too, so it is capable
   * of finding 0, 1, 2, 3, etc.
   */
  const candidates =
    fractionalSearch
      ? fractionalSearch.results
      : [
          zeroOrder,
          firstOrder,
          secondOrder,
          thirdOrder,
        ].filter(
          (result) => result.valid !== false
        );

  const validCandidates =
    candidates.filter(
      (result) =>
        Number.isFinite(result.r2)
    );

  validCandidates.sort(
    (a, b) => b.r2 - a.r2
  );

  const best =
    validCandidates[0];

  // Check uncertainty
  let uncertaintyWarning = null;

  if (validCandidates.length >= 2) {
    const difference =
      validCandidates[0].r2 -
      validCandidates[1].r2;

    if (difference < 0.001) {
      uncertaintyWarning =
        "The best-fitting and second-best models have very similar R² values. The estimated reaction order may therefore be uncertain.";
    }
  }

  const modelList = [
    zeroOrder,
    firstOrder,
    secondOrder,
    thirdOrder,
  ].filter((result) => result && result.valid !== false);

  if (fractionalSearch?.results) {
    for (const candidate of fractionalSearch.results) {
      if (!modelList.some((m) => m.order === candidate.order && m.label === candidate.label)) {
        modelList.push(candidate);
      }
    }
  }

  modelList.sort((a, b) => a.order - b.order);

  const models = modelList.map((model) => {
    const predictionData = validated.map((point, index) => ({
      time: point.time,
      concentration: point.concentration,
      predicted: model.predicted[index],
    }));

    const linearData = model.x.map((value, index) => ({
      x: value,
      y: model.transformedY[index],
      fit: model.slope * value + model.intercept,
    }));

    return {
      ...model,
      valid: model.valid !== false,
      fitLabel: model.label,
      predictionData,
      linearData,
      xLabel: "Time",
      yLabel: model.transformation || "Transformed value",
      uncertain: Boolean(uncertaintyWarning),
    };
  });

  const bestModel = models.find((model) => model.order === best.order && model.label === best.label) || best;
  bestModel.fitLabel = bestModel.label;
  bestModel.predictionData = validated.map((point, index) => ({
    time: point.time,
    concentration: point.concentration,
    predicted: bestModel.predicted[index],
  }));
  bestModel.linearData = bestModel.x.map((value, index) => ({
    x: value,
    y: bestModel.transformedY[index],
    fit: bestModel.slope * value + bestModel.intercept,
  }));
  bestModel.uncertain = Boolean(uncertaintyWarning);

  return {
    data: validated,
    best: bestModel,
    models,
    uncertain: Boolean(uncertaintyWarning),
    fractionalSearch,
    uncertaintyWarning,
    testedRange: {
      minOrder,
      maxOrder,
      step,
    },
  };
}

// ---------------------------------------------------------
// Graph data
// ---------------------------------------------------------

/**
 * Generate data for experimental vs predicted
 * concentration plot.
 */
export function getConcentrationPlotData(
  data,
  result
) {
  return data.map((point, index) => ({
    time: point.time,
    experimental:
      point.concentration,
    predicted:
      result.predicted[index],
  }));
}

/**
 * Generate data for a linearized plot.
 *
 * Examples:
 *
 *      n = 0  → C
 *      n = 1  → ln(C)
 *      n = 2  → 1/C
 *      n = 3  → 1/C²
 *      n = 1.5 → C^-0.5
 */
export function getLinearizedPlotData(
  data,
  order,
  result
) {
  return data.map(
    (point, index) => {
      let transformed;

      if (
        Math.abs(order - 1) < 1e-8
      ) {
        transformed =
          Math.log(
            point.concentration
          );
      } else {
        transformed =
          Math.pow(
            point.concentration,
            1 - order
          );
      }

      const regressionY =
        result.slope *
          point.time +
        result.intercept;

      return {
        time: point.time,
        transformed,
        regression: regressionY,
      };
    }
  );
}

// ---------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------

export function formatNumber(
  value,
  decimals = 5
) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return Number(value).toFixed(
    decimals
  );
}

/**
 * Generate a human-readable equation
 * for the selected reaction order.
 */
export function getIntegratedRateLaw(
  order
) {
  if (Math.abs(order) < 1e-8) {
    return "C = C₀ − kt";
  }

  if (
    Math.abs(order - 1) < 1e-8
  ) {
    return "ln(C) = ln(C₀) − kt";
  }

  if (
    Math.abs(order - 2) < 1e-8
  ) {
    return "1/C = 1/C₀ + kt";
  }

  if (
    Math.abs(order - 3) < 1e-8
  ) {
    return "1/C² = 1/C₀² + 2kt";
  }

  return `C^(1−n) = C₀^(1−n) + (n−1)kt`;
}

/**
 * Return appropriate units for k.
 *
 * If concentration is expressed as:
 *
 *      mol/L
 *
 * and time as:
 *
 *      min
 *
 * then:
 *
 *      [k] = (concentration)^(1-n) / time
 */
export function getRateConstantUnits(
  order,
  concentrationUnit = "mol/L",
  timeUnit = "min"
) {
  if (Math.abs(order - 1) < 1e-8) {
    return `${timeUnit}⁻¹`;
  }

  if (Math.abs(order) < 1e-8) {
    return `${concentrationUnit}·${timeUnit}⁻¹`;
  }

  const exponent = 1 - order;

  if (Math.abs(exponent - 1) < 1e-8) {
    return `${concentrationUnit}·${timeUnit}⁻¹`;
  }

  return `${concentrationUnit}^(${formatNumber(
    exponent,
    2
  )})·${timeUnit}⁻¹`;
}