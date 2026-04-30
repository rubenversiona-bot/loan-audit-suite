import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({ loanId: z.string().uuid() });

export const generateExpertReport = createServerFn({ method: "POST" })
  .inputValidator((d) => Schema.parse(d))
  .handler(async ({ data }) => {
    const { data: loan, error } = await supabaseAdmin
      .from("loans")
      .select("*, reference_indexes(name, code)")
      .eq("id", data.loanId)
      .single();
    if (error || !loan) return { ok: false, error: "Préstamo no encontrado", base64: null };

    const { data: events = [] } = await supabaseAdmin
      .from("loan_events")
      .select("*")
      .eq("loan_id", data.loanId)
      .order("event_date");
    const { data: discs = [] } = await supabaseAdmin
      .from("discrepancies")
      .select("*")
      .eq("loan_id", data.loanId)
      .order("discrepancy_date");

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const addPage = () => pdf.addPage([595, 842]); // A4
    let page = addPage();
    let y = 800;
    const margin = 50;
    const lineH = 14;

    const writeLine = (text: string, opts: { font?: typeof font; size?: number; color?: [number, number, number] } = {}) => {
      const f = opts.font ?? font;
      const size = opts.size ?? 10;
      const c = opts.color ?? [0.1, 0.1, 0.1];
      if (y < margin + lineH) {
        page = addPage();
        y = 800;
      }
      page.drawText(text, { x: margin, y, size, font: f, color: rgb(c[0], c[1], c[2]) });
      y -= lineH;
    };
    const sep = (n = 1) => { y -= lineH * n; };

    // CARÁTULA
    writeLine("INFORME PERICIAL HIPOTECARIO", { font: bold, size: 18 });
    sep();
    writeLine(`Deudor: ${loan.debtor_name}`, { size: 11 });
    writeLine(`Entidad: ${loan.bank_name ?? "—"}`, { size: 11 });
    writeLine(`Nº préstamo: ${loan.loan_number ?? "—"}`, { size: 11 });
    writeLine(`Fecha de firma: ${loan.signed_date}`, { size: 11 });
    writeLine(`Fecha de emisión: ${new Date().toLocaleDateString("es-ES")}`, { size: 11 });
    sep(2);

    writeLine("1. ANTECEDENTES", { font: bold, size: 13 });
    sep();
    writeLine(`Capital inicial: ${loan.initial_capital} €`);
    writeLine(`Plazo: ${loan.term_months} meses`);
    writeLine(`Sistema amortización: ${loan.amort_system}`);
    writeLine(`Tipo de interés: ${loan.rate_type}`);
    if (loan.initial_tin) writeLine(`TIN inicial: ${loan.initial_tin} %`);
    if (loan.reference_indexes) writeLine(`Índice: ${(loan.reference_indexes as { name: string }).name}`);
    if (loan.spread != null) writeLine(`Diferencial: ${loan.spread} %`);
    if (loan.floor_rate != null) writeLine(`Cláusula suelo: ${loan.floor_rate} %`, { color: [0.7, 0.1, 0.1] });
    if (loan.ceiling_rate != null) writeLine(`Cláusula techo: ${loan.ceiling_rate} %`);
    sep(2);

    writeLine("2. METODOLOGÍA", { font: bold, size: 13 });
    sep();
    writeLine("Recálculo del cuadro de amortización siguiendo el sistema declarado");
    writeLine("y las cláusulas pactadas, aplicando los valores oficiales del Banco");
    writeLine("de España para los índices de referencia.");
    sep(2);

    writeLine(`3. EVENTOS REGISTRADOS (${events.length})`, { font: bold, size: 13 });
    sep();
    if (events.length === 0) writeLine("Sin eventos registrados.");
    for (const ev of events) {
      writeLine(`${ev.event_date} · ${ev.event_type} · ${ev.amount ?? "—"} € · ${ev.description ?? ""}`);
    }
    sep(2);

    writeLine(`4. DISCREPANCIAS DETECTADAS (${discs.length})`, { font: bold, size: 13 });
    sep();
    let total = 0;
    for (const d of discs) {
      writeLine(`${d.discrepancy_date} · ${d.category} · Δ ${d.delta} € (${d.in_favor_of ?? ""})`);
      total += Number(d.delta);
    }
    sep();
    writeLine(`TOTAL RECLAMABLE: ${total.toFixed(2)} €`, { font: bold, size: 12, color: [0.6, 0.1, 0.1] });
    sep(2);

    writeLine("5. CONCLUSIÓN PERICIAL", { font: bold, size: 13 });
    sep();
    writeLine("De conformidad con el análisis efectuado sobre la documentación aportada,");
    writeLine("se constatan las discrepancias arriba detalladas que arrojan un importe");
    writeLine(`reclamable total de ${total.toFixed(2)} €.`);

    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString("base64");
    return { ok: true, base64, error: null as string | null };
  });
