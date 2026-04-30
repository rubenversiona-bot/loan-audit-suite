import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/documentos")({
  component: () => (
    <AppShell title="Documentos">
      <Card>
        <CardContent className="pt-6 text-muted-foreground">
          Los documentos de cada préstamo se gestionan desde la ficha del préstamo correspondiente.
        </CardContent>
      </Card>
    </AppShell>
  ),
});
