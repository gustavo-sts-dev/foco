"use client";

import { useState } from "react";
import { FocusTimer } from "@/components/FocusTimer";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { TabNavigation, TabNavigationDesktop } from "@/components/TabNavigation";
import { Stopwatch } from "@/components/Stopwatch";
import { Agenda } from "@/components/Agenda";
import { Notes } from "@/components/Notes";
import { HistoryModal } from "@/components/HistoryModal";
import { useAppData } from "@/hooks/useAppData";
import { createId, getTaskDate, getTodayKey } from "@/lib/utils";
import { focusStreak, remainingPlannedMinutes } from "@/lib/insights";
import type { Task, TabType } from "@/types";

export default function Home() {
  const { data, update, loaded } = useAppData();
  const [activeTab, setActiveTab] = useState<TabType>("foco");
  // Cada timer tem seu proprio vinculo, para que iniciar um nao zere o outro
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [stopwatchTaskId, setStopwatchTaskId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const today = getTodayKey();
  const [agendaDate, setAgendaDate] = useState(today);

  // O dia corrente vem de focusMinutesToday, que é mais atual que o mapa
  // dailyMinutes (só é arquivado na virada do dia) — por isso a mesclagem.
  const streakDays = focusStreak(
    { ...data.dailyMinutes, [today]: data.focusMinutesToday },
    today
  );

  // Normalization: treat tasks without date as today's tasks

  // Foco Tab tasks (always today)
  const todayTasks = data.tasks.filter((t) => getTaskDate(t) === today);
  const pendingTasks = todayTasks.filter((t) => !t.completed);
  const completedTasks = todayTasks.filter((t) => t.completed);
  const focusTask = todayTasks.find((t) => t.id === focusTaskId) ?? null;
  const stopwatchTask = todayTasks.find((t) => t.id === stopwatchTaskId) ?? null;

  // Agenda Tab tasks
  const agendaTasks = data.tasks.filter((t) => getTaskDate(t) === agendaDate);

  // Extract unique task names for autocomplete
  const recentTaskNames = Array.from(new Set(data.tasks.map((t) => t.title.trim()))).filter(Boolean);

  function handleAddTask(title: string, minutes: number, date: string = today) {
    const task: Task = {
      id: createId(),
      title,
      minutes,
      completed: false,
      createdAt: new Date().toISOString(),
      date,
    };
    update((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
  }

  // Tarefa concluida ou removida deixa de estar vinculada a qualquer timer
  function unbindTimers(id: string) {
    setFocusTaskId((current) => (current === id ? null : current));
    setStopwatchTaskId((current) => (current === id ? null : current));
  }

  function handleToggleTask(id: string) {
    update((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    }));
    unbindTimers(id);
  }

  function handleDeleteTask(id: string) {
    update((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
    unbindTimers(id);
  }

  function handleStartFocus(id: string) {
    // Clicar de novo no botao da tarefa ja vinculada desfaz o vinculo
    if (focusTaskId === id) {
      setFocusTaskId(null);
      return;
    }
    setFocusTaskId(id);
    setActiveTab("foco");
  }

  function handleStartStopwatch(id: string) {
    if (stopwatchTaskId === id) {
      setStopwatchTaskId(null);
      return;
    }
    setStopwatchTaskId(id);
    setActiveTab("cronometro");
  }

  function handleReorderTask(activeId: string, overId: string) {
    update((prev) => {
      const oldIndex = prev.tasks.findIndex((t) => t.id === activeId);
      const newIndex = prev.tasks.findIndex((t) => t.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const newTasks = [...prev.tasks];
      const [moved] = newTasks.splice(oldIndex, 1);
      newTasks.splice(newIndex, 0, moved);
      return { ...prev, tasks: newTasks };
    });
  }

  function handleEditTask(id: string, updates: Partial<Task>) {
    update((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  }

  function handleFocusComplete(minutes: number) {
    update((prev) => {
      let updatedTasks = prev.tasks;
      if (focusTaskId) {
        updatedTasks = prev.tasks.map((t) =>
          t.id === focusTaskId
            ? { ...t, completed: true, focusedMinutes: (t.focusedMinutes ?? 0) + minutes }
            : t
        );
      }
      return {
        ...prev,
        focusMinutesToday: prev.focusMinutesToday + minutes,
        tasks: updatedTasks,
      };
    });
    setFocusTaskId(null);
  }

  // O cronometro nao tem duracao planejada, entao credita o tempo sem concluir a tarefa
  function handleStopwatchFinish(minutes: number) {
    update((prev) => {
      let updatedTasks = prev.tasks;
      if (stopwatchTaskId) {
        updatedTasks = prev.tasks.map((t) =>
          t.id === stopwatchTaskId
            ? { ...t, focusedMinutes: (t.focusedMinutes ?? 0) + minutes }
            : t
        );
      }
      return {
        ...prev,
        focusMinutesToday: prev.focusMinutesToday + minutes,
        tasks: updatedTasks,
      };
    });
    setStopwatchTaskId(null);
  }

  function handleCloneDay(sourceDate: string, targetDate: string) {
    const sourceTasks = data.tasks.filter((t) => getTaskDate(t) === sourceDate);
    const clonedTasks: Task[] = sourceTasks.map((t) => ({
      ...t,
      id: createId(),
      completed: false,
      date: targetDate,
      createdAt: new Date().toISOString(),
    }));

    update((prev) => ({
      ...prev,
      tasks: [...clonedTasks, ...prev.tasks],
    }));
  }

  if (!loaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-20 sm:pb-8 pt-safe">
      <Header onOpenHistory={() => setIsHistoryOpen(true)} streakDays={streakDays} />

      <main className="mt-6 flex flex-col gap-6">
        <StatsBar
          focusMinutes={data.focusMinutesToday}
          completedCount={completedTasks.length}
          remainingMinutes={remainingPlannedMinutes(todayTasks)}
        />

        <TabNavigationDesktop activeTab={activeTab} onChange={setActiveTab} />

        {/* Foco Tab */}
        <div className={activeTab === "foco" ? "block" : "hidden"}>
          <div className="flex flex-col gap-6">
            <FocusTimer
              activeTask={focusTask}
              onFocusComplete={handleFocusComplete}
            />

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Tarefas de Hoje</h2>
                <span className="text-sm text-muted">
                  {pendingTasks.length} pendente{pendingTasks.length !== 1 ? "s" : ""}
                </span>
              </div>

              <TaskForm 
                onAdd={(title, min) => handleAddTask(title, min, today)} 
                recentTaskNames={recentTaskNames}
              />

              <TaskList
                tasks={pendingTasks}
                focusTaskId={focusTaskId}
                stopwatchTaskId={stopwatchTaskId}
                onToggle={handleToggleTask}
                onDelete={handleDeleteTask}
                onStartFocus={handleStartFocus}
                onStartStopwatch={handleStartStopwatch}
                onReorder={handleReorderTask}
                onEdit={handleEditTask}
                emptyMessage="Nenhuma tarefa para hoje. Adicione uma acima."
              />

              {completedTasks.length > 0 && (
                <div className="mt-2">
                  <p className="mb-3 text-sm font-medium text-muted">
                    Concluídas ({completedTasks.length})
                  </p>
                  <TaskList
                    tasks={completedTasks}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    onReorder={handleReorderTask}
                    onEdit={handleEditTask}
                    completed
                  />
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Cronômetro Tab */}
        <div className={activeTab === "cronometro" ? "block" : "hidden"}>
          <Stopwatch
            activeTask={stopwatchTask}
            onFinish={handleStopwatchFinish}
          />
        </div>

        {/* Agenda Tab */}
        <div className={activeTab === "agenda" ? "block" : "hidden"}>
          <Agenda
            selectedDate={agendaDate}
            onChangeDate={setAgendaDate}
            tasks={agendaTasks}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onCloneDay={handleCloneDay}
            onReorderTasks={handleReorderTask}
            onEditTask={handleEditTask}
            recentTaskNames={recentTaskNames}
          />
        </div>

        {/* Notas Tab */}
        <div className={activeTab === "notas" ? "block" : "hidden"}>
          <Notes />
        </div>
      </main>

      <div className="mt-12 flex flex-col items-center gap-3 pb-8">
        <p className="text-sm font-medium text-muted">Gostou do Timerday?</p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText("79996352942");
            alert("Chave PIX (Telefone) copiada com sucesso: 79996352942");
          }}
          className="flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          Contribuir com PIX
        </button>
      </div>

      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
      
      <HistoryModal 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        tasks={data.tasks} 
      />
    </div>
  );
}
