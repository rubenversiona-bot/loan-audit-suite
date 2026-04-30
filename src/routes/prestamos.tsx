import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/prestamos")({
  component: () => <Outlet />,
});

export { Link };
