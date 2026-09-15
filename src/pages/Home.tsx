import { useEffect, useState } from "react";
import Header from "../components/Header";
import MethodSelector from "../components/MethodSelector";
import DataInput from "../components/DataInput";
import ResultsCard from "../components/ResultsCard";
import GraphCard from "../components/GraphCard";
import MethodExplanation from "../components/MethodExplanation";
import Comparison from "../components/Comparison";
import { analyzeIntegral } from "../methods/integralMethod";
import { analyzeDifferential } from "../methods/differentialMethod";
import { validateData } from "../utils/calculations";
import { inferMechanism } from "../utils/mechanismInference";
import type {
  DataPoint,
  MechanismInputState,
  Method,
  KineticsResult,
  Units,
} from "../types/kinetics";
const sample: DataPoint[] = [
  { time: 0, concentration: 1 },
  { time: 10, concentration: 0.819 },
  { time: 20, concentration: 0.67 },
  { time: 30, concentration: 0.549 },
  { time: 40, concentration: 0.449 },
  { time: 50, concentration: 0.368 },
];

const sampleTimes = sample.map((point) => point.time);

const makeReactantSample = (speciesNames: string[]) =>
  sampleTimes.map((time) => ({
    time,
    values: Object.fromEntries(
      speciesNames.map((species, speciesIndex) => [
        species,
        Number(Math.exp(-0.02 * (speciesIndex + 1) * time).toFixed(3)),
      ]),
    ),
  }));

export default function Home() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("rka-theme") === "dark",
  );
  const [method, setMethod] = useState<Method | null>(null);
  const [data, setData] = useState(sample);
  const [units, setUnits] = useState<Units>({ time: "s", concentration: "M" });
  const [mechanismInputs, setMechanismInputs] = useState<MechanismInputState>({
    multipleSpeciesAvailable: false,
    speciesNames: "A",
    initialConcentrations: "A: 1.0",
    temperature: "",
    stoichiometry: "A -> products",
    speciesTable: [{ time: 0, values: { A: 1 } }, { time: 10, values: { A: 0.819 } }, { time: 20, values: { A: 0.67 } }, { time: 30, values: { A: 0.549 } }, { time: 40, values: { A: 0.449 } }, { time: 50, values: { A: 0.368 } }],
  });
  const [result, setResult] = useState<KineticsResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("rka-theme", dark ? "dark" : "light");
  }, [dark]);
  const reset = () => {
    if (confirm("Reset the analysis and restore the default sample data?")) {
      setMethod(null);
      setData(sample);
      setUnits({ time: "s", concentration: "M" });
      setMechanismInputs({
        multipleSpeciesAvailable: false,
        speciesNames: "A",
        initialConcentrations: "A: 1.0",
        temperature: "",
        stoichiometry: "A -> products",
        speciesTable: [{ time: 0, values: { A: 1 } }, { time: 10, values: { A: 0.819 } }, { time: 20, values: { A: 0.67 } }, { time: 30, values: { A: 0.549 } }, { time: 40, values: { A: 0.449 } }, { time: 50, values: { A: 0.368 } }],
      });
      setResult(null);
      setError("");
    }
  };

  const updateSampleForReactants = () => {
    const speciesNames = mechanismInputs.speciesNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const safeNames = speciesNames.length ? speciesNames : ["A"];
    const speciesTable = makeReactantSample(safeNames);

    setData(
      speciesTable.map((row) => ({
        time: row.time,
        concentration: row.values[safeNames[0]],
      })),
    );
    setMechanismInputs({
      ...mechanismInputs,
      multipleSpeciesAvailable: safeNames.length > 1,
      speciesNames: safeNames.join(", "),
      initialConcentrations: safeNames.map((name) => `${name}: 1.0`).join(", "),
      speciesTable,
    });
    setError("");
    setResult(null);
  };

  const analyze = () => {
    setError("");
    setResult(null);
    if (!method) {
      setError("Please select Integral Method or Differential Method first.");
      return;
    }
    const activeData = mechanismInputs.multipleSpeciesAvailable
      ? (() => {
          const speciesName = mechanismInputs.speciesNames
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)[0];
          return mechanismInputs.speciesTable
            .filter(
              (row) =>
                speciesName &&
                Number.isFinite(row.time) &&
                Number.isFinite(row.values?.[speciesName]),
            )
            .map((row) => ({
              time: row.time,
              concentration: row.values[speciesName],
            }));
        })()
      : data;
    const sorted = [...activeData].sort((a, b) => a.time - b.time);
    if (sorted.some((p, i) => p.time !== data[i]?.time))
      setError("The data was sorted by increasing time before analysis.");
    const validation = validateData(sorted);
    if (validation.length) {
      setError(validation.join(" "));
      return;
    }
    try {
      setBusy(true);
      setTimeout(() => {
        try {
          const analysis =
            method === "integral"
              ? analyzeIntegral(sorted)
              : analyzeDifferential(sorted);

          const mechanismStatus = mechanismInputs.multipleSpeciesAvailable
            ? "mechanism-inference-available"
            : "apparent-order-only";

          const mechanismNote = mechanismInputs.multipleSpeciesAvailable
            ? "Mechanism screening has been run on the available multi-species concentration profiles."
            : "Mechanism inference not reliable from current input.";
          const mechanismInference = mechanismInputs.multipleSpeciesAvailable
            ? inferMechanism(mechanismInputs)
            : undefined;

          setResult({
            ...analysis,
            mechanismStatus,
            mechanismNote,
            mechanismInference,
          });
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Analysis failed. Please check your data.",
          );
        } finally {
          setBusy(false);
        }
      }, 120);
    } catch {
      setBusy(false);
      setError("Analysis failed. Please check your data.");
    }
  };
  return (
    <div className="min-h-screen">
      <Header dark={dark} onToggle={() => setDark((v) => !v)} onReset={reset} />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-7 text-white shadow-lg sm:p-10">
          <div className="max-w-3xl">
            <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-100">
              Scientific client-side calculator
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Analyze Time–Concentration Data
            </h1>
            <p className="mt-4 text-indigo-100 sm:text-lg">
              Estimate the apparent reaction order and rate constant using the
              Integral or Differential Method.
            </p>
            <p className="mt-2 text-sm text-indigo-100/90">
              A single time–concentration curve cannot reliably infer whether the
              reaction is autocatalytic, reversible, series, or parallel.
            </p>
          </div>
        </section>
        <MethodSelector
          method={method}
          setMethod={(m) => {
            setMethod(m);
            setResult(null);
            setError("");
          }}
        />
        <DataInput
          data={data}
          setData={(d) => {
            setData(d);
            setResult(null);
          }}
          units={units}
          setUnits={setUnits}
          error={error}
          setError={setError}
          mechanismInputs={mechanismInputs}
          setMechanismInputs={setMechanismInputs}
          onUpdateSampleSet={updateSampleForReactants}
        />
        <div className="flex justify-center">
          <button
            disabled={busy}
            onClick={analyze}
            className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Analyzing…" : "Analyze Data"}
          </button>
        </div>
        {result && (
          <>
            <ResultsCard result={result} units={units} />
            <GraphCard result={result} />
            <MethodExplanation result={result} />
            <Comparison result={result} />
          </>
        )}
      </main>
      <footer className="mt-10 border-t py-6 text-center text-sm text-slate-500 dark:border-slate-800">
        The Rate race · Client-side scientific calculator
      </footer>
    </div>
  );
}
