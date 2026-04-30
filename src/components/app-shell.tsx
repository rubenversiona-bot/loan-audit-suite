import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Protected } from "@/components/protected";

export function AppShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Protected>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 flex items-center border-b bg-card px-3 gap-3">
              <SidebarTrigger />
              {title && <h1 className="text-base font-semibold">{title}</h1>}
            </header>
            <main className="flex-1 p-6 bg-background">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </Protected>
  );
}
