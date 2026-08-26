"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "@/types";
import { resetDailyStats } from "@/lib/utils";

const defaultData: AppData = {
  tasks: [],
  focusMinutesToday: 0,
  lastActiveDate: new Date().toISOString().slice(0, 10),
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
        setData(resetDailyStats(json as AppData));
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
