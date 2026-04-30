/**
 * Motor de cálculo hipotecario.
 * Sistemas: francés (cuota constante) y alemán (capital constante).
 * Tipos: fijo, variable, mixto.
 */

export type AmortSystem = "frances" | "aleman";
export type RateType = "fijo" | "variable" | "mixto";

export interface LoanInput {
  initialCapital: number;
  termMonths: number;
  signedDate: Date;
  amortSystem: AmortSystem;
  rateType: RateType;
  initialTin: number; // anual % (ej. 3.5)
  paymentFrequencyMonths?: number; // por defecto 1
  /** Periodo fijo (en meses) si es mixto */
  fixedPeriodMonths?: number;
  /** Cláusula suelo */
  floorRate?: number | null;
  /** Cláusula techo */
  ceilingRate?: number | null;
  /** Función opcional: dada una fecha de revisión, devuelve el TIN aplicado (para variables) */
  rateAt?: (date: Date) => number;
}

export interface AmortRow {
  period: number;
  date: Date;
  rateAnnual: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

/** Cuota francesa constante */
export function frenchPayment(principal: number, monthlyRate: number, n: number): number {
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
}

export function generateSchedule(loan: LoanInput): AmortRow[] {
  const freq = loan.paymentFrequencyMonths ?? 1;
  const totalPeriods = Math.round(loan.termMonths / freq);
  const rows: AmortRow[] = [];
  let balance = loan.initialCapital;

  for (let i = 1; i <= totalPeriods; i++) {
    const date = addMonths(loan.signedDate, i * freq);

    // Determinar tipo nominal anual del periodo
    let tinAnnual = loan.initialTin;
    if (loan.rateType === "variable" && loan.rateAt) {
      tinAnnual = loan.rateAt(date);
    } else if (loan.rateType === "mixto") {
      const monthsElapsed = i * freq;
      if (monthsElapsed > (loan.fixedPeriodMonths ?? 0) && loan.rateAt) {
        tinAnnual = loan.rateAt(date);
      }
    }

    // Aplicar suelo/techo
    if (loan.floorRate != null && tinAnnual < loan.floorRate) tinAnnual = loan.floorRate;
    if (loan.ceilingRate != null && tinAnnual > loan.ceilingRate) tinAnnual = loan.ceilingRate;

    const monthlyRate = tinAnnual / 100 / (12 / freq);

    let payment: number;
    let principal: number;
    let interest: number;

    if (loan.amortSystem === "frances") {
      const remaining = totalPeriods - i + 1;
      payment = frenchPayment(balance, monthlyRate, remaining);
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

/** Compara dos cuadros y devuelve la diferencia total de intereses (positivo = paga de más en B vs A) */
export function compareInterest(a: AmortRow[], b: AmortRow[]): number {
  return round(totalInterest(b) - totalInterest(a));
}
