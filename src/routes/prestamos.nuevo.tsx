import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractLoanFromPdf } from "@/server/extract.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/prestamos/nuevo")({
  component: () => (
    <AppShell title="Nuevo préstamo">
      <NewLoan />
    </AppShell>
  ),
});

interface FormState {
  debtor_name: string;
  bank_name: string;
  loan_number: string;
  signed_date: string;
  initial_capital: string;
  term_months: string;
  amort_system: "frances" | "aleman";
  rate_type: "fijo" | "variable" | "mixto";
  initial_tin: string;
  index_id: string;
  spread: string;
  review_period_months: string;
  fixed_period_months: string;
  floor_rate: string;
  ceiling_rate: string;
}

const empty: FormState = {
  debtor_name: "",
  bank_name: "",
  loan_number: "",
  signed_date: "",
  initial_capital: "",
  term_months: "",
  amort_system: "frances",
  rate_type: "variable",
  initial_tin: "",
  index_id: "",
  spread: "",
  review_period_months: "12",
  fixed_period_months: "",
  floor_rate: "",
  ceiling_rate: "",
};

function NewLoan() {
  const nav = useNavigate();
  const extractFn = useServerFn(extractLoanFromPdf);
  const [form, setForm] = useState<FormState>(empty);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const { data: indexes = [] } = useQuery({
    queryKey: ["ref-indexes"],
    queryFn: async () => {
      const { data } = await supabase.from("reference_indexes").select("id, code, name").order("code");
      return data ?? [];
    },
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPdfUpload(file: File) {
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await extractFn({ data: { pdfBase64: b64 } });
      if (!res.ok || !res.suggested) {
        toast.error(res.error ?? "No se pudo extraer");
        return;
      }
      const s = res.suggested;
      const ai = new Set<string>();
      const next = { ...form };
      for (const [k, v] of Object.entries(s)) {
        if (v == null || v === "") continue;
        if (k === "index_code") {
          const idx = indexes.find((i) => i.code === v);
          if (idx) {
            next.index_id = idx.id;
            ai.add("index_id");
          }
          continue;
        }
        if (k in next) {
          (next as unknown as Record<string, string>)[k] = String(v);
          ai.add(k);
        }
      }
      setForm(next);
      setAiFields(ai);
      toast.success("Datos sugeridos por IA. Revisa y confirma.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setExtracting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from("loans")
      .insert({
        owner_id: u.user.id,
        debtor_name: form.debtor_name,
        bank_name: form.bank_name || null,
        loan_number: form.loan_number || null,
        signed_date: form.signed_date,
        initial_capital: Number(form.initial_capital),
        term_months: Number(form.term_months),
        amort_system: form.amort_system,
        rate_type: form.rate_type,
        initial_tin: form.initial_tin ? Number(form.initial_tin) : null,
        index_id: form.index_id || null,
        spread: form.spread ? Number(form.spread) : null,
        review_period_months: form.review_period_months ? Number(form.review_period_months) : null,
        fixed_period_months: form.fixed_period_months ? Number(form.fixed_period_months) : null,
        floor_rate: form.floor_rate ? Number(form.floor_rate) : null,
        ceiling_rate: form.ceiling_rate ? Number(form.ceiling_rate) : null,
        status: "activo",
      })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Préstamo creado");
    nav({ to: "/prestamos/$id", params: { id: data.id } });
  }

  const aiBadge = (k: string) =>
    aiFields.has(k) ? (
      <Badge variant="outline" className="ml-2 text-xs">
        <Sparkles className="h-3 w-3 mr-1" /> IA
      </Badge>
    ) : null;

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Extracción asistida (opcional)</CardTitle>
          <CardDescription>Sube el contrato o escritura en PDF y la IA propondrá los datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="pdf" className="cursor-pointer">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/50">
              {extracting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="text-sm mt-2">Analizando documento…</p>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm mt-2">Haz clic para seleccionar PDF</p>
                </>
              )}
            </div>
            <input
              id="pdf"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPdfUpload(e.target.files[0])}
            />
          </Label>
        </CardContent>
      </Card>

      <form onSubmit={save}>
        <Card>
          <CardHeader>
            <CardTitle>Datos del préstamo</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Field label="Deudor" badge={aiBadge("debtor_name")}>
              <Input required value={form.debtor_name} onChange={(e) => set("debtor_name", e.target.value)} />
            </Field>
            <Field label="Entidad bancaria" badge={aiBadge("bank_name")}>
              <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
            </Field>
            <Field label="Nº de préstamo" badge={aiBadge("loan_number")}>
              <Input value={form.loan_number} onChange={(e) => set("loan_number", e.target.value)} />
            </Field>
            <Field label="Fecha de firma" badge={aiBadge("signed_date")}>
              <Input type="date" required value={form.signed_date} onChange={(e) => set("signed_date", e.target.value)} />
            </Field>
            <Field label="Capital inicial (€)" badge={aiBadge("initial_capital")}>
              <Input type="number" step="0.01" required value={form.initial_capital} onChange={(e) => set("initial_capital", e.target.value)} />
            </Field>
            <Field label="Plazo (meses)" badge={aiBadge("term_months")}>
              <Input type="number" required value={form.term_months} onChange={(e) => set("term_months", e.target.value)} />
            </Field>
            <Field label="Sistema de amortización">
              <Select value={form.amort_system} onValueChange={(v) => set("amort_system", v as "frances" | "aleman")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="frances">Francés (cuota constante)</SelectItem>
                  <SelectItem value="aleman">Alemán (capital constante)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de interés">
              <Select value={form.rate_type} onValueChange={(v) => set("rate_type", v as FormState["rate_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fijo">Fijo</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                  <SelectItem value="mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="TIN inicial (%)" badge={aiBadge("initial_tin")}>
              <Input type="number" step="0.001" value={form.initial_tin} onChange={(e) => set("initial_tin", e.target.value)} />
            </Field>
            {form.rate_type !== "fijo" && (
              <>
                <Field label="Índice de referencia" badge={aiBadge("index_id")}>
                  <Select value={form.index_id} onValueChange={(v) => set("index_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {indexes.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Diferencial (%)" badge={aiBadge("spread")}>
                  <Input type="number" step="0.001" value={form.spread} onChange={(e) => set("spread", e.target.value)} />
                </Field>
                <Field label="Periodo revisión (meses)">
                  <Input type="number" value={form.review_period_months} onChange={(e) => set("review_period_months", e.target.value)} />
                </Field>
              </>
            )}
            {form.rate_type === "mixto" && (
              <Field label="Periodo fijo inicial (meses)" badge={aiBadge("fixed_period_months")}>
                <Input type="number" value={form.fixed_period_months} onChange={(e) => set("fixed_period_months", e.target.value)} />
              </Field>
            )}
            <Field label="Cláusula suelo (%)" badge={aiBadge("floor_rate")}>
              <Input type="number" step="0.001" value={form.floor_rate} onChange={(e) => set("floor_rate", e.target.value)} />
            </Field>
            <Field label="Cláusula techo (%)" badge={aiBadge("ceiling_rate")}>
              <Input type="number" step="0.001" value={form.ceiling_rate} onChange={(e) => set("ceiling_rate", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => nav({ to: "/prestamos" })}>Cancelar</Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar préstamo
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center">
        {label}
        {badge}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
