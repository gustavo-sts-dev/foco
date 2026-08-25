import { formatDate, getGreeting } from "@/lib/utils";

export function Header() {
  return (
    <header className="pt-6">
      <p className="text-sm font-medium text-muted">{formatDate()}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">
        {getGreeting()} 👋
      </h1>
      <p className="mt-1 text-sm text-muted">Organize seu dia com foco</p>
    </header>
  );
}
