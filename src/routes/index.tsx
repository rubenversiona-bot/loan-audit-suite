import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Scale, Calculator, FileSearch, Banknote, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <span className="font-semibold">Pericia Hipotecaria</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" } as never}>
                Crear cuenta
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium tracking-wide uppercase mb-6">
          Auditoría hipotecaria profesional
        </span>
        <h1 className="text-5xl font-bold tracking-tight max-w-3xl mx-auto" style={{ fontFamily: "var(--font-serif)" }}>
          Recálculo pericial de hipotecas con rigor judicial
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Detecta cláusulas abusivas, recalcula cuadros de amortización y compara movimientos bancarios.
          Autocarga de Euríbor e IRPH del Banco de España. Informe pericial en PDF listo para presentar.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" } as never}>
              Empezar análisis
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Ya tengo cuenta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: Calculator, t: "Motor de cálculo riguroso", d: "Sistema francés y alemán, fijo, variable y mixto. Recalcula con cada evento del préstamo." },
          { icon: FileSearch, t: "Extracción asistida por IA", d: "Sube el contrato y la IA propone los datos. Tú revisas y confirmas antes de guardar." },
          { icon: Banknote, t: "Comparación bancaria", d: "Carga extractos en CSV, XLSX o PDF. Conciliación automática y tabla de discrepancias." },
          { icon: ShieldCheck, t: "Cláusulas abusivas", d: "Detección de cláusula suelo activa y comparativa IRPH vs Euríbor." },
          { icon: FileText, t: "Informe pericial PDF", d: "Carátula, metodología, cuadros, gráficos, conclusión. Listo para juzgado." },
          { icon: Scale, t: "Banco de España", d: "Autocarga oficial de Euríbor 12M/6M/3M/1M e IRPH (Cajas, Bancos, Conjunto)." },
        ].map((f) => (
          <div key={f.t} className="rounded-lg border bg-card p-6">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pericia Hipotecaria. Herramienta para profesionales LegalTech.
      </footer>
    </div>
  );
}
