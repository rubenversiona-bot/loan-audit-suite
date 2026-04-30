import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { syncBdeIndex } from "@/server/bde.functions";
import { Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/indices")({
  component: () => (
    <AppShell title="Índices de referencia">
      <Indices />
    </AppShell>
  ),
});

function Indices() {
  const sync = useServerFn(syncBdeIndex);
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data: indexes = [] } = useQuery({
    queryKey: ["indexes"],
    queryFn: async () => {
      const { data } = await supabase.from("reference_indexes").select("*").order("code");
      return data ?? [];
    },
  });

  async function doSync(code: string) {
    setSyncing(code);
    try {
      const r = await sync({ data: { indexCode: code } });
      if (!r.ok) toast.error(r.error ?? "Error de sincronización");
      else toast.success(`${r.inserted} valores nuevos sincronizados`);
      qc.invalidateQueries({ queryKey: ["index-values"] });
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de índices oficiales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Serie BDE</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indexes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.code}</TableCell>
                  <TableCell>{i.name}</TableCell>
                  <TableCell>
                    {i.bde_series_code ? (
                      <Badge variant="outline">{i.bde_series_code}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No configurada</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!i.bde_series_code || syncing === i.code}
                      onClick={() => doSync(i.code)}
                    >
                      {syncing === i.code ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Sincronizar BDE
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ValuesViewer indexes={indexes} />
    </div>
  );
}

function ValuesViewer({ indexes }: { indexes: { id: string; code: string; name: string }[] }) {
  const [selected, setSelected] = useState<string>("");
  const [csvOpen, setCsvOpen] = useState(false);
  const sel = selected || indexes[0]?.id;

  const { data: values = [] } = useQuery({
    queryKey: ["index-values", sel],
    queryFn: async () => {
      if (!sel) return [];
      const { data } = await supabase
        .from("index_values")
        .select("*")
        .eq("index_id", sel)
        .order("value_date", { ascending: false })
        .limit(120);
      return data ?? [];
    },
    enabled: !!sel,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Valores históricos</CardTitle>
        <div className="flex gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={sel}
            onChange={(e) => setSelected(e.target.value)}
          >
            {indexes.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="h-3 w-3 mr-1" /> Importar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {csvOpen && sel && <CsvImport indexId={sel} onDone={() => setCsvOpen(false)} />}
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin valores. Sincroniza con BDE o importa CSV.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Valor (%)</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {values.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{fmtDate(v.value_date)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(v.value).toFixed(4)}</TableCell>
                  <TableCell>
                    <Badge variant={v.source === "bde_api" ? "default" : "outline"}>{v.source}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CsvImport({ indexId, onDone }: { indexId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function handle(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter(Boolean);
      const parsed: { index_id: string; value_date: string; value: number; source: "csv" }[] = [];
      for (const line of rows) {
        const [d, v] = line.split(/[,;]/).map((s) => s.trim());
        if (!d || !v) continue;
        const date = parseDate(d);
        const val = parseFloat(v.replace(",", "."));
        if (date && Number.isFinite(val)) parsed.push({ index_id: indexId, value_date: date, value: val, source: "csv" });
      }
      if (parsed.length === 0) {
        toast.error("CSV vacío o formato inválido (esperado: fecha,valor por línea)");
        return;
      }
      const { error } = await supabase.from("index_values").upsert(parsed, { onConflict: "index_id,value_date" });
      if (error) toast.error(error.message);
      else {
        toast.success(`${parsed.length} valores importados`);
        onDone();
        location.reload();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="border rounded p-4 mb-4 bg-accent/30">
      <p className="text-sm mb-2">Sube un CSV con formato <code>fecha,valor</code> por línea (fechas DD/MM/AAAA o AAAA-MM-DD).</p>
      <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      <Button variant="ghost" size="sm" onClick={onDone} className="ml-2">Cerrar</Button>
    </div>
  );
}

function parseDate(s: string): string | null {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
