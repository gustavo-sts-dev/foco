import { describe, expect, it } from "vitest";

import type { Task } from "@/types";

import {
  describeEstimateAccuracy,
  estimateAccuracy,
  focusStreak,
  lastSevenDays,
  MIN_ESTIMATE_SAMPLE,
  remainingPlannedMinutes,
  shiftDate,
} from "@/lib/insights";

// Helper para criar tasks de teste sem repetir os campos obrigatórios.
function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "id",
    title: "task",
    minutes: 0,
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("remainingPlannedMinutes", () => {
  it("returns 0 for an empty array", () => {
    expect(remainingPlannedMinutes([])).toBe(0);
  });

  it("returns 0 when every task is completed", () => {
    const tasks = [
      makeTask({ minutes: 30, completed: true, focusedMinutes: 0 }),
      makeTask({ minutes: 20, completed: true }),
    ];
    expect(remainingPlannedMinutes(tasks)).toBe(0);
  });

  it("treats undefined focusedMinutes as 0", () => {
    const tasks = [makeTask({ minutes: 25, completed: false })];
    expect(remainingPlannedMinutes(tasks)).toBe(25);
  });

  it("clamps a task whose focusedMinutes exceeds minutes to 0 without reducing the total", () => {
    const tasks = [
      makeTask({ minutes: 25, focusedMinutes: 40, completed: false }),
      makeTask({ minutes: 20, focusedMinutes: 5, completed: false }),
    ];
    // A primeira task já passou do planejado (25 -> 40): contribui 0, não -15.
    expect(remainingPlannedMinutes(tasks)).toBe(15);
  });

  it("sums remaining minutes across a normal mixed case", () => {
    const tasks = [
      makeTask({ minutes: 25, focusedMinutes: 10, completed: false }), // 15
      makeTask({ minutes: 40, completed: true }), // excluída (concluída)
      makeTask({ minutes: 10, completed: false }), // 10, focusedMinutes ausente
      makeTask({ minutes: 60, focusedMinutes: 60, completed: false }), // 0
    ];
    expect(remainingPlannedMinutes(tasks)).toBe(25);
  });
});

describe("estimateAccuracy", () => {
  it("exports MIN_ESTIMATE_SAMPLE as 5", () => {
    expect(MIN_ESTIMATE_SAMPLE).toBe(5);
  });

  it("returns null when fewer than MIN_ESTIMATE_SAMPLE tasks qualify", () => {
    const tasks = [1, 2, 3, 4].map(() =>
      makeTask({ minutes: 10, focusedMinutes: 10, completed: true })
    );
    expect(estimateAccuracy(tasks)).toBeNull();
  });

  it("returns a result once exactly 5 tasks qualify", () => {
    const tasks = [1, 2, 3, 4, 5].map(() =>
      makeTask({ minutes: 10, focusedMinutes: 10, completed: true })
    );
    expect(estimateAccuracy(tasks)).toEqual({ ratio: 1, sample: 5 });
  });

  it("ignores pending tasks with real time even when there are many of them", () => {
    const qualifying = [1, 2, 3, 4, 5].map(() =>
      makeTask({ minutes: 20, focusedMinutes: 30, completed: true })
    );
    // Tarefas pendentes ainda vão acumular tempo, então não podem contaminar a amostra
    // nem o ratio, mesmo que sejam numerosas e tenham focusedMinutes alto.
    const pendingWithTime = Array.from({ length: 10 }, () =>
      makeTask({ minutes: 5, focusedMinutes: 500, completed: false })
    );
    const result = estimateAccuracy([...qualifying, ...pendingWithTime]);
    expect(result).toEqual({ ratio: 1.5, sample: 5 });
  });

  it("ignores completed tasks with focusedMinutes 0 or absent", () => {
    const qualifying = [1, 2, 3, 4, 5].map(() =>
      makeTask({ minutes: 10, focusedMinutes: 10, completed: true })
    );
    const nonQualifying = [
      makeTask({ minutes: 10, focusedMinutes: 0, completed: true }),
      makeTask({ minutes: 10, completed: true }), // focusedMinutes ausente
    ];
    const result = estimateAccuracy([...qualifying, ...nonQualifying]);
    expect(result).toEqual({ ratio: 1, sample: 5 });
  });

  it("excludes a completed task with minutes 0 and never divides by zero", () => {
    const qualifying = [1, 2, 3, 4, 5].map(() =>
      makeTask({ minutes: 20, focusedMinutes: 20, completed: true })
    );
    const zeroMinutesTask = makeTask({
      minutes: 0,
      focusedMinutes: 100,
      completed: true,
    });
    const result = estimateAccuracy([...qualifying, zeroMinutesTask]);
    expect(result).toEqual({ ratio: 1, sample: 5 });
  });

  it("computes a known ratio of 1.5 (underestimates: spends more than planned)", () => {
    const tasks = [1, 2, 3, 4, 5].map(() =>
      makeTask({ minutes: 20, focusedMinutes: 30, completed: true })
    );
    // soma minutes=100, soma focusedMinutes=150 -> ratio=1.5
    expect(estimateAccuracy(tasks)).toEqual({ ratio: 1.5, sample: 5 });
  });

  it("computes a ratio below 1 when the user overestimates", () => {
    const tasks = [1, 2, 3, 4, 5].map(() =>
      makeTask({ minutes: 20, focusedMinutes: 10, completed: true })
    );
    // soma minutes=100, soma focusedMinutes=50 -> ratio=0.5
    expect(estimateAccuracy(tasks)).toEqual({ ratio: 0.5, sample: 5 });
  });
});

describe("describeEstimateAccuracy", () => {
  it("returns null when accuracy is null", () => {
    expect(describeEstimateAccuracy(null)).toBeNull();
  });

  it("returns the 'on target' message at the lower boundary (0.9) inclusive", () => {
    expect(describeEstimateAccuracy({ ratio: 0.9, sample: 5 })).toBe(
      "Suas estimativas estão batendo com a realidade"
    );
  });

  it("returns the 'on target' message at the upper boundary (1.1) inclusive", () => {
    expect(describeEstimateAccuracy({ ratio: 1.1, sample: 5 })).toBe(
      "Suas estimativas estão batendo com a realidade"
    );
  });

  it("returns the 'on target' message at ratio 1.0", () => {
    expect(describeEstimateAccuracy({ ratio: 1, sample: 5 })).toBe(
      "Suas estimativas estão batendo com a realidade"
    );
  });

  it("returns the 'more time' message for ratio 1.5 (~50% more)", () => {
    expect(describeEstimateAccuracy({ ratio: 1.5, sample: 5 })).toBe(
      "Você leva ~50% mais tempo do que planeja"
    );
  });

  it("returns the 'less time' message for ratio 0.5 (~50% less)", () => {
    expect(describeEstimateAccuracy({ ratio: 0.5, sample: 5 })).toBe(
      "Você leva ~50% menos tempo do que planeja"
    );
  });

  it("rounds the percentage for a ratio like 1.333 (~33% more)", () => {
    expect(describeEstimateAccuracy({ ratio: 1.333, sample: 5 })).toBe(
      "Você leva ~33% mais tempo do que planeja"
    );
  });
});

describe("shiftDate", () => {
  it("shifts backward within the same month", () => {
    expect(shiftDate("2026-06-15", -1)).toBe("2026-06-14");
  });

  it("shifts forward within the same month", () => {
    expect(shiftDate("2026-06-14", 1)).toBe("2026-06-15");
  });

  it("crosses a month boundary going backward", () => {
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses a month boundary going forward", () => {
    expect(shiftDate("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("crosses a year boundary going backward", () => {
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("crosses a year boundary going forward", () => {
    expect(shiftDate("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("handles February 29 on a leap year going backward", () => {
    expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("handles February 29 on a leap year going forward", () => {
    expect(shiftDate("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("does not land on Feb 29 for a non-leap year", () => {
    expect(shiftDate("2026-03-01", -1)).not.toBe("2026-02-29");
  });
});

describe("focusStreak", () => {
  it("returns 0 for an empty record", () => {
    expect(focusStreak({}, "2026-06-15")).toBe(0);
  });

  it("treats a missing key the same as an explicit 0 for a broken streak", () => {
    const withExplicitZero = { "2026-06-15": 0, "2026-06-14": 0 };
    expect(focusStreak(withExplicitZero, "2026-06-15")).toBe(
      focusStreak({}, "2026-06-15")
    );
  });

  it("counts today and walks backward while previous days have focus", () => {
    const daily = {
      "2026-06-15": 10,
      "2026-06-14": 20,
      "2026-06-13": 0,
    };
    expect(focusStreak(daily, "2026-06-15")).toBe(2);
  });

  it("returns 1 for a single day with no prior day recorded", () => {
    const daily = { "2026-06-15": 5 };
    expect(focusStreak(daily, "2026-06-15")).toBe(1);
  });

  it("does not break the streak when today is missing but yesterday has focus", () => {
    const daily = { "2026-06-14": 10 };
    expect(focusStreak(daily, "2026-06-15")).toBe(1);
  });

  it("does not break the streak when today is explicitly 0 but yesterday has focus", () => {
    const daily = {
      "2026-06-15": 0,
      "2026-06-14": 15,
      "2026-06-13": 15,
      "2026-06-12": 0,
    };
    expect(focusStreak(daily, "2026-06-15")).toBe(2);
  });

  it("returns 0 when neither today nor yesterday has focus", () => {
    const daily = { "2026-06-15": 0, "2026-06-14": 0 };
    expect(focusStreak(daily, "2026-06-15")).toBe(0);
  });

  it("crosses a month boundary without drifting", () => {
    const daily = {
      "2026-03-01": 10,
      "2026-02-28": 10,
      "2026-02-27": 10,
      "2026-02-26": 0,
    };
    expect(focusStreak(daily, "2026-03-01")).toBe(3);
  });

  it("crosses a year boundary without drifting", () => {
    const daily = {
      "2026-01-01": 10,
      "2025-12-31": 10,
      "2025-12-30": 0,
    };
    expect(focusStreak(daily, "2026-01-01")).toBe(2);
  });

  it("handles a leap-year February correctly", () => {
    const daily = {
      "2024-03-01": 10,
      "2024-02-29": 10,
      "2024-02-28": 0,
    };
    expect(focusStreak(daily, "2024-03-01")).toBe(2);
  });
});

describe("lastSevenDays", () => {
  const today = "2026-06-15";
  const expectedDates = [
    "2026-06-09",
    "2026-06-10",
    "2026-06-11",
    "2026-06-12",
    "2026-06-13",
    "2026-06-14",
    "2026-06-15",
  ];

  it("returns exactly 7 zeroed buckets with the right dates for an empty list", () => {
    const buckets = lastSevenDays([], today);
    expect(buckets).toHaveLength(7);
    expect(buckets.map((b) => b.date)).toEqual(expectedDates);
    for (const bucket of buckets) {
      expect(bucket.tasks).toEqual([]);
      expect(bucket.focusedMinutes).toBe(0);
      expect(bucket.completedCount).toBe(0);
    }
  });

  it("ignores a task outside the 7-day window", () => {
    const outside = makeTask({
      id: "outside",
      date: "2026-06-01",
      minutes: 10,
      focusedMinutes: 10,
    });
    const buckets = lastSevenDays([outside], today);
    const allTasks = buckets.flatMap((b) => b.tasks);
    expect(allTasks).toEqual([]);
  });

  it("includes a task exactly on the old boundary (today - 6)", () => {
    const boundary = makeTask({ id: "boundary", date: "2026-06-09", minutes: 15 });
    const buckets = lastSevenDays([boundary], today);
    const bucket = buckets.find((b) => b.date === "2026-06-09")!;
    expect(bucket.tasks).toEqual([boundary]);
  });

  it("excludes a task one day before the old boundary (today - 7)", () => {
    const tooOld = makeTask({ id: "too-old", date: "2026-06-08", minutes: 15 });
    const buckets = lastSevenDays([tooOld], today);
    const allTasks = buckets.flatMap((b) => b.tasks);
    expect(allTasks).toEqual([]);
  });

  it("sums focusedMinutes and counts completed tasks for the same day", () => {
    const tasks = [
      makeTask({ id: "a", date: "2026-06-12", minutes: 30, focusedMinutes: 20, completed: true }),
      makeTask({ id: "b", date: "2026-06-12", minutes: 10, focusedMinutes: 5, completed: false }),
      makeTask({ id: "c", date: "2026-06-12", minutes: 20, completed: true }), // focusedMinutes ausente conta como 0
    ];
    const buckets = lastSevenDays(tasks, today);
    const bucket = buckets.find((b) => b.date === "2026-06-12")!;
    expect(bucket.tasks).toHaveLength(3);
    expect(bucket.focusedMinutes).toBe(25);
    expect(bucket.completedCount).toBe(2);
  });

  it("returns buckets in ascending order, oldest to most recent", () => {
    const buckets = lastSevenDays([], today);
    expect(buckets.map((b) => b.date)).toEqual([...expectedDates].sort());
  });

  it("handles a month boundary (today = 2026-03-02)", () => {
    const monthToday = "2026-03-02";
    const expected = [
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ];
    const task = makeTask({ id: "feb", date: "2026-02-24", minutes: 5, focusedMinutes: 5 });
    const buckets = lastSevenDays([task], monthToday);
    expect(buckets.map((b) => b.date)).toEqual(expected);
    expect(buckets[0].tasks).toEqual([task]);
  });
});
