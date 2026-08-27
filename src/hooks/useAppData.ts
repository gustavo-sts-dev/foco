"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "@/types";
import { getTodayKey, resetDailyStats } from "@/lib/utils";

const defaultData: AppData = {
  tasks: [],
  focusMinutesToday: 0,
  lastActiveDate: getTodayKey(),
  dailyMinutes: {},
};

export function useAppData() {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data from API on mount
  useEffect(() => {
    fetch("/api/data")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((json) => {
        const loadedData = json as AppData;
        // O servidor calcula lastActiveDate/focusMinutesToday com o dia UTC
        // dele, que diverge do dia local do usuário entre 21h e meia-noite
        // no Brasil. Só o navegador conhece o fuso do usuário, então
        // ignoramos esses dois campos vindos da API e os derivamos aqui a
        // partir do mapa dailyMinutes (que é fuso-agnóstico: é só um
        // histórico por chave "YYYY-MM-DD"). Payloads salvos antes da
        // introdução de dailyMinutes não trazem o campo — trata como mapa
        // vazio para não quebrar o resto do fluxo.
        const todayKey = getTodayKey();
        const dailyMinutes = loadedData.dailyMinutes ?? {};
        setData(
          resetDailyStats({
            ...loadedData,
            dailyMinutes,
            focusMinutesToday: dailyMinutes[todayKey] ?? 0,
            lastActiveDate: todayKey,
          })
        );
      })
      .catch(() => {
        setData(defaultData);
      })
      .finally(() => setLoaded(true));
  }, []);

  // Save data to API with debounce to avoid excessive requests
  useEffect(() => {
    if (!loaded) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: data.tasks,
          focusMinutesToday: data.focusMinutesToday,
          date: data.lastActiveDate,
        }),
      }).catch(() => {
        // Silently fail — data is still in memory
      });
    }, 800);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [data, loaded]);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => resetDailyStats(updater(prev)));
  }, []);

  return { data, update, loaded };
}
