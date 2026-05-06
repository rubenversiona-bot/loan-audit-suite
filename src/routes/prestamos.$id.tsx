import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { eur, fmtDate, pct } from "@/lib/format";
import { generateSchedule, totalInterest, type LoanInput, type IndexValuePoint } from "@/lib/mortgage/calculator";
import { generateExpertReport } from "@/server/report.functions";
import { extractFromDocument } from "@/server/extract.functions";
import { Loader2, FileDown, AlertTriangle, Trash2, Upload, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { LoanForm, loanRowToFormState, formStateToDbPayload, type LoanFormState } from "@/components/loan-form";
import { deleteLoanCascade } from "@/lib/loans";
import {
  LOAN_DOC_TYPES, type LoanDocType,
  uploadLoanDocument, deleteLoanDocument, getDocumentSignedUrl,
} from "@/lib/loan-documents";
import { PdfViewer } from "@/components/pdf-viewer";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

export const Route = createFileRoute("/prestamos/$id")({
  component: () => (
    <AppShell title="Análisis de préstamo">
      <Detail />
    </AppShell>
  ),
});

function Detail() {
  const { id } = useParams({ from: "/prestamos/$id" });
  const nav = useNavigate();
  const reportFn = useServerFn(generateExpertReport);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: loan } = useQuery({
    queryKey: ["loan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("loans").select("*, reference_indexes(name, code)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      const { data } = await supabase.from("loan_events").select("*").eq("loan_id", id).order("event_date");
      return data ?? [];
    },
  });

  const { data: discs = [] } = useQuery({
    queryKey: ["discs", id],
    queryFn: async () => {
      const { data } = await supabase.from("discrepancies").select("*").eq("loan_id", id).order("discrepancy_date");
      return data ?? [];
    },
  });

  const indexId = (loan as { index_id?: string | null } | null | undefined)?.index_id ?? null;
  const { data: indexValues = [] } = useQuery({
    queryKey: ["index-values", indexId],
    enabled: !!indexId,
    queryFn: async () => {
      const { data } = await supabase
        .from("index_values")
        .select("value_date, value")
        .eq("index_id", indexId!)
        .order("value_date");
      return data ?? [];
    },
  });

  const { data: bankRows = [] } = useQuery({
    queryKey: ["bank-amort", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_amortization_rows")
        .select("period, payment, interest, principal, balance, rate")
        .eq("loan_id", id)
        .order("period");
      return data ?? [];
    },
  });

  if (!loan) return <Loader2 className="h-6 w-6 animate-spin" />;
  const loanData = loan;

  const indexHistory: IndexValuePoint[] = indexValues.map((v) => ({
    date: new Date(v.value_date),
    value: Number(v.value),
  }));

  const schedule = generateSchedule({
    initialCapital: Number(loan.initial_capital),
    termMonths: loan.term_months,
    signedDate: new Date(loan.signed_date),
    amortSystem: loan.amort_system,
    rateType: loan.rate_type,
    initialTin: Number(loan.initial_tin ?? 0),
    floorRate: loan.floor_rate ? Number(loan.floor_rate) : null,
    ceilingRate: loan.ceiling_rate ? Number(loan.ceiling_rate) : null,
    spread: loan.spread != null ? Number(loan.spread) : 0,
    reviewPeriodMonths: loan.review_period_months ?? 12,
    fixedPeriodMonths: loan.fixed_period_months ?? 0,
    lookbackMonths: (loan as { index_lookback_months?: number }).index_lookback_months ?? 2,
    indexValues: indexHistory,
  } as LoanInput);

  const bankByPeriod = new Map<number, (typeof bankRows)[number]>();
  for (const r of bankRows) bankByPeriod.set(r.period, r);
  const hasBank = bankRows.length > 0;

  const totalDelta = discs.reduce((s, d) => s + Number(d.delta), 0);

  const chartDisc = discs.map((d) => ({
    fecha: d.discrepancy_date,
    delta: Number(d.delta),
  }));

  async function downloadReport() {
    setDownloading(true);
    try {
      const r = await reportFn({ data: { loanId: id } });
      if (!r.ok || !r.base64) {
        toast.error(r.error ?? "Error generando informe");
        return;
      }
      const blob = b64ToBlob(r.base64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe-pericial-${loanData.debtor_name.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Informe descargado");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-7xl space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{loan.debtor_name}</h2>
              <div className="text-sm text-muted-foreground">
                {loan.bank_name ?? "—"} · Nº {loan.loan_number ?? "—"} · Firma {fmtDate(loan.signed_date)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {loan.floor_rate != null && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Cláusula suelo
                </Badge>
              )}
              <Badge>{loan.amort_system} · {loan.rate_type}</Badge>
              <Button onClick={downloadReport} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
                Generar informe pericial
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar este préstamo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrarán también todos los eventos, discrepancias, extractos y documentos asociados. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          await deleteLoanCascade(id);
                          toast.success("Préstamo eliminado");
                          nav({ to: "/prestamos" });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Error al eliminar");
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      Eliminar definitivamente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="cuadro">Cuadro recalculado</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="discrepancias">Discrepancias</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <EditLoanTab id={id} loan={loan as Record<string, unknown>} />
        </TabsContent>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Stat label="Capital inicial" value={eur.format(Number(loan.initial_capital))} />
            <Stat label="Total intereses (recalc.)" value={eur.format(totalInterest(schedule))} />
            <Stat label="Importe reclamable" value={eur.format(totalDelta)} highlight={totalDelta > 0} />
          </div>
          <Card>
            <CardHeader><CardTitle>Discrepancias por fecha</CardTitle></CardHeader>
            <CardContent className="h-72">
              {chartDisc.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin discrepancias registradas.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDisc}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="delta" fill="var(--color-chart-4)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cuadro">
          <Card>
            <CardHeader>
              <CardTitle>Cuadro de amortización recalculado ({schedule.length} cuotas)</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-muted border-l-2 border-l-primary/60" />
                Periodos de revisión del tipo
                {hasBank && (
                  <>
                    <span className="ml-4">·</span>
                    <span>Δ vs cuadro del banco</span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">TIN</TableHead>
                    <TableHead className="text-right">Cuota</TableHead>
                    <TableHead className="text-right">Interés</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    {hasBank && <TableHead className="text-right">Banco</TableHead>}
                    {hasBank && <TableHead className="text-right">Δ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((r) => {
                    const bank = bankByPeriod.get(r.period);
                    const delta =
                      bank && bank.payment != null ? r.payment - Number(bank.payment) : null;
                    return (
                      <TableRow
                        key={r.period}
                        className={cn(
                          r.isRevision &&
                            "bg-muted/60 hover:bg-muted border-l-2 border-l-primary/60 font-medium",
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{r.period}</span>
                            {r.isRevision && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                Revisión
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{fmtDate(r.date)}</TableCell>
                        <TableCell className="text-right">
                          {pct(r.rateAnnual)}
                          {r.indexValue != null && (
                            <span className="block text-[10px] text-muted-foreground">
                              índice {pct(r.indexValue)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{eur.format(r.payment)}</TableCell>
                        <TableCell className="text-right">{eur.format(r.interest)}</TableCell>
                        <TableCell className="text-right">{eur.format(r.principal)}</TableCell>
                        <TableCell className="text-right">{eur.format(r.balance)}</TableCell>
                        {hasBank && (
                          <TableCell className="text-right">
                            {bank?.payment != null ? eur.format(Number(bank.payment)) : "—"}
                          </TableCell>
                        )}
                        {hasBank && (
                          <TableCell
                            className={cn(
                              "text-right",
                              delta != null && Math.abs(delta) > 1 && delta > 0 && "text-destructive",
                              delta != null && Math.abs(delta) > 1 && delta < 0 && "text-emerald-600",
                            )}
                          >
                            {delta != null ? eur.format(delta) : "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader><CardTitle>Capital pendiente</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={schedule.map((r) => ({ p: r.period, capital: r.balance }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="p" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="capital" stroke="var(--color-chart-1)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eventos">
          <EventsTab loanId={id} events={events} />
        </TabsContent>

        <TabsContent value="discrepancias">
          <DiscsTab loanId={id} discs={discs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${highlight ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function EventsTab({ loanId, events }: { loanId: string; events: { id: string; event_date: string; event_type: string; amount: number | null; description: string | null }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Eventos del préstamo</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>Añadir evento</Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin eventos.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{fmtDate(e.event_date)}</TableCell>
                  <TableCell><Badge variant="outline">{e.event_type}</Badge></TableCell>
                  <TableCell className="text-right">{e.amount ? eur.format(Number(e.amount)) : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {open && <NewEventForm loanId={loanId} onDone={() => setOpen(false)} />}
      </CardContent>
    </Card>
  );
}

function NewEventForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const [form, setForm] = useState({ event_date: "", event_type: "pago_programado", amount: "", description: "" });
  async function save() {
    const { error } = await supabase.from("loan_events").insert({
      loan_id: loanId,
      event_date: form.event_date,
      event_type: form.event_type as never,
      amount: form.amount ? Number(form.amount) : null,
      description: form.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Evento añadido");
    onDone();
    location.reload();
  }
  return (
    <div className="border rounded-md p-4 mt-4 grid md:grid-cols-4 gap-2">
      <input type="date" className="border rounded px-2 py-1" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
      <select className="border rounded px-2 py-1" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
        <option value="pago_programado">Pago programado</option>
        <option value="amortizacion_anticipada">Amortización anticipada</option>
        <option value="cambio_tasa">Cambio de tasa</option>
        <option value="comision">Comisión</option>
        <option value="mora">Mora</option>
        <option value="novacion">Novación</option>
      </select>
      <input type="number" placeholder="Importe" className="border rounded px-2 py-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      <input placeholder="Descripción" className="border rounded px-2 py-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="md:col-span-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>
        <Button size="sm" onClick={save}>Guardar</Button>
      </div>
    </div>
  );
}

function DiscsTab({ loanId, discs }: { loanId: string; discs: { id: string; discrepancy_date: string; category: string; description: string | null; delta: number; in_favor_of: string | null }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Discrepancias</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>Añadir discrepancia</Button>
      </CardHeader>
      <CardContent>
        {discs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin discrepancias.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Δ Importe</TableHead>
                <TableHead>A favor de</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{fmtDate(d.discrepancy_date)}</TableCell>
                  <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{eur.format(Number(d.delta))}</TableCell>
                  <TableCell>{d.in_favor_of ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {open && <NewDiscForm loanId={loanId} onDone={() => setOpen(false)} />}
      </CardContent>
    </Card>
  );
}

function NewDiscForm({ loanId, onDone }: { loanId: string; onDone: () => void }) {
  const [form, setForm] = useState({ discrepancy_date: "", category: "interes_excedente", delta: "", in_favor_of: "deudor", description: "" });
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("discrepancies").insert({
      loan_id: loanId,
      owner_id: u.user!.id,
      discrepancy_date: form.discrepancy_date,
      category: form.category as never,
      delta: Number(form.delta),
      in_favor_of: form.in_favor_of,
      description: form.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Discrepancia añadida");
    onDone();
    location.reload();
  }
  return (
    <div className="border rounded-md p-4 mt-4 grid md:grid-cols-5 gap-2">
      <input type="date" className="border rounded px-2 py-1" value={form.discrepancy_date} onChange={(e) => setForm({ ...form, discrepancy_date: e.target.value })} />
      <select className="border rounded px-2 py-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
        <option value="interes_excedente">Interés excedente</option>
        <option value="comision_indebida">Comisión indebida</option>
        <option value="capital_mal_aplicado">Capital mal aplicado</option>
        <option value="irph_vs_euribor">IRPH vs Euríbor</option>
        <option value="clausula_suelo">Cláusula suelo</option>
        <option value="otro">Otro</option>
      </select>
      <input type="number" step="0.01" placeholder="Δ €" className="border rounded px-2 py-1" value={form.delta} onChange={(e) => setForm({ ...form, delta: e.target.value })} />
      <select className="border rounded px-2 py-1" value={form.in_favor_of} onChange={(e) => setForm({ ...form, in_favor_of: e.target.value })}>
        <option value="deudor">A favor del deudor</option>
        <option value="banco">A favor del banco</option>
      </select>
      <input placeholder="Descripción" className="border rounded px-2 py-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="md:col-span-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>
        <Button size="sm" onClick={save}>Guardar</Button>
      </div>
    </div>
  );
}

function b64ToBlob(b64: string, type: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}

function EditLoanTab({ id, loan }: { id: string; loan: Record<string, unknown> }) {
  const initial = loanRowToFormState(loan);
  async function handleSave(values: LoanFormState) {
    const { error } = await supabase
      .from("loans")
      .update(formStateToDbPayload(values))
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Préstamo actualizado");
    location.reload();
  }
  return <LoanForm mode="edit" initial={initial} onSubmit={handleSave} />;
}
