/**
 * Motor de cálculo hipotecario.
 * Sistemas: francés (cuota constante) y alemán (capital constante).
 * Tipos: fijo, variable, mixto.
 */

export type AmortSystem = "frances" | "aleman";
export type RateType = "fijo" | "variable" | "mixto";

export interface IndexValuePoint {
  date: Date;
  value: number; // %
}

export interface LoanInput {
  initialCapital: number;
  termMonths: number;
  signedDate: Date;
  amortSystem: AmortSystem;
  rateType: RateType;
  initialTin: number; // anual % (ej. 3.5)
  paymentFrequencyMonths?: number; // por defecto 1
  fixedPeriodMonths?: number;
  floorRate?: number | null;
  ceilingRate?: number | null;
  /** Función personalizada (si se proporciona, tiene prioridad) */
  rateAt?: (date: Date) => number;
  /** Diferencial sobre el índice (%). Default 0. */
  spread?: number;
  /** Periodicidad de revisión en meses (default 12). */
  reviewPeriodMonths?: number;
  /** Meses de desfase para consultar el índice (default 2). */
  lookbackMonths?: number;
  /** Histórico de valores del índice de referencia (orden indiferente). */
  indexValues?: IndexValuePoint[];
}

export interface AmortRow {
  period: number;
  date: Date;
  rateAnnual: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  isRevision: boolean;
  /** Valor del índice consultado en la revisión (si aplica). */
  indexValue?: number | null;
}

export function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

export function frenchPayment(principal: number, monthlyRate: number, n: number): number {
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

/**
 * Devuelve el último valor del índice publicado en o antes de `lookupDate`.
 * Fallback: si no hay valor previo, congela el primer valor disponible.
 */
function lookupIndex(values: IndexValuePoint[] | undefined, lookupDate: Date): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a.date.getTime() - b.date.getTime());
  let pick: IndexValuePoint | null = null;
  for (const v of sorted) {
    if (v.date.getTime() <= lookupDate.getTime()) pick = v;
    else break;
  }
  // Fallback: si la fecha buscada es anterior a todo el histórico, usar el primero
  return (pick ?? sorted[0]).value;
}

export function buildRateAt(loan: LoanInput): {
  resolve: (date: Date) => { rate: number; indexValue: number | null };
} {
  const lookback = loan.lookbackMonths ?? 2;
  const spread = loan.spread ?? 0;
  return {
    resolve: (date: Date) => {
      if (loan.rateAt) return { rate: loan.rateAt(date), indexValue: null };
      const lookupDate = addMonths(date, -lookback);
      const idx = lookupIndex(loan.indexValues, lookupDate);
      if (idx == null) return { rate: loan.initialTin, indexValue: null };
      return { rate: idx + spread, indexValue: idx };
    },
  };
}

export function generateSchedule(loan: LoanInput): AmortRow[] {
  const freq = loan.paymentFrequencyMonths ?? 1;
  const totalPeriods = Math.round(loan.termMonths / freq);
  const reviewPeriod = Math.max(1, Math.round((loan.reviewPeriodMonths ?? 12) / freq));
  const fixedPeriods =
    loan.rateType === "mixto" && loan.fixedPeriodMonths
      ? Math.round(loan.fixedPeriodMonths / freq)
      : 0;
  const rows: AmortRow[] = [];
  let balance = loan.initialCapital;
  let currentRate = loan.initialTin;
  let currentPayment: number | null = null;

  const rateResolver = buildRateAt(loan);

  for (let i = 1; i <= totalPeriods; i++) {
    const date = addMonths(loan.signedDate, i * freq);

    let isRevision = i === 1;
    let indexValue: number | null = null;

    if (loan.rateType === "fijo") {
      currentRate = loan.initialTin;
    } else if (loan.rateType === "variable") {
      // Revisión en el primer periodo y cada `reviewPeriod`
      if (i === 1 || (i - 1) % reviewPeriod === 0) {
        const r = rateResolver.resolve(date);
        currentRate = r.rate;
        indexValue = r.indexValue;
        isRevision = true;
        currentPayment = null; // forzar recálculo de cuota
      }
    } else {
      // mixto
      if (i <= fixedPeriods) {
        currentRate = loan.initialTin;
      } else {
        const offset = i - fixedPeriods;
        if (offset === 1 || (offset - 1) % reviewPeriod === 0) {
          const r = rateResolver.resolve(date);
          currentRate = r.rate;
          indexValue = r.indexValue;
          isRevision = true;
          currentPayment = null;
        }
      }
    }

    let tinAnnual = currentRate;
    if (loan.floorRate != null && tinAnnual < loan.floorRate) tinAnnual = loan.floorRate;
    if (loan.ceilingRate != null && tinAnnual > loan.ceilingRate) tinAnnual = loan.ceilingRate;

    const monthlyRate = tinAnnual / 100 / (12 / freq);

    let payment: number;
    let principal: number;
    let interest: number;

    if (loan.amortSystem === "frances") {
      const remaining = totalPeriods - i + 1;
      // Recalcular cuota tras una revisión o al inicio
      if (currentPayment == null || isRevision) {
        currentPayment = frenchPayment(balance, monthlyRate, remaining);
      }
      payment = currentPayment;
      interest = balance * monthlyRate;
      principal = payment - interest;
    } else {
      principal = loan.initialCapital / totalPeriods;
      interest = balance * monthlyRate;
      payment = principal + interest;
    }

    balance = Math.max(0, balance - principal);

    rows.push({
      period: i,
      date,
      rateAnnual: tinAnnual,
      payment: round(payment),
      interest: round(interest),
      principal: round(principal),
      balance: round(balance),
      isRevision,
      indexValue: indexValue == null ? null : round(indexValue),
    });
  }
  return rows;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function totalInterest(rows: AmortRow[]): number {
  return round(rows.reduce((s, r) => s + r.interest, 0));
}
export function totalPaid(rows: AmortRow[]): number {
  return round(rows.reduce((s, r) => s + r.payment, 0));
}

export function compareInterest(a: AmortRow[], b: AmortRow[]): number {
  return round(totalInterest(b) - totalInterest(a));
}
