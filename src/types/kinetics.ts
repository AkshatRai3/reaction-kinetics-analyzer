export interface DataPoint { time:number; concentration:number }
export interface RegressionResult { slope:number; intercept:number; rSquared:number; predicted:number[] }
export type Method = 'integral'|'differential'
export type IntegralOrder = 0|1|2
export interface IntegralCandidate extends RegressionResult { order:IntegralOrder; label:string; xLabel:string; yLabel:string; x:number[]; y:number[]; k:number }
export interface KineticsResult { method:Method; reactionOrder:number; rateConstant:number; rSquared:number; regression:RegressionResult; candidates?:IntegralCandidate[]; x:number[]; y:number[]; xLabel:string; yLabel:string; equation:string; excludedPoints?:number[] }
export interface Units { time:string; concentration:string }
