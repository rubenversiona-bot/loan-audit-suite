import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eur, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/prestamos/")({
  component: () => (
    <AppShell title="Préstamos">
      <List />
    </AppShell>
  ),
});

function List() {
  const { data: loans = [] } = useQuery({
    queryKey: ["loans-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("id, debtor_name, bank_name, loan_number, signed_date, initial_capital, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/prestamos/nuevo">
            <Plus className="h-4 w-4 mr-1" /> Nuevo préstamo
          </Link>
        </Button>
      </div>
      {loans.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            Sin préstamos. Crea el primero para comenzar el análisis pericial.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {loans.map((l) => (
            <Link key={l.id} to="/prestamos/$id" params={{ id: l.id }}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{l.debtor_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {l.bank_name ?? "—"} · Nº {l.loan_number ?? "—"}
                      </div>
                    </div>
                    <Badge variant={l.status === "borrador" ? "secondary" : "default"}>{l.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Capital</div>
                      <div className="font-medium">{eur.format(Number(l.initial_capital))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Firma</div>
                      <div className="font-medium">{fmtDate(l.signed_date)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
