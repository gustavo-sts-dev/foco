"use client";

export function MobileTextInput({ value, onChange, placeholder, autoFocus, maxLength, onFocus, list }: any) {
  return (
    <div className="relative flex w-full items-center">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        autoFocus={autoFocus}
        maxLength={maxLength}
        list={list}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-bg hover:text-foreground"
          aria-label="Limpar texto"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      )}
    </div>
  );
}

export function MobileStepper({ value, onChange, min = 1, max = 240, step = 5 }: any) {
  function decrement() {
    const newVal = value - step;
    onChange(newVal < min ? min : newVal);
  }
  
  function increment() {
    const newVal = value + step;
    onChange(newVal > max ? max : newVal);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={decrement}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-bg text-foreground transition-all hover:bg-border active:scale-95"
        aria-label="Diminuir tempo"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
      </button>
      <div className="flex h-12 min-w-[72px] items-center justify-center rounded-xl border border-border bg-background px-3 text-lg font-bold">
        {value}
      </div>
      <button
        type="button"
        onClick={increment}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-bg text-foreground transition-all hover:bg-border active:scale-95"
        aria-label="Aumentar tempo"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      </button>
    </div>
  );
}
