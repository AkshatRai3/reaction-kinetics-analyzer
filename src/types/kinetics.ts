export interface DataPoint { time:number; concentration:number }
export interface RegressionResult { slope:number; intercept:number; rSquared:number; predicted:number[] }
export type Method = 'integral'|'differential'
export type IntegralOrder = 0|1|2|3|4|5
export interface IntegralCandidate extends RegressionResult { order:IntegralOrder; label:string; xLabel:string; yLabel:string; x:number[]; y:number[]; k:number }
export interface SpeciesTableRow {
  time: number;
  values: Record<string, number>;
}

export interface MechanismInputState {
  multipleSpeciesAvailable: boolean;
  speciesNames: string;
  initialConcentrations: string;
  temperature: string;
  stoichiometry: string;
  speciesTable: SpeciesTableRow[];
}
export type MechanismClassification = 'autocatalytic'|'reversible'|'series'|'parallel'|'inconclusive';
export interface MechanismInference {
  classification: MechanismClassification;
  confidence: 'low'|'moderate'|'high';
  evidence: string[];
  limitations: string;
}
export interface KineticsResult {
  method:Method;
  reactionOrder:number;
  rateConstant:number;
  rSquared:number;
  regression:RegressionResult;
  candidates?:IntegralCandidate[];
  x:number[];
  y:number[];
  xLabel:string;
  yLabel:string;
  equation:string;
  excludedPoints?:number[];
  mechanismStatus?: 'apparent-order-only'|'mechanism-inference-available';
  mechanismNote?:string;
  mechanismInference?: MechanismInference;
}
export interface Units { time:string; concentration:string }
