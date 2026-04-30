import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({ indexCode: z.string().min(1).max(64) });

interface Observation {
  date: string; // YYYY-MM-DD
  value: number;
}

/**
 * Sincroniza un índice de referencia con datos públicos.
 *
 * Estrategia:
 *  - Para Euríbor (1M, 3M, 6M, 12M) usamos el SDW del Banco Central Europeo,
 *    que expone CSV estable y sin clave (mirror oficial usado también por BdE).
 *  - Para IRPH/MIBOR no existe API abierta y fiable: devolvemos un mensaje
 *    indicando que se debe importar por CSV manual.
 */
export const syncBdeIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { data: idx, error: idxErr } = await supabaseAdmin
        .from("reference_indexes")
        .select("id, code")
        .eq("code", data.indexCode)
        .maybeSingle();

      if (idxErr || !idx) return { ok: false, error: "Índice no encontrado", inserted: 0 };

      const ecbKey = ECB_SERIES[idx.code];
      if (!ecbKey) {
        return {
          ok: false,
          error: "Esta serie no está disponible vía API. Importa los valores oficiales mediante CSV (Banco de España publica boletines mensuales).",
          inserted: 0,
        };
      }

      const observations = await fetchEcbSeries(ecbKey);
      if (observations.length === 0) {
        return { ok: false, error: "La fuente no devolvió valores", inserted: 0 };
      }

      const { data: lastRow } = await supabaseAdmin
        .from("index_values")
        .select("value_date")
        .eq("index_id", idx.id)
        .order("value_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const cutoff = lastRow?.value_date ? new Date(lastRow.value_date) : null;
      const fresh = cutoff ? observations.filter((o) => new Date(o.date) > cutoff) : observations;
      if (fresh.length === 0) return { ok: true, inserted: 0, message: "Sin nuevos valores" };

      const synced_at = new Date().toISOString();
      const rows = fresh.map((o) => ({
        index_id: idx.id,
        value_date: o.date,
        value: o.value,
        source: "bde_api" as const,
        synced_at,
      }));

      const { error: insErr } = await supabaseAdmin
        .from("index_values")
        .upsert(rows, { onConflict: "index_id,value_date" });

      if (insErr) return { ok: false, error: insErr.message, inserted: 0 };
      return { ok: true, inserted: rows.length };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido sincronizando";
      console.error("[syncBdeIndex]", msg);
      return { ok: false, error: msg, inserted: 0 };
    }
  });

// Series Euribor en el SDW del BCE (FM = Financial Markets)
const ECB_SERIES: Record<string, string> = {
  EURIBOR_1M: "FM.M.U2.EUR.RT.MM.EURIBOR1MD_.HSTA",
  EURIBOR_3M: "FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
  EURIBOR_6M: "FM.M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
  EURIBOR_12M: "FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
};

async function fetchEcbSeries(seriesKey: string): Promise<Observation[]> {
  // El SDW del BCE devuelve CSV con cabeceras estándar.
  const dataset = seriesKey.split(".")[0]; // "FM"
  const rest = seriesKey.substring(dataset.length + 1);
  const url = `https://data-api.ecb.europa.eu/service/data/${dataset}/${rest}?format=csvdata`;
  const res = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!res.ok) throw new Error(`ECB SDW respondió ${res.status}`);
  const csv = await res.text();
  return parseEcbCsv(csv);
}

function parseEcbCsv(csv: string): Observation[] {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const iPeriod = header.indexOf("TIME_PERIOD");
  const iValue = header.indexOf("OBS_VALUE");
  if (iPeriod < 0 || iValue < 0) return [];

  const out: Observation[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = parseCsvLine(line);
    const period = parts[iPeriod];
    const value = parseFloat(parts[iValue]);
    if (!period || !Number.isFinite(value)) continue;
    const date = normalizePeriod(period);
    if (date) out.push({ date, value });
  }
  return out;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizePeriod(p: string): string | null {
  // Formatos: "2024-01", "2024-01-15", "2024"
  let m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return p;
  m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;
  m = p.match(/^(\d{4})$/);
  if (m) return `${m[1]}-12-31`;
  return null;
}
