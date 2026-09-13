export const timeUnits={s:1,min:60,h:3600} as const;
export const concentrationUnits={M:1,'mmol/L':1e-3,'μmol/L':1e-6,'mol/m³':1e-3,custom:1} as const;
export function timeFactor(unit:string){return timeUnits[unit as keyof typeof timeUnits]??1}
export function concentrationFactor(unit:string){return concentrationUnits[unit as keyof typeof concentrationUnits]??1}
export function rateConstantUnit(order:number,t:string,c:string){if(order===0)return `${c}/${t}`;if(order===1)return `${t}⁻¹`;return `(${c}·${t})⁻¹`}
