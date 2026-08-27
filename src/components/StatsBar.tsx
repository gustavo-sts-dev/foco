import { formatMinutes } from "@/lib/utils";

type StatsBarProps = {
  focusMinutes: number;
  completedCount: number;
  remainingMinutes: number;
};

export function StatsBar({ focusMinutes, completedCount, remainingMinutes }: StatsBarProps) {
  const stats = [
    { label: "Foco hoje", value: formatMinutes(focusMinutes) },
    { label: "Concluídas", value: String(completedCount) },
    { label: "Restante", value: formatMinutes(remainingMinutes) },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[var(--radius-lg)] bg-card px-3 py-3 text-center shadow-[var(--shadow)]"
        >
          <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
          <p className="mt-0.5 text-xs text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
