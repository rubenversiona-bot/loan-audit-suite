/** Formateadores comunes EUR / fechas / porcentajes */
export const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const num2 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${num2.format(n)} %`;
export const fmtDate = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
};
