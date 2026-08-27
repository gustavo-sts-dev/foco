import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shiftDate } from "@/lib/insights";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Janela de histórico devolvida ao cliente. focusStreak para no primeiro dia
// sem foco, então buscar a vida inteira do usuário seria desperdício que só
// cresce. O campo `date` é "YYYY-MM-DD", cuja ordem lexicográfica é cronológica.
const HISTORY_WINDOW_DAYS = 90;

// GET /api/data — returns all tasks + daily stats for logged user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const today = getTodayKey();

  const [tasks, dailyStats] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
    prisma.dailyStats.findMany({
      where: { userId, date: { gte: shiftDate(today, -HISTORY_WINDOW_DAYS) } },
    }),
  ]);

  const dailyMinutes: Record<string, number> = {};
  for (const stat of dailyStats) {
    dailyMinutes[stat.date] = stat.focusMinutes;
  }

  // A janela sempre inclui hoje, então não precisa de uma consulta só para ele
  return NextResponse.json({
    tasks,
    focusMinutesToday: dailyMinutes[today] ?? 0,
    lastActiveDate: today,
    dailyMinutes,
  });
}

// POST /api/data — upsert full state (tasks array + focusMinutes)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const serverToday = getTodayKey();
  const body = await req.json();

  const { tasks, focusMinutesToday, date } = body as {
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
    date?: string;
  };

  // `date` vem do cliente e reflete o dia local do usuário (o servidor só
  // conhece UTC). É chave de banco vinda de fora, então validamos o formato
  // antes de confiar nela; qualquer coisa fora do padrão cai de volta no dia
  // UTC do servidor.
  const today =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : serverToday;

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
