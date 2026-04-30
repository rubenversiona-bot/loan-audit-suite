import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, TrendingUp, AlertTriangle } from "lucide-react";
import { eur, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({ component: () => <AppShell title="Dashboard"><Dashboard /></AppShell> });

function Dashboard() {
  const { data: loans = [] } = useQuery({
    queryKey: ["loans-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("id, debtor_name, bank_name, signed_date, initial_capital, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: discCount = 0 } = useQuery({
    queryKey: ["disc-count"],
    queryFn: async () => {
      const { count } = await supabase.from("discrepancies").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: discSum = 0 } = useQuery({
    queryKey: ["disc-sum"],
    queryFn: async () => {
      const { data } = await supabase.from("discrepancies").select("delta");
      return (data ?? []).reduce((s, r) => s + Number(r.delta), 0);
    },
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Préstamos" value={String(loans.length)} />
        <StatCard icon={AlertTriangle} label="Discrepancias detectadas" value={String(discCount)} />
        <StatCard icon={TrendingUp} label="Importe reclamable agregado" value={eur.format(discSum)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Préstamos recientes</CardTitle>
          <Button asChild size="sm">
            <Link to="/prestamos/nuevo">
              <Plus className="h-4 w-4 mr-1" /> Nuevo préstamo
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aún no has creado ningún préstamo.</p>
              <Button asChild className="mt-4">
                <Link to="/prestamos/nuevo">Crear el primero</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {loans.map((l) => (
                <Link
                  key={l.id}
                  to="/prestamos/$id"
                  params={{ id: l.id }}
                  className="flex items-center justify-between py-3 hover:bg-accent/50 -mx-2 px-2 rounded"
                >
                  <div>
                    <div className="font-medium">{l.debtor_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.bank_name ?? "—"} · {fmtDate(l.signed_date)} · {eur.format(Number(l.initial_capital))}
                    </div>
                  </div>
                  <Badge variant={l.status === "borrador" ? "secondary" : "default"}>{l.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
