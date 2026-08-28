// Core reaction-kinetics calculations. All regressions are ordinary least squares.
export function linearRegression(x, y) {
  const n = x.length;
  if (n < 2 || n !== y.length) throw new Error("Regression requires paired x and y data.");
  const mx = x.reduce((a,b)=>a+b,0)/n, my = y.reduce((a,b)=>a+b,0)/n;
  let sxx = 0, sxy = 0;
  for (let i=0;i<n;i++) { sxx += (x[i]-mx)**2; sxy += (x[i]-mx)*(y[i]-my); }
  if (sxx === 0) throw new Error("Time values must not all be identical.");
  const slope = sxy/sxx, intercept = my - slope*mx;
  const fitted = x.map(v => intercept + slope*v);
  const ssRes = y.reduce((s,v,i)=>s+(v-fitted[i])**2,0);
  const ssTot = y.reduce((s,v)=>s+(v-my)**2,0);
  const r2 = ssTot === 0 ? (ssRes === 0 ? 1 : 0) : 1 - ssRes/ssTot;
  return { slope, intercept, fitted, r2 };
}

export function calculateRMSE(observed, predicted) {
  return Math.sqrt(observed.reduce((s,v,i)=>s+(v-predicted[i])**2,0)/observed.length);
}

function validate(data) {
  if (!Array.isArray(data) || data.length < 3) throw new Error("Please provide at least 3 valid data points.");
  if (data.some(d => !Number.isFinite(d.time) || !Number.isFinite(d.concentration))) throw new Error("Time and concentration must contain only numerical values.");
  if (data.some(d => d.concentration < 0)) throw new Error("Concentration cannot be negative.");
  const times = data.map(d=>d.time);
  if (new Set(times).size !== times.length) throw new Error("Duplicate time values are not allowed because each time point should be unique.");
  if (times.some(t => !Number.isFinite(t))) throw new Error("Time contains an invalid value.");
  if (data.some(d => d.concentration === 0)) throw new Error("Zero concentration is present. First- and second-order models require C > 0. Remove zero-concentration points or use a dataset with positive concentrations.");
  const sorted = [...data].sort((a,b)=>a.time-b.time);
  if (sorted.some((d,i)=>i>0 && d.time < sorted[i-1].time)) throw new Error("Time values could not be ordered correctly.");
  return sorted;
}

function model(order, data) {
  const t = data.map(d=>d.time), c = data.map(d=>d.concentration);
  let y, xLabel, yLabel, kSign;
  if (order === 0) { y=c; xLabel="Time"; yLabel="C"; kSign=-1; }
  if (order === 1) { y=c.map(Math.log); xLabel="Time"; yLabel="ln(C)"; kSign=-1; }
  if (order === 2) { y=c.map(v=>1/v); xLabel="Time"; yLabel="1/C"; kSign=1; }
  const reg = linearRegression(t,y);
  const k = kSign * reg.slope;
  // For a consumption reaction, a physically meaningful k should be non-negative.
  // A negative k indicates that the selected integrated model predicts increasing C.
  const valid = Number.isFinite(k) && k >= 0;
  const predictedC = t.map(time => {
    const z = reg.intercept + reg.slope*time;
    if (order === 0) return z;
    if (order === 1) return Math.exp(z);
    return z > 0 ? 1/z : NaN;
  });
  const rmse = calculateRMSE(c, predictedC);
  const linearData = t.map((time,i)=>({x:time,y:y[i],fit:reg.fitted[i]}));
  return {
    order, label: `${order === 0 ? "Zero" : order === 1 ? "First" : "Second"} Order`,
    r2: reg.r2, slope: reg.slope, intercept: reg.intercept, k, valid,
    rmse, predictedC, linearData, xLabel, yLabel,
    predictionData: t.map((time,i)=>({time, concentration:c[i], predicted:predictedC[i]}))
  };
}

export function analyzeKinetics(rawData) {
  const data = validate(rawData);
  const models = [model(0,data), model(1,data), model(2,data)];
  const valid = models.filter(m => m.valid && Number.isFinite(m.r2) && m.predictedC.every(Number.isFinite));
  if (!valid.length) throw new Error("None of the candidate models produced a physically meaningful fit. Check whether concentration decreases with time and whether the data are valid.");
  valid.sort((a,b)=>b.r2-a.r2);
  const best = valid[0];
  const uncertain = valid.length > 1 && Math.abs(best.r2 - valid[1].r2) < 0.01;
  const meanC = data.reduce((s,d)=>s+d.concentration,0)/data.length;
  const rel = best.rmse/meanC;
  let fitLabel = best.r2 >= 0.99 ? "Excellent fit" : best.r2 >= 0.95 ? "Very good fit" : best.r2 >= 0.90 ? "Good fit" : "Moderate/weak fit";
  return { models, best, uncertain, meanC, rel, fitLabel };
}

export function accuracyPercent(result) {
  const mean = result.predictionData.reduce((s,d)=>s+d.concentration,0)/result.predictionData.length;
  return Math.max(0, Math.min(100, (1 - result.rmse/mean)*100)).toFixed(2);
}

export function formatK(k) {
  if (!Number.isFinite(k)) return "—";
  if (Math.abs(k) >= 0.001 && Math.abs(k) < 1000) return k.toFixed(5).replace(/0+$/,"").replace(/\.$/,"");
  return k.toExponential(4);
}

export function unitForK(order, cUnit, tUnit) {
  const t = tUnit === "s" ? "s" : tUnit === "h" ? "h" : "min";
  if (order === 0) return `${cUnit}/${t}`;
  if (order === 1) return `${t}⁻¹`;
  const c = cUnit === "mol/L" ? "L/mol" : cUnit === "mol/m³" ? "m³/mol" : `1/(${cUnit})`;
  return `${c}·${t}⁻¹`;
}
