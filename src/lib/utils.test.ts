import { describe, expect, it } from "vitest";

import type { AppData } from "@/types";

import { getTaskDate, getTodayKey, resetDailyStats } from "@/lib/utils";

describe("getTaskDate", () => {
  it("prefers the explicit date field when present", () => {
    const task = { date: "2026-08-27", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(getTaskDate(task)).toBe("2026-08-27");
  });

  it("falls back to the local day of createdAt, not the raw UTC slice", () => {
    // Instante que é 27/ago local mas já 28/ago em UTC quando o fuso é negativo.
    const createdAt = new Date(2026, 7, 27, 23, 30).toISOString();
    expect(getTaskDate({ createdAt })).toBe(getTodayKey(new Date(createdAt)));
    expect(getTaskDate({ createdAt })).toBe("2026-08-27");
  });

  it("treats an empty date string as absent", () => {
    const createdAt = new Date(2026, 0, 5, 12, 0).toISOString();
    expect(getTaskDate({ date: "", createdAt })).toBe("2026-01-05");
  });
});

describe("getTodayKey", () => {
  it("returns that same day for a time late at night (23:30), not the next day", () => {
    // Construído com o construtor local, então o teste é estável em qualquer fuso.
    const date = new Date(2026, 7, 27, 23, 30); // 27/ago/2026 23:30 local
    expect(getTodayKey(date)).toBe("2026-08-27");
  });

  it("returns the current day for a time just after midnight (00:05)", () => {
    const date = new Date(2026, 7, 27, 0, 5); // 27/ago/2026 00:05 local
    expect(getTodayKey(date)).toBe("2026-08-27");
  });

  it("zero-pads single-digit month and day", () => {
    const date = new Date(2026, 0, 5, 12, 0); // 05/jan/2026 12:00 local
    expect(getTodayKey(date)).toBe("2026-01-05");
  });

  it("handles the year rollover at 23:59 on Dec 31", () => {
    const date = new Date(2026, 11, 31, 23, 59); // 31/dez/2026 23:59 local
    expect(getTodayKey(date)).toBe("2026-12-31");
  });
});

// Helper para criar AppData de teste sem repetir os campos obrigatórios.
function makeData(overrides: Partial<AppData>): AppData {
  return {
    tasks: [],
    focusMinutesToday: 0,
    lastActiveDate: "2026-06-15",
    dailyMinutes: {},
    ...overrides,
  };
}

describe("resetDailyStats", () => {
  it("returns data unchanged (same content) when lastActiveDate is today", () => {
    const data = makeData({
      lastActiveDate: "2026-06-15",
      focusMinutesToday: 42,
      dailyMinutes: { "2026-06-14": 10 },
    });
    const result = resetDailyStats(data, "2026-06-15");
    expect(result).toEqual(data);
  });

  it("zeroes focusMinutesToday, advances lastActiveDate, and archives the prior day when a new day starts", () => {
    const data = makeData({
      lastActiveDate: "2026-06-14",
      focusMinutesToday: 30,
      dailyMinutes: {},
    });
    const result = resetDailyStats(data, "2026-06-15");
    expect(result).toEqual({
      tasks: [],
      focusMinutesToday: 0,
      lastActiveDate: "2026-06-15",
      dailyMinutes: { "2026-06-14": 30 },
    });
  });

  it("does not create a key in dailyMinutes when the prior day had 0 minutes", () => {
    const data = makeData({
      lastActiveDate: "2026-06-14",
      focusMinutesToday: 0,
      dailyMinutes: { "2026-06-10": 5 },
    });
    const result = resetDailyStats(data, "2026-06-15");
    expect(result.dailyMinutes).toEqual({ "2026-06-10": 5 });
    expect(result.dailyMinutes).not.toHaveProperty("2026-06-14");
  });

  it("preserves pre-existing entries in dailyMinutes when archiving a new one", () => {
    const data = makeData({
      lastActiveDate: "2026-06-14",
      focusMinutesToday: 15,
      dailyMinutes: { "2026-06-10": 5, "2026-06-12": 20 },
    });
    const result = resetDailyStats(data, "2026-06-15");
    expect(result.dailyMinutes).toEqual({
      "2026-06-10": 5,
      "2026-06-12": 20,
      "2026-06-14": 15,
    });
  });

  it("does not mutate the input object on a new day", () => {
    const originalDailyMinutes = { "2026-06-10": 5 };
    const data = makeData({
      lastActiveDate: "2026-06-14",
      focusMinutesToday: 25,
      dailyMinutes: originalDailyMinutes,
    });
    const snapshot = JSON.parse(JSON.stringify(data));
    resetDailyStats(data, "2026-06-15");
    expect(data).toEqual(snapshot);
    // O mapa de dailyMinutes original também não pode ser mutado.
    expect(originalDailyMinutes).toEqual({ "2026-06-10": 5 });
  });

  it("does not mutate the input object on the same day", () => {
    const data = makeData({
      lastActiveDate: "2026-06-15",
      focusMinutesToday: 42,
    });
    const snapshot = JSON.parse(JSON.stringify(data));
    resetDailyStats(data, "2026-06-15");
    expect(data).toEqual(snapshot);
  });

  it("treats an undefined dailyMinutes on the input as {} without breaking", () => {
    const data = {
      tasks: [],
      focusMinutesToday: 20,
      lastActiveDate: "2026-06-14",
    } as unknown as AppData;
    const result = resetDailyStats(data, "2026-06-15");
    expect(result.dailyMinutes).toEqual({ "2026-06-14": 20 });
  });

  it("treats an undefined dailyMinutes on the input as {} on the same-day path too", () => {
    const data = {
      tasks: [],
      focusMinutesToday: 20,
      lastActiveDate: "2026-06-15",
    } as unknown as AppData;
    expect(() => resetDailyStats(data, "2026-06-15")).not.toThrow();
  });

  it("defaults `today` to the current date when not provided", () => {
    const data = makeData({ lastActiveDate: "2026-06-15" });
    // Sem passar `today`, deve usar getTodayKey() internamente e não lançar.
    expect(() => resetDailyStats(data)).not.toThrow();
  });
});
