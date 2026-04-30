import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracion")({
  component: () => (
    <AppShell title="Configuración">
      <Settings />
    </AppShell>
  ),
});

function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", colegiado: "", despacho: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) setProfile({ full_name: data.full_name ?? "", colegiado: data.colegiado ?? "", despacho: data.despacho ?? "" });
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update(profile).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil actualizado");
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Datos del perito</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nombre completo</Label>
            <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Nº de colegiado</Label>
            <Input value={profile.colegiado} onChange={(e) => setProfile({ ...profile, colegiado: e.target.value })} />
          </div>
          <div>
            <Label>Despacho</Label>
            <Input value={profile.despacho} onChange={(e) => setProfile({ ...profile, despacho: e.target.value })} />
          </div>
          <Button onClick={save} disabled={busy}>Guardar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
