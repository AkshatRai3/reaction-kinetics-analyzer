import { Fragment, useMemo, useRef, useState } from 'react';
import { Download, Upload, Plus, Trash2, FileUp } from 'lucide-react';
import type { DataPoint, MechanismInputState, Units } from '../types/kinetics';
import { downloadSampleCsv, parseSpeciesCsv } from '../utils/csvParser';

const parseSpeciesNames = (value: string) =>
  value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

const makeSpeciesValues = (species: string[]) =>
  Object.fromEntries(species.map((name) => [name, NaN]));

const makeSpeciesRow = (species: string[]) => ({
  time: NaN,
  values: makeSpeciesValues(species),
});

export default function DataInput({
  data,
  setData,
  units,
  setUnits,
  error,
  setError,
  mechanismInputs,
  setMechanismInputs,
  onUpdateSampleSet,
}: {
  data: DataPoint[];
  setData: (d: DataPoint[]) => void;
  units: Units;
  setUnits: (u: Units) => void;
  error: string;
  setError: (e: string) => void;
  mechanismInputs: MechanismInputState;
  setMechanismInputs: (inputs: MechanismInputState) => void;
  onUpdateSampleSet?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const speciesNames = useMemo(
    () => parseSpeciesNames(mechanismInputs.speciesNames),
    [mechanismInputs.speciesNames],
  );

  const update = (i: number, k: keyof DataPoint, v: string) => {
    const copy = [...data];
    copy[i] = { ...copy[i], [k]: v === '' ? NaN : Number(v) };
    setData(copy);
  };

  const updateSpeciesRowTime = (rowIndex: number, value: string) => {
    const next = [...mechanismInputs.speciesTable];
    next[rowIndex] = {
      ...next[rowIndex],
      time: value === '' ? NaN : Number(value),
    };
    setMechanismInputs({ ...mechanismInputs, speciesTable: next });
  };

  const updateSpeciesRowValue = (rowIndex: number, species: string, value: string) => {
    const next = [...mechanismInputs.speciesTable];
    const current = next[rowIndex] ?? makeSpeciesRow(speciesNames);
    next[rowIndex] = {
      ...current,
      values: {
        ...current.values,
        [species]: value === '' ? NaN : Number(value),
      },
    };
    setMechanismInputs({ ...mechanismInputs, speciesTable: next });
  };

  const ensureSpeciesTable = (names: string[]) => {
    if (mechanismInputs.speciesTable.length === 0) {
      return [makeSpeciesRow(names)];
    }

    return mechanismInputs.speciesTable.map((row) => ({
      time: row.time,
      values: Object.fromEntries(
        names.map((name) => [name, row.values?.[name] ?? NaN]),
      ),
    }));
  };

  const load = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseSpeciesCsv(file);
      if (parsed.speciesNames.length === 1 && parsed.speciesNames[0].toLowerCase() === 'concentration') {
        setData(parsed.speciesTable.map((row) => ({
          time: row.time,
          concentration: row.values[parsed.speciesNames[0]],
        })));
      } else {
        const firstSpecies = parsed.speciesNames[0];
        setMechanismInputs({
          ...mechanismInputs,
          multipleSpeciesAvailable: parsed.speciesNames.length > 1,
          speciesNames: parsed.speciesNames.join(', '),
          initialConcentrations: parsed.speciesNames
            .map((name) => `${name}: ${parsed.speciesTable[0].values[name]}`)
            .join(', '),
          speciesTable: parsed.speciesTable,
        });
        setData(parsed.speciesTable.map((row) => ({
          time: row.time,
          concentration: row.values[firstSpecies],
        })));
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read CSV.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold">Step 2 — Enter data</h2>
        <button
          onClick={downloadSampleCsv}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:border-slate-700"
        >
          <Download size={15} />
          Download Sample CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Time unit
          <select
            value={units.time}
            onChange={(e) => setUnits({ ...units, time: e.target.value })}
            className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="s">seconds (s)</option>
            <option value="min">minutes (min)</option>
            <option value="h">hours (h)</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          Concentration unit
          <select
            value={units.concentration}
            onChange={(e) => setUnits({ ...units, concentration: e.target.value })}
            className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="M">mol/L (M)</option>
            <option value="mmol/L">mmol/L</option>
            <option value="μmol/L">μmol/L</option>
            <option value="mol/m³">mol/m³</option>
            <option value="custom">custom unit</option>
          </select>
        </label>
      </div>

      <div className="rounded-2xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <input
            id="multiple-species"
            type="checkbox"
            checked={mechanismInputs.multipleSpeciesAvailable}
            onChange={(e) => {
              const multipleSpeciesAvailable = e.target.checked;
              const names = parseSpeciesNames(mechanismInputs.speciesNames);
              const safeNames = names.length ? names : ['A'];

              setMechanismInputs({
                ...mechanismInputs,
                multipleSpeciesAvailable,
                speciesNames: safeNames.join(', '),
                speciesTable: ensureSpeciesTable(safeNames),
              });
            }}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="multiple-species" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Multiple species data available
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Species names
            <input
              value={mechanismInputs.speciesNames}
              onChange={(e) => {
                const nextNames = parseSpeciesNames(e.target.value);
                const safeNames = nextNames.length ? nextNames : ['A'];
                setMechanismInputs({
                  ...mechanismInputs,
                  speciesNames: e.target.value,
                  speciesTable: ensureSpeciesTable(safeNames),
                });
              }}
              placeholder="A, B, C"
              className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="text-sm font-medium">
            Initial concentrations
            <input
              value={mechanismInputs.initialConcentrations}
              onChange={(e) =>
                setMechanismInputs({
                  ...mechanismInputs,
                  initialConcentrations: e.target.value,
                })
              }
              placeholder="A: 1.0, B: 0.5, C: 0"
              className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="text-sm font-medium">
            Reactor type
            <select
              value={mechanismInputs.reactorType}
              onChange={(e) =>
                setMechanismInputs({
                  ...mechanismInputs,
                  reactorType: e.target.value as MechanismInputState['reactorType'],
                })
              }
              className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="batch">Batch</option>
              <option value="cstr">CSTR</option>
              <option value="pfr">PFR</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Temperature (K)
            <input
              type="number"
              value={mechanismInputs.temperature}
              onChange={(e) =>
                setMechanismInputs({ ...mechanismInputs, temperature: e.target.value })
              }
              placeholder="298"
              className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Stoichiometry
          <textarea
            value={mechanismInputs.stoichiometry}
            onChange={(e) =>
              setMechanismInputs({ ...mechanismInputs, stoichiometry: e.target.value })
            }
            rows={3}
            placeholder="A + B -> C"
            className="mt-1 w-full rounded-lg border bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {mechanismInputs.multipleSpeciesAvailable && (
          <div className="mt-5 rounded-xl border border-indigo-200 bg-white p-3 dark:border-indigo-900 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Multi-species time series
              </h3>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMechanismInputs({
                      ...mechanismInputs,
                      speciesTable: [...mechanismInputs.speciesTable, makeSpeciesRow(speciesNames)],
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs dark:border-slate-700"
                >
                  <Plus size={14} />
                  Add time point
                </button>
                <button
                  type="button"
                  onClick={onUpdateSampleSet}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Update sample for reactants
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div
                className="grid min-w-[500px] gap-2"
                style={{
                  gridTemplateColumns: `minmax(120px, 1fr) repeat(${speciesNames.length}, minmax(120px, 1fr)) auto`,
                }}
              >
                <div className="rounded-lg bg-slate-100 p-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Time
                </div>
                {speciesNames.map((species) => (
                  <div
                    key={species}
                    className="rounded-lg bg-slate-100 p-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {species}
                  </div>
                ))}
                <div />

                {mechanismInputs.speciesTable.map((row, rowIndex) => (
                  <Fragment key={`species-row-${rowIndex}`}>
                    <input
                      type="number"
                      value={Number.isFinite(row.time) ? row.time : ''}
                      onChange={(e) => updateSpeciesRowTime(rowIndex, e.target.value)}
                      className="rounded-lg border bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                      placeholder="0"
                    />
                    {speciesNames.map((species) => (
                      <input
                        key={`${species}-${rowIndex}`}
                        type="number"
                        value={Number.isFinite(row.values?.[species]) ? row.values[species] : ''}
                        onChange={(e) =>
                          updateSpeciesRowValue(rowIndex, species, e.target.value)
                        }
                        className="rounded-lg border bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                        placeholder="0"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setMechanismInputs({
                          ...mechanismInputs,
                          speciesTable: mechanismInputs.speciesTable.filter((_, idx) => idx !== rowIndex),
                        })
                      }
                      className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      aria-label="Remove time point"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Without multiple species data, reactor context, and stoichiometry, the result remains an apparent order only. Mechanism inference is not reliable from the current single-trace input.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void load(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center ${
          drag
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        <input
          ref={ref}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void load(e.target.files?.[0])}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <FileUp className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Drop a CSV here or browse from your computer
          </p>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900"
          >
            <Upload size={15} />
            Choose CSV
          </button>
        </div>
      </div>

      {!mechanismInputs.multipleSpeciesAvailable && (
      <div className="overflow-hidden rounded-2xl border dark:border-slate-800">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          <span>Time</span>
          <span>Conc.</span>
          <span>Action</span>
        </div>

        {data.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 border-t p-3 dark:border-slate-800"
          >
            <input
              type="number"
              value={Number.isFinite(row.time) ? row.time : ''}
              onChange={(e) => update(i, 'time', e.target.value)}
              className="rounded-lg border bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
              placeholder="0"
            />
            <input
              type="number"
              value={Number.isFinite(row.concentration) ? row.concentration : ''}
              onChange={(e) => update(i, 'concentration', e.target.value)}
              className="rounded-lg border bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
              placeholder="1.0"
            />
            <button
              type="button"
              onClick={() => setData(data.filter((_, idx) => idx !== i))}
              className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
              aria-label="Remove row"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <button
            type="button"
            onClick={() => setData([...data, { time: NaN, concentration: NaN }])}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:border-slate-700"
          >
            <Plus size={15} />
            Add row
          </button>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
          )}
        </div>
      </div>
      )}

      {mechanismInputs.multipleSpeciesAvailable && (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
          The multi-species table is now the active data source. The first species column is used for the apparent-order calculation, while all columns are used for mechanism screening.
        </p>
      )}
    </section>
  );
}
