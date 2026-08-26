"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Task } from "@/types";

type Props = {
  tasks: Task[];
  hideContainer?: boolean;
};

// Custom tooltip
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { title, focusedMinutes } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-[var(--shadow-md)]">
      <p className="font-medium">{title}</p>
      <p className="text-muted">
        {focusedMinutes >= 60
          ? `${Math.floor(focusedMinutes / 60)}h ${focusedMinutes % 60}min`
          : `${focusedMinutes}min`}
      </p>
    </div>
  );
}

export function FocusRankChart({ tasks, hideContainer = false }: Props) {
  const ranked = tasks
    .filter((t) => (t.focusedMinutes ?? 0) > 0)
    .sort((a, b) => (b.focusedMinutes ?? 0) - (a.focusedMinutes ?? 0))
    .slice(0, 8)
    .map((t, i) => ({
      ...t,
      label:
        t.title.length > 18 ? t.title.slice(0, 16) + "…" : t.title,
      rank: i + 1,
    }));

  if (ranked.length === 0) {
    return null;
  }

  const accent = "var(--accent)";
  const accentMuted = "var(--accent-muted)";

  const content = (
    <>
      {!hideContainer && (
        <div className="mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <h3 className="text-sm font-semibold">Ranking de Foco</h3>
          <span className="ml-auto text-xs text-muted">minutos acumulados</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={ranked.length * 44 + 8}>
        <BarChart
          data={ranked}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            hide
            domain={[0, "dataMax"]}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Bar
            dataKey="focusedMinutes"
            radius={[0, 6, 6, 0]}
            minPointSize={4}
          >
            {ranked.map((entry, i) => (
              <Cell
                key={entry.id}
                fill={i === 0 ? accent : accentMuted}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );

  if (hideContainer) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow)]">
      {content}
    </div>
  );
}
