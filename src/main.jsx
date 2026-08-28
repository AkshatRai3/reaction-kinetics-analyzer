import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Upload, Download, Plus, Trash2, Play, RotateCcw, ChevronDown, FlaskConical, AlertCircle, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { analyzeKinetics, formatK, unitForK, accuracyPercent } from "./kinetics";
import "./styles.css";

const sampleRows = [
  { time: 0, concentration: 1.0 },
  { time: 10, concentration: 0.82 },
  { time: 20, concentration: 0.68 },
  { time: 30, concentration: 0.55 },
  { time: 40, concentration: 0.45 },
];

function Accordion({ title, open, onToggle, children }) {
  return (
    <section className="accordion">
      <button className="accordion-head" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown className={open ? "chevron open" : "chevron"} size={19} />
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </section>
  );
}

function App() {
  const [rows, setRows] = useState(sampleRows);
  const [timeUnit, setTimeUnit] = useState("min");
  const [concUnit, setConcUnit] = useState("mol/L");
  const [customConc, setCustomConc] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({ order: true, k: true, accuracy: true, compare: true, graph: true, how: false });
  const [csvName, setCsvName] = useState("");

  const concentrationUnit = concUnit === "custom" ? (customConc.trim() || "concentration unit") : concUnit;

  function updateRow(i, key, value) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: value } : row));
    setResult(null); setError("");
  }
  function addRow() {
    const last = rows[rows.length - 1];
    setRows([...rows, { time: Number(last?.time || 0) + 10, concentration: Number(last?.concentration || 1) }]);
  }
  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i));
    setResult(null); setError("");
  }
  function reset() {
    setRows(sampleRows); setResult(null); setError(""); setCsvName("");
  }
  function loadSample() { setRows(sampleRows); setResult(null); setError(""); setCsvName("sample.csv"); }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("The CSV must contain a header and at least one data row.");
    const first = lines[0].split(",").map(s => s.trim().toLowerCase());
    const ti = first.indexOf("time"), ci = first.indexOf("concentration");
    if (ti < 0 || ci < 0) throw new Error('CSV must contain columns named "time" and "concentration".');
    const parsed = lines.slice(1).map((line, idx) => {
      const p = line.split(",");
      const t = Number(p[ti]?.trim()), c = Number(p[ci]?.trim());
      if (!Number.isFinite(t) || !Number.isFinite(c)) throw new Error(`Invalid numeric value on CSV row ${idx + 2}.`);
      return { time: t, concentration: c };
    });
    if (!parsed.length) throw new Error("No data rows were found.");
    return parsed;
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setRows(parseCSV(String(reader.result)));
        setCsvName(file.name); setResult(null); setError("");
      } catch (err) { setError(err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function downloadCSV() {
    const csv = "time,concentration\n" + sampleRows.map(r => `${r.time},${r.concentration}`).join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "reaction-kinetics-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function analyze() {
    setError("");
    try {
      const data = rows.map(r => ({ time: Number(r.time), concentration: Number(r.concentration) }));
      const res = analyzeKinetics(data);
      setResult(res);
      setOpen({ order: true, k: true, accuracy: true, compare: true, graph: true, how: false });
    } catch (err) { setResult(null); setError(err.message); }
  }

  const toggle = key => setOpen(o => ({ ...o, [key]: !o[key] }));

  return (
    <div className="app">
      <header className="header">
        <div className="brand"><FlaskConical size={25} /><span>Reaction Kinetics Analyzer</span></div>
        <button className="reset-btn" onClick={reset}><RotateCcw size={16}/> Reset</button>
      </header>

      <main>
        <div className="intro">
          <h1>Reaction Kinetics Analyzer</h1>
          <p>Determine reaction order, rate constant, and model accuracy from concentration–time data.</p>
        </div>

        <section className="panel">
          <div className="panel-title">
            <div><h2>1. Input Data</h2><p>Enter measurements manually or upload a CSV file.</p></div>
            <button className="secondary" onClick={loadSample}>Load example</button>
          </div>

          <div className="controls">
            <label>Time unit
              <select value={timeUnit} onChange={e => setTimeUnit(e.target.value)}>
                <option value="s">seconds (s)</option><option value="min">minutes (min)</option><option value="h">hours (h)</option>
              </select>
            </label>
            <label>Concentration unit
              <select value={concUnit} onChange={e => setConcUnit(e.target.value)}>
                <option value="mol/L">mol/L</option><option value="mol/m³">mol/m³</option><option value="custom">custom</option>
              </select>
            </label>
            {concUnit === "custom" && <label>Custom unit
              <input value={customConc} onChange={e => setCustomConc(e.target.value)} placeholder="e.g. mmol/L"/>
            </label>}
          </div>

          <div className="upload-row">
            <label className="upload-btn"><Upload size={17}/> Upload CSV<input type="file" accept=".csv,text/csv" onChange={handleFile}/></label>
            <button className="secondary" onClick={downloadCSV}><Download size={17}/> Download Sample CSV</button>
            {csvName && <span className="filename">{csvName}</span>}
          </div>

          {error && <div className="error"><AlertCircle size={18}/><span>{error}</span></div>}

          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Time ({timeUnit})</th><th>Concentration ({concentrationUnit})</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><input type="number" step="any" value={r.time} onChange={e => updateRow(i, "time", e.target.value)}/></td>
                    <td><input type="number" step="any" value={r.concentration} onChange={e => updateRow(i, "concentration", e.target.value)}/></td>
                    <td><button className="icon-btn" onClick={() => removeRow(i)} aria-label="Remove row"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="add-row" onClick={addRow}><Plus size={17}/> Add row</button>
          <button className="analyze-btn" onClick={analyze}><Play size={18}/> Analyze Data</button>
        </section>

        {result && (
          <section className="results">
            <div className="results-heading"><h2>2. Results</h2><span className="success"><CheckCircle2 size={16}/> Analysis complete</span></div>

            <Accordion title="Reaction Order" open={open.order} onToggle={() => toggle("order")}>
              <div className="key-result"><span>Predicted reaction order</span><strong>{result.best.label}</strong></div>
              <p>Selected because its linearized model gives the highest R² among the valid candidate models.</p>
              <div className="stat-grid"><div><span>R²</span><b>{result.best.r2.toFixed(5)}</b></div><div><span>RMSE</span><b>{result.best.rmse.toExponential(4)}</b></div></div>
              {result.uncertain && <div className="warning">The leading R² values are very close. The reaction order should be treated as uncertain and checked against experimental context.</div>}
            </Accordion>

            <Accordion title="Rate Constant" open={open.k} onToggle={() => toggle("k")}>
              <div className="key-result"><span>k</span><strong>{formatK(result.best.k)} {unitForK(result.best.order, concentrationUnit, timeUnit)}</strong></div>
              <p>The rate constant is obtained from the slope of the corresponding integrated rate-law plot, with the correct sign convention for the selected order.</p>
            </Accordion>

            <Accordion title="Prediction Accuracy" open={open.accuracy} onToggle={() => toggle("accuracy")}>
              <div className="stat-grid three"><div><span>R²</span><b>{result.best.r2.toFixed(5)}</b></div><div><span>RMSE</span><b>{result.best.rmse.toExponential(4)}</b></div><div><span>Percentage accuracy*</span><b>{accuracyPercent(result.best)}%</b></div></div>
              <p><b>{result.best.fitLabel}</b> — percentage accuracy is calculated as <code>(1 − RMSE / mean observed concentration) × 100</code>, clipped to 0–100%. It is a descriptive error-based metric, not a probability of correctness.</p>
            </Accordion>

            <Accordion title="Model Comparison" open={open.compare} onToggle={() => toggle("compare")}>
              <div className="comparison">
                <table><thead><tr><th>Model</th><th>R²</th><th>k</th><th>RMSE</th><th>Status</th></tr></thead>
                <tbody>{result.models.map(m => <tr key={m.order}><td>{m.label}</td><td>{m.valid ? m.r2.toFixed(5) : "—"}</td><td>{m.valid ? `${formatK(m.k)} ${unitForK(m.order, concentrationUnit, timeUnit)}` : "—"}</td><td>{m.valid ? m.rmse.toExponential(3) : "—"}</td><td>{m.valid ? (m.order === result.best.order ? <b>Best fit</b> : "Evaluated") : "Not valid"}</td></tr>)}</tbody></table>
              </div>
            </Accordion>

            <Accordion title="Graphs" open={open.graph} onToggle={() => toggle("graph")}>
              <div className="chart-block">
                <h3>Experimental vs predicted concentration</h3>
                <Chart data={result.best.predictionData} x="time" yKeys={[["concentration", "Experimental"], ["predicted", "Predicted"]]} xLabel={`Time (${timeUnit})`} yLabel={`Concentration (${concentrationUnit})`} />
              </div>
              <div className="linear-grid">
                {result.models.filter(m => m.valid).map(m => <div className="chart-block" key={m.order}>
                  <h3>{m.label} linearization</h3>
                  <Chart data={m.linearData} x="x" yKeys={[["y", "Transformed data"], ["fit", "Regression line"]]} xLabel={m.xLabel} yLabel={m.yLabel} />
                  <div className="chart-note">R² = {m.r2.toFixed(5)}</div>
                </div>)}
              </div>
            </Accordion>
          </section>
        )}

        <section className="panel how">
          <Accordion title="How does this work?" open={open.how} onToggle={() => toggle("how")}>
            <ul>
              <li><b>Reaction order:</b> the analyzer tests zero-, first-, and second-order integrated rate laws.</li>
              <li><b>Rate constant:</b> k is calculated from the slope of the appropriate linearized plot.</li>
              <li><b>R²:</b> measures how closely the transformed data follow a straight line; higher values indicate a better linear fit.</li>
              <li><b>RMSE:</b> measures the typical size of prediction error in the original concentration units; lower is better.</li>
              <li><b>Best model:</b> normally the valid model with the highest R² is selected. Very close R² values trigger an uncertainty warning.</li>
            </ul>
          </Accordion>
        </section>
      </main>
      <footer>For educational use • Reaction Kinetics Analyzer</footer>
    </div>
  );
}

function Chart({ data, x, yKeys, xLabel, yLabel }) {
  return <div className="chart">
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 35 }}>
        <CartesianGrid strokeDasharray="3 3"/>
        <XAxis dataKey={x} type="number" tick={{fontSize: 11}} label={{ value: xLabel, position: "bottom", offset: 15 }}/>
        <YAxis tick={{fontSize: 11}} label={{ value: yLabel, angle: -90, position: "insideLeft" }}/>
        <Tooltip/>
        <Legend/>
        {yKeys.map(([key, name], i) => <Line key={key} type="linear" dataKey={key} name={name} dot={key !== "fit"} strokeWidth={2} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
