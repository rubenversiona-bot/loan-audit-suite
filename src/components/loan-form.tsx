import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

export interface LoanFormState {
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
  index_lookback_months: string;
}

export const emptyLoanForm: LoanFormState = {
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
  index_lookback_months: "2",
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;

interface Props {
  mode: "create" | "edit";
  initial: LoanFormState;
  onSubmit: (values: LoanFormState) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function LoanForm({ mode, initial, onSubmit, onCancel, submitLabel }: Props) {
  const extractFn = useServerFn(extractLoanFromPdf);
  const [form, setForm] = useState<LoanFormState>(initial);
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

  function set<K extends keyof LoanFormState>(k: K, v: LoanFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPdfUpload(file: File) {
    if (file.size > MAX_PDF_BYTES) {
      toast.error(`El archivo supera el límite de 25 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    setExtracting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sesión no válida");
        return;
      }
      const path = `${u.user.id}/tmp-extract/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from("loan-documents").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) {
        toast.error(`Error subiendo PDF: ${up.error.message}`);
        return;
      }
      const res = await extractFn({ data: { storagePath: path } });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  }

  const aiBadge = (k: string) =>
    aiFields.has(k) ? (
      <Badge variant="outline" className="ml-2 text-xs">
        <Sparkles className="h-3 w-3 mr-1" /> IA
      </Badge>
    ) : null;

  return (
    <div className="space-y-4">
      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>Extracción asistida (opcional)</CardTitle>
            <CardDescription>Sube el contrato o escritura en PDF (máx. 25 MB) y la IA propondrá los datos.</CardDescription>
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (f) onPdfUpload(f);
                }}
              />
            </Label>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
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
              <Select value={form.rate_type} onValueChange={(v) => set("rate_type", v as LoanFormState["rate_type"])}>
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
                <Field label="Desfase del índice" badge={aiBadge("index_lookback_months")}>
                  <Select
                    value={form.index_lookback_months || "2"}
                    onValueChange={(v) => set("index_lookback_months", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mes anterior a la revisión</SelectItem>
                      <SelectItem value="2">2 meses anteriores a la revisión</SelectItem>
                    </SelectContent>
                  </Select>
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
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel ?? (mode === "create" ? "Guardar préstamo" : "Guardar cambios")}
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

export function loanRowToFormState(l: Record<string, unknown>): LoanFormState {
  const v = (k: string) => {
    const x = l[k];
    return x == null ? "" : String(x);
  };
  return {
    debtor_name: v("debtor_name"),
    bank_name: v("bank_name"),
    loan_number: v("loan_number"),
    signed_date: v("signed_date"),
    initial_capital: v("initial_capital"),
    term_months: v("term_months"),
    amort_system: (l.amort_system as "frances" | "aleman") ?? "frances",
    rate_type: (l.rate_type as "fijo" | "variable" | "mixto") ?? "variable",
    initial_tin: v("initial_tin"),
    index_id: v("index_id"),
    spread: v("spread"),
    review_period_months: v("review_period_months"),
    fixed_period_months: v("fixed_period_months"),
    floor_rate: v("floor_rate"),
    ceiling_rate: v("ceiling_rate"),
    index_lookback_months: v("index_lookback_months") || "2",
  };
}

export function formStateToDbPayload(f: LoanFormState) {
  return {
    debtor_name: f.debtor_name,
    bank_name: f.bank_name || null,
    loan_number: f.loan_number || null,
    signed_date: f.signed_date,
    initial_capital: Number(f.initial_capital),
    term_months: Number(f.term_months),
    amort_system: f.amort_system,
    rate_type: f.rate_type,
    initial_tin: f.initial_tin ? Number(f.initial_tin) : null,
    index_id: f.index_id || null,
    spread: f.spread ? Number(f.spread) : null,
    review_period_months: f.review_period_months ? Number(f.review_period_months) : null,
    fixed_period_months: f.fixed_period_months ? Number(f.fixed_period_months) : null,
    floor_rate: f.floor_rate ? Number(f.floor_rate) : null,
    ceiling_rate: f.ceiling_rate ? Number(f.ceiling_rate) : null,
    index_lookback_months: f.index_lookback_months ? Number(f.index_lookback_months) : 2,
  };
}
