import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

import appCss from "../styles.css?url";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">La página que buscas no existe.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pericia Hipotecaria — Auditoría y ajuste de saldos" },
      {
        name: "description",
        content:
          "Herramienta profesional para peritos: recálculo de cuadros de amortización, detección de cláusulas abusivas (IRPH, suelo) y reportes periciales en PDF.",
      },
      { property: "og:title", content: "Pericia Hipotecaria — Auditoría y ajuste de saldos" },
      { property: "og:description", content: "Mortgage audit and balance adjustment tool for LegalTech professionals." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Pericia Hipotecaria — Auditoría y ajuste de saldos" },
      { name: "description", content: "Mortgage audit and balance adjustment tool for LegalTech professionals." },
      { name: "twitter:description", content: "Mortgage audit and balance adjustment tool for LegalTech professionals." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/adfd3d87-bb9f-4818-b568-46a2d4cb1873/id-preview-67d10405--3e45df6d-2e79-4515-bf27-90eaaf8c236a.lovable.app-1777561325685.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/adfd3d87-bb9f-4818-b568-46a2d4cb1873/id-preview-67d10405--3e45df6d-2e79-4515-bf27-90eaaf8c236a.lovable.app-1777561325685.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
