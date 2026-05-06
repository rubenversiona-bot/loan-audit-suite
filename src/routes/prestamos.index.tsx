import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eur, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteLoanCascade } from "@/lib/loans";
import { toast } from "sonner";

export const Route = createFileRoute("/prestamos/")({
  component: () => (
    <AppShell title="Préstamos">
      <List />
    </AppShell>
  ),
});

function List() {
  const qc = useQueryClient();
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteLoanCascade(id);
      toast.success("Préstamo eliminado");
      qc.invalidateQueries({ queryKey: ["loans-all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

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
            <Card key={l.id} className="hover:border-primary transition-colors">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start gap-2">
                  <Link to="/prestamos/$id" params={{ id: l.id }} className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{l.debtor_name}</div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {l.bank_name ?? "—"} · Nº {l.loan_number ?? "—"}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={l.status === "borrador" ? "secondary" : "default"}>{l.status}</Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" disabled={deletingId === l.id} aria-label="Eliminar">
                          {deletingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar “{l.debtor_name}”?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se borrarán también todos los eventos, discrepancias, extractos y documentos asociados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(l.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <Link to="/prestamos/$id" params={{ id: l.id }}>
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
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
