import type { TabType } from "@/types";

type TabNavigationProps = {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
};

export function TabNavigation({ activeTab, onChange }: TabNavigationProps) {
  const tabs = [
    {
      id: "foco" as TabType,
      label: "Foco",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: "cronometro" as TabType,
      label: "Cronômetro",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M5 3L2 6" />
          <path d="m19 3 3 3" />
          <path d="M14 3h-4" />
        </svg>
      ),
    },
    {
      id: "agenda" as TabType,
      label: "Agenda",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-border bg-background pb-safe sm:hidden">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TabNavigationDesktop({ activeTab, onChange }: TabNavigationProps) {
  const tabs = [
    { id: "foco" as TabType, label: "Foco" },
    { id: "cronometro" as TabType, label: "Cronômetro" },
    { id: "agenda" as TabType, label: "Agenda" },
  ];

  return (
    <div className="mb-6 hidden sm:flex sm:gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-white"
                : "bg-muted-bg text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
