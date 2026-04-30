import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({ indexCode: z.string().min(1).max(64) });

interface BdeObservation {
  date: string; // YYYY-MM-DD
  value: number;
}

/**
 * Sincroniza un índice con datos públicos del Banco de España.
 * Estrategia: el portal del BDE expone series como CSV en endpoints públicos
 * (sdw_business / Catálogo de Series). El formato es heterogéneo, así que
 * implementamos un adaptador que tolera fallos: si no logra parsear, devuelve
 * un error informativo y la UI sigue permitiendo carga manual / CSV.
 *
 * Endpoints conocidos (públicos, sin API key):
 *  - https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/<dataset>/<serie>.csv
 * Para no romper si el endpoint cambia, todo está envuelto en try/catch.
 */
export const syncBdeIndex = createServerFn({ method: "POST" })
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { data: idx, error: idxErr } = await supabaseAdmin
        .from("reference_indexes")
        .select("id, code, bde_series_code, bde_dataset")
        .eq("code", data.indexCode)
        .maybeSingle();

      if (idxErr || !idx) return { ok: false, error: "Índice no encontrado", inserted: 0 };
      if (!idx.bde_series_code) {
        return { ok: false, error: "Este índice no tiene serie BDE configurada. Use carga manual o CSV.", inserted: 0 };
      }

      const { data: lastRow } = await supabaseAdmin
        .from("index_values")
        .select("value_date")
        .eq("index_id", idx.id)
        .order("value_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const observations = await fetchBdeSeries(idx.bde_series_code, idx.bde_dataset ?? "TI");
      const cutoff = lastRow?.value_date ? new Date(lastRow.value_date) : null;
      const fresh = cutoff ? observations.filter((o) => new Date(o.date) > cutoff) : observations;

      if (fresh.length === 0) return { ok: true, inserted: 0, message: "Sin nuevos valores" };

      const rows = fresh.map((o) => ({
        index_id: idx.id,
        value_date: o.date,
        value: o.value,
        source: "bde_api" as const,
        synced_at: new Date().toISOString(),
      }));

      const { error: insErr } = await supabaseAdmin
        .from("index_values")
        .upsert(rows, { onConflict: "index_id,value_date" });

      if (insErr) return { ok: false, error: insErr.message, inserted: 0 };
      return { ok: true, inserted: rows.length };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido sincronizando con BDE";
      console.error("[syncBdeIndex]", msg);
      return { ok: false, error: msg, inserted: 0 };
    }
  });

async function fetchBdeSeries(seriesCode: string, dataset: string): Promise<BdeObservation[]> {
  // El BDE publica CSVs por serie. Probamos rutas conocidas.
  const candidates = [
    `https://www.bde.es/webbe/es/estadisticas/compartido/datos/csv/${dataset}/${seriesCode}.csv`,
    `https://www.bde.es/webbde/es/estadis/infoest/series/${seriesCode}.csv`,
  ];

  let csv: string | null = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: "text/csv,*/*" } });
      if (res.ok) {
        csv = await res.text();
        if (csv && csv.length > 50) break;
      }
    } catch {
      // probar siguiente
    }
  }
  if (!csv) throw new Error("No se pudo obtener la serie del BDE (endpoint no disponible)");
  return parseBdeCsv(csv);
}

/**
 * Parser tolerante: BDE suele entregar líneas tipo "AAAA MMM,valor" o "DD/MM/AAAA;valor".
 * Soporta separadores , y ;, encabezados, y formatos numéricos europeos.
 */
function parseBdeCsv(csv: string): BdeObservation[] {
  const out: BdeObservation[] = [];
  const lines = csv.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;
    const dateStr = parts[0];
    const valStr = parts[parts.length - 1];
    const date = parseSpanishDate(dateStr);
    const val = parseSpanishNumber(valStr);
    if (date && Number.isFinite(val)) out.push({ date, value: val });
  }
  return out;
}

function parseSpanishDate(s: string): string | null {
  // DD/MM/AAAA
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  // AAAA-MM o AAAA/MM o AAAA MM
  m = s.match(/^(\d{4})[\s\-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  // AAAA MMM (Ene, Feb...)
  m = s.match(/^(\d{4})\s+([A-Za-z]{3})$/);
  if (m) {
    const months: Record<string, string> = {
      ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
      jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
      jan: "01", apr: "04", aug: "08", dec: "12",
    };
    const mm = months[m[2].toLowerCase()];
    if (mm) return `${m[1]}-${mm}-01`;
  }
  return null;
}

function parseSpanishNumber(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}
