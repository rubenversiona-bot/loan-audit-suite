import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RowSchema = z.object({
  value_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().finite(),
});

const InputSchema = z.object({
  indexId: z.string().uuid(),
  rows: z.array(RowSchema).min(1).max(20000),
  source: z.enum(["csv", "manual"]).default("csv"),
});

/**
 * Importa valores de índice mediante un servidor (bypassa RLS de admin).
 * Solo usuarios autenticados pueden invocarla.
 */
export const importIndexValues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      // Verificar que el índice existe
      const { data: idx, error: idxErr } = await supabaseAdmin
        .from("reference_indexes")
        .select("id")
        .eq("id", data.indexId)
        .maybeSingle();
      if (idxErr || !idx) return { ok: false, error: "Índice no encontrado", inserted: 0 };

      const BATCH = 500;
      let inserted = 0;
      const synced_at = new Date().toISOString();
      for (let i = 0; i < data.rows.length; i += BATCH) {
        const batch = data.rows.slice(i, i + BATCH).map((r) => ({
          index_id: data.indexId,
          value_date: r.value_date,
          value: r.value,
          source: data.source,
          synced_at,
        }));
        const { error } = await supabaseAdmin
          .from("index_values")
          .upsert(batch, { onConflict: "index_id,value_date" });
        if (error) return { ok: false, error: error.message, inserted };
        inserted += batch.length;
      }
      return { ok: true, inserted };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error importando valores";
      console.error("[importIndexValues]", msg);
      return { ok: false, error: msg, inserted: 0 };
    }
  });
