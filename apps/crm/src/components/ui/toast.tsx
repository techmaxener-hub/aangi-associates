import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ToastItem {
  id: number;
  message: string;
  variant: "success" | "error";
}

interface ToastContextValue {
  showToast: (message: string, variant?: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.variant === "success" ? CheckCircle2 : AlertCircle;
          return (
            <div
              key={t.id}
              className={
                "flex items-center gap-2.5 rounded-lg border-l-4 border-y border-r px-4 py-2.5 text-xs font-medium shadow-raised bg-navy text-on-navy toast-enter " +
                (t.variant === "success"
                  ? "border-l-gold border-y-line-strong border-r-line-strong"
                  : "border-l-crimson border-y-line-strong border-r-line-strong")
              }
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: t.variant === "success" ? "var(--gold-on-navy)" : "var(--crimson)" }}
              />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
