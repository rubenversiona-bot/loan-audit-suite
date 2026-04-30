import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ExtractLoanSchema = z.object({ pdfBase64: z.string().min(10) });

const LoanExtractionSchema = {
  name: "extract_loan_data",
  description: "Extrae datos estructurados del contrato hipotecario",
  parameters: {
    type: "object",
    properties: {
      debtor_name: { type: "string" },
      bank_name: { type: "string" },
      loan_number: { type: "string" },
      signed_date: { type: "string", description: "AAAA-MM-DD" },
      initial_capital: { type: "number" },
      term_months: { type: "integer" },
      amort_system: { type: "string", enum: ["frances", "aleman"] },
      rate_type: { type: "string", enum: ["fijo", "variable", "mixto"] },
      initial_tin: { type: "number" },
      index_code: { type: "string", description: "EURIBOR_12M, IRPH_CONJUNTO, etc." },
      spread: { type: "number" },
      review_period_months: { type: "integer" },
      fixed_period_months: { type: "integer" },
      opening_fee_pct: { type: "number" },
      early_repay_fee_pct: { type: "number" },
      cancellation_fee_pct: { type: "number" },
      floor_rate: { type: "number" },
      ceiling_rate: { type: "number" },
      confidence_notes: { type: "string" },
    },
  },
};

export const extractLoanFromPdf = createServerFn({ method: "POST" })
  .inputValidator((d) => ExtractLoanSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY no configurada", suggested: null };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Eres un perito hipotecario experto en derecho español. Extrae los datos estructurados del contrato/escritura. Devuelve null en campos no encontrados.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extrae los datos del préstamo hipotecario de este documento." },
                { type: "image_url", image_url: { url: `data:application/pdf;base64,${data.pdfBase64}` } },
              ],
            },
          ],
          tools: [{ type: "function", function: LoanExtractionSchema }],
          tool_choice: { type: "function", function: { name: "extract_loan_data" } },
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `IA Gateway ${res.status}: ${txt.slice(0, 200)}`, suggested: null };
      }
      const json = await res.json();
      const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) return { ok: false, error: "Respuesta vacía del modelo", suggested: null };
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      return { ok: true, suggested: parsed };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      return { ok: false, error: msg, suggested: null };
    }
  });
