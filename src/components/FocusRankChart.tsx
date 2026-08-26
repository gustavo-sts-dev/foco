"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { Task } from "@/types";

type Props = {
  tasks: Task[];
  hideContainer?: boolean;
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}`;
}

// Valor fixo no fim da barra — dispensa o tooltip flutuante, que cobria a barra
function ValueLabel({ viewBox, value, index }: any) {
  const { x, y, width, height } = viewBox;
  const isTop = index === 0;
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      textAnchor="start"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={isTop ? 600 : 500}
      fill={isTop ? "var(--accent)" : "var(--muted)"}
    >
      {formatDuration(value)}
    </text>
  );
}

export function FocusRankChart({ tasks, hideContainer = false }: Props) {
  const ranked = tasks
    .filter((t) => (t.focusedMinutes ?? 0) > 0)
    .sort((a, b) => (b.focusedMinutes ?? 0) - (a.focusedMinutes ?? 0))
    .slice(0, 8)
    .map((t, i) => ({
      ...t,
      label: t.title.length > 16 ? t.title.slice(0, 15) + "…" : t.title,
      rank: i + 1,
    }));

  if (ranked.length === 0) {
    return null;
  }

  const accent = "var(--accent)";
  const accentMuted = "var(--accent-muted)";

  // Tick em linha única: o padrão do Recharts quebra títulos longos em duas linhas
  const renderTick = ({ x, y, payload }: any) => (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="central"
      fontSize={12}
      fill="var(--foreground)"
    >
      <title>{ranked[payload.index]?.title ?? payload.value}</title>
      {payload.value}
    </text>
  );

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
          margin={{ top: 0, right: 52, left: 0, bottom: 0 }}
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
            width={112}
            tick={renderTick}
            tickLine={false}
            axisLine={false}
          />
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
            <LabelList dataKey="focusedMinutes" content={<ValueLabel />} />
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
