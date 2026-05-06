import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExtractLoanSchema = z.object({ storagePath: z.string().min(3) });

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
      index_lookback_months: {
        type: "integer",
        description:
          "Devolver 1 o 2. Meses anteriores a la fecha de revisión que se toman para consultar el índice publicado. Cláusulas como 'Euribor publicado el mes natural anterior' = 1; 'dos meses naturales anteriores' = 2. Si no se especifica, devolver 2.",
      },
      opening_fee_pct: { type: "number" },
      early_repay_fee_pct: { type: "number" },
      cancellation_fee_pct: { type: "number" },
      floor_rate: { type: "number" },
      ceiling_rate: { type: "number" },
      confidence_notes: { type: "string" },
    },
  },
};

const BankScheduleSchema = {
  name: "extract_bank_schedule",
  description: "Extrae las filas del cuadro de amortización proporcionado por el banco.",
  parameters: {
    type: "object",
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            period: { type: "integer" },
            due_date: { type: "string", description: "AAAA-MM-DD" },
            payment: { type: "number" },
            interest: { type: "number" },
            principal: { type: "number" },
            balance: { type: "number" },
            rate: { type: "number" },
          },
        },
      },
    },
    required: ["rows"],
  },
};

const ReceiptSchema = {
  name: "extract_receipts",
  description: "Extrae los movimientos de un recibo bancario.",
  parameters: {
    type: "object",
    properties: {
      movements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "AAAA-MM-DD" },
            amount: { type: "number" },
            concept: { type: "string" },
            type: {
              type: "string",
              enum: ["pago_programado", "amortizacion_anticipada", "comision", "mora", "otro"],
            },
          },
        },
      },
    },
    required: ["movements"],
  },
};

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function callAi(opts: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  pdfBase64: string;
  tool: { name: string; description: string; parameters: Record<string, unknown> };
}) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: opts.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: opts.userPrompt },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${opts.pdfBase64}` } },
          ],
        },
      ],
      tools: [{ type: "function", function: opts.tool }],
      tool_choice: { type: "function", function: { name: opts.tool.name } },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`IA Gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("Respuesta vacía del modelo");
  return typeof args === "string" ? JSON.parse(args) : args;
}

export const extractLoanFromPdf = createServerFn({ method: "POST" })
  .inputValidator((d) => ExtractLoanSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY no configurada", suggested: null };

    const path = data.storagePath;

    try {
      const dl = await supabaseAdmin.storage.from("loan-documents").download(path);
      if (dl.error || !dl.data) {
        return { ok: false, error: `No se pudo descargar el PDF: ${dl.error?.message ?? "vacío"}`, suggested: null };
      }
      const buf = await dl.data.arrayBuffer();
      const b64 = bufferToBase64(buf);

      const parsed = await callAi({
        apiKey,
        systemPrompt:
          "Eres un perito hipotecario experto en derecho español. Extrae los datos estructurados del contrato/escritura. Devuelve null en campos no encontrados.",
        userPrompt: "Extrae los datos del préstamo hipotecario de este documento.",
        pdfBase64: b64,
        tool: LoanExtractionSchema,
      });

      void supabaseAdmin.storage.from("loan-documents").remove([path]);
      return { ok: true, suggested: parsed };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      return { ok: false, error: msg, suggested: null };
    }
  });

const ExtractFromDocSchema = z.object({ documentId: z.string().uuid() });

export const extractFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ExtractFromDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "LOVABLE_API_KEY no configurada" };

    const { supabase, userId } = context;
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, loan_id, bucket, file_path, doc_type, owner_id")
      .eq("id", data.documentId)
      .single();
    if (docErr || !doc) return { ok: false as const, error: "Documento no encontrado" };
    if (doc.owner_id !== userId) return { ok: false as const, error: "Sin permisos" };
    if (!doc.bucket || !doc.file_path) return { ok: false as const, error: "Documento sin archivo" };

    try {
      const dl = await supabaseAdmin.storage.from(doc.bucket).download(doc.file_path);
      if (dl.error || !dl.data) {
        return { ok: false as const, error: `No se pudo descargar: ${dl.error?.message ?? "vacío"}` };
      }
      const b64 = bufferToBase64(await dl.data.arrayBuffer());

      const docType = doc.doc_type ?? "otro";

      if (docType === "cuadro_banco") {
        const parsed = await callAi({
          apiKey,
          systemPrompt:
            "Eres un experto financiero. Extrae cada fila del cuadro de amortización con la mayor precisión posible.",
          userPrompt:
            "Extrae todas las filas del cuadro de amortización: periodo, fecha de vencimiento, cuota, interés, capital amortizado, saldo pendiente y tipo aplicado.",
          pdfBase64: b64,
          tool: BankScheduleSchema,
        });
        const rows: Array<Record<string, unknown>> = parsed.rows ?? [];
        if (doc.loan_id && rows.length > 0) {
          // limpiar filas previas para este documento
          await supabaseAdmin
            .from("bank_amortization_rows")
            .delete()
            .eq("document_id", doc.id);
          const num = (x: unknown): number | null =>
            x == null || x === "" ? null : Number(x);
          const str = (x: unknown): string | null =>
            x == null || x === "" ? null : String(x);
          const inserts = rows.map((r) => ({
            loan_id: doc.loan_id as string,
            document_id: doc.id,
            owner_id: userId,
            period: Number(r.period ?? 0),
            due_date: str(r.due_date),
            payment: num(r.payment),
            interest: num(r.interest),
            principal: num(r.principal),
            balance: num(r.balance),
            rate: num(r.rate),
          }));
          await supabaseAdmin.from("bank_amortization_rows").insert(inserts);
        }
        return { ok: true as const, kind: "cuadro_banco" as const, count: rows.length };
      }

      if (docType === "recibo") {
        const parsed = await callAi({
          apiKey,
          systemPrompt: "Eres un experto financiero. Extrae los movimientos del recibo.",
          userPrompt: "Extrae cada movimiento (fecha, importe, concepto, tipo).",
          pdfBase64: b64,
          tool: ReceiptSchema,
        });
        const movs: Array<Record<string, unknown>> = parsed.movements ?? [];
        if (doc.loan_id && movs.length > 0) {
          const inserts = movs.map((m) => ({
            loan_id: doc.loan_id as string,
            event_date: (m.date as string) ?? new Date().toISOString().slice(0, 10),
            event_type: ((m.type as string) ?? "pago_programado") as
              | "pago_programado"
              | "amortizacion_anticipada"
              | "comision"
              | "mora"
              | "cambio_tasa"
              | "novacion",
            amount: m.amount == null ? null : Number(m.amount),
            description: (m.concept as string) ?? null,
          }));
          await supabaseAdmin.from("loan_events").insert(inserts);
        }
        return { ok: true as const, kind: "recibo" as const, count: movs.length };
      }

      // contrato / escritura / otro
      const parsed = await callAi({
        apiKey,
        systemPrompt:
          "Eres un perito hipotecario experto en derecho español. Extrae los datos estructurados.",
        userPrompt: "Extrae los datos del préstamo hipotecario.",
        pdfBase64: b64,
        tool: LoanExtractionSchema,
      });
      return { ok: true as const, kind: "contrato" as const, suggested: parsed };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Error" };
    }
  });
