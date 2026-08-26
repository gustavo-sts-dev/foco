import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/data — returns all tasks + daily stats for logged user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const today = getTodayKey();

  const [tasks, dailyStat] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
    prisma.dailyStats.findUnique({ where: { userId_date: { userId, date: today } } }),
  ]);

  return NextResponse.json({
    tasks,
    focusMinutesToday: dailyStat?.focusMinutes ?? 0,
    lastActiveDate: today,
  });
}

// POST /api/data — upsert full state (tasks array + focusMinutes)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const today = getTodayKey();
  const body = await req.json();

  const { tasks, focusMinutesToday } = body as {
    tasks: Array<{
      id: string;
      title: string;
      minutes: number;
      completed: boolean;
      date: string;
      createdAt: string;
      focusedMinutes?: number;
      order?: number;
    }>;
    focusMinutesToday: number;
  };

  // Upsert each task
  await Promise.all(
    tasks.map((t, idx) =>
      prisma.task.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          title: t.title,
          minutes: t.minutes,
          completed: t.completed,
          date: t.date || today,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          focusedMinutes: t.focusedMinutes ?? 0,
          order: t.order ?? idx,
          userId,
        },
        update: {
          title: t.title,
          minutes: t.minutes,
          completed: t.completed,
          date: t.date || today,
          focusedMinutes: t.focusedMinutes ?? 0,
          order: t.order ?? idx,
        },
      })
    )
  );

  // Remove tasks from DB that are no longer in the list
  const taskIds = tasks.map((t) => t.id);
  await prisma.task.deleteMany({
    where: { userId, id: { notIn: taskIds } },
  });

  // Upsert daily stats
  await prisma.dailyStats.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, focusMinutes: focusMinutesToday },
    update: { focusMinutes: focusMinutesToday },
  });

  return NextResponse.json({ ok: true });
}
