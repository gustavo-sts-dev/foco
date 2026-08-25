"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppData } from "@/types";
import { STORAGE_KEY } from "@/types";
import { resetDailyStats } from "@/lib/utils";

const defaultData: AppData = {
  tasks: [],
  focusMinutesToday: 0,
  lastActiveDate: new Date().toISOString().slice(0, 10),
};

export function useAppData() {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppData;
        setData(resetDailyStats(parsed));
      }
    } catch {
      setData(defaultData);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, loaded]);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => resetDailyStats(updater(prev)));
  }, []);

  return { data, update, loaded };
}
