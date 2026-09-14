import type {
  MechanismClassification,
  MechanismInference,
  MechanismInputState,
} from '../types/kinetics';

type SpeciesProfile = {
  name: string;
  values: number[];
  range: number;
  firstSlope: number;
  lastSlope: number;
  peakIndex: number;
  increasing: boolean;
  decreasing: boolean;
};

const slope = (values: number[], times: number[], start: number, end: number) => {
  const dt = times[end] - times[start];
  return dt > 0 ? (values[end] - values[start]) / dt : 0;
};

const profileSpecies = (name: string, values: number[], times: number[]): SpeciesProfile => {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  const peakIndex = values.indexOf(maximum);
  const firstSlope = slope(values, times, 0, Math.min(1, values.length - 1));
  const lastSlope = slope(values, times, Math.max(0, values.length - 2), values.length - 1);
  const tolerance = Math.max(range * 0.05, 1e-9);

  return {
    name,
    values,
    range,
    firstSlope,
    lastSlope,
    peakIndex,
    increasing: values[values.length - 1] - values[0] > tolerance,
    decreasing: values[0] - values[values.length - 1] > tolerance,
  };
};

const confidenceFor = (score: number): MechanismInference['confidence'] =>
  score >= 0.8 ? 'high' : score >= 0.55 ? 'moderate' : 'low';

export function inferMechanism(inputs: MechanismInputState): MechanismInference {
  const names = inputs.speciesNames.split(',').map((name) => name.trim()).filter(Boolean);
  const rows = inputs.speciesTable;

  if (names.length < 2) {
    return {
      classification: 'inconclusive',
      confidence: 'low',
      evidence: ['At least two species traces are required for mechanism screening.'],
      limitations: 'A single concentration trace supports apparent kinetics only.',
    };
  }

  const validRows = rows.filter((row) =>
    Number.isFinite(row.time) && names.every((name) => Number.isFinite(row.values?.[name])),
  );
  if (validRows.length < 4) {
    return {
      classification: 'inconclusive',
      confidence: 'low',
      evidence: ['At least four complete time points are required for mechanism screening.'],
      limitations: 'Incomplete or sparse species data can make different mechanisms look alike.',
    };
  }

  const orderedRows = [...validRows].sort((a, b) => a.time - b.time);
  const times = orderedRows.map((row) => row.time);
  const profiles = names.map((name) =>
    profileSpecies(name, orderedRows.map((row) => row.values[name]), times),
  );
  const reactants = profiles.filter((profile) => profile.decreasing);
  const products = profiles.filter((profile) => profile.increasing);
  const intermediate = profiles.filter((profile) => {
    const peak = profile.values[profile.peakIndex];
    const start = profile.values[0];
    const end = profile.values[profile.values.length - 1];
    return profile.peakIndex > 0 && profile.peakIndex < profile.values.length - 1 &&
      profile.range > 0 && peak - start > profile.range * 0.25 && peak - end > profile.range * 0.25;
  });

  const seriesScore = intermediate.length > 0 && products.length > 0 ? 0.9 : 0;
  const reversibleCandidate = reactants.find((profile) => {
    const earlyRate = Math.abs(profile.firstSlope);
    const lateRate = Math.abs(profile.lastSlope);
    return earlyRate > 1e-9 && lateRate / earlyRate < 0.35;
  });
  const reversibleScore = reversibleCandidate ? 0.85 : 0;
  const parallelScore = products.length >= 2 && reactants.length > 0 ? 0.8 : 0;
  const autocatalyticCandidate = products.find((profile) =>
    profile.values[0] < Math.max(...profile.values) * 0.5 &&
    profile.firstSlope > 0 && profile.lastSlope > 0 &&
    profile.lastSlope > profile.firstSlope * 1.15,
  );
  const autocatalyticScore = autocatalyticCandidate ? 0.75 : 0;

  const candidates: Array<[MechanismClassification, number, string]> = [
    ['series', seriesScore, intermediate.length ? `Intermediate species ${intermediate.map((profile) => profile.name).join(', ')} rises and then falls.` : ''] as [MechanismClassification, number, string],
    ['reversible', reversibleScore, reversibleCandidate ? `${reversibleCandidate.name} approaches a plateau after an initially faster change.` : ''] as [MechanismClassification, number, string],
    ['parallel', parallelScore, parallelScore ? `${products.length} species increase while at least one reactant decreases.` : ''] as [MechanismClassification, number, string],
    ['autocatalytic', autocatalyticScore, autocatalyticCandidate ? `${autocatalyticCandidate.name} shows a delayed, accelerating increase.` : ''] as [MechanismClassification, number, string],
  ].sort((a, b) => b[1] - a[1]);
  const [classification, score, primaryEvidence] = candidates[0];

  if (score === 0) {
    return {
      classification: 'inconclusive',
      confidence: 'low',
      evidence: ['No distinctive concentration profile was detected for the four screened mechanism families.'],
      limitations: 'Mechanism screening needs stoichiometry, complete species identities, and ideally replicate experiments or fitted candidate models.',
    };
  }

  return {
    classification,
    confidence: confidenceFor(score),
    evidence: [primaryEvidence, `Screened ${validRows.length} complete time points for ${names.length} species.`],
    limitations: 'This is a data-shape heuristic, not proof of a reaction mechanism. Verify it against stoichiometry and kinetic model fits.',
  };
}