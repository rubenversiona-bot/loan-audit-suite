import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoanForm, emptyLoanForm, formStateToDbPayload, type LoanFormState } from "@/components/loan-form";

export const Route = createFileRoute("/prestamos/nuevo")({
  component: () => (
    <AppShell title="Nuevo préstamo">
      <NewLoan />
    </AppShell>
  ),
});

function NewLoan() {
  const nav = useNavigate();

  async function save(values: LoanFormState) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("loans")
      .insert({
        ...formStateToDbPayload(values),
        owner_id: u.user.id,
        status: "activo",
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("Préstamo creado");
    nav({ to: "/prestamos/$id", params: { id: data.id } });
  }

  return (
    <div className="max-w-4xl">
      <LoanForm
        mode="create"
        initial={emptyLoanForm}
        onSubmit={save}
        onCancel={() => nav({ to: "/prestamos" })}
      />
    </div>
  );
}
