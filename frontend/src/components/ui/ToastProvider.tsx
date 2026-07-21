import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastOptions = {
  duration?: number;
};

type ToastApi = Record<
  ToastType,
  (message: string, options?: ToastOptions) => void
>;

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

const ToastContext = createContext<ToastApi | null>(null);
const MAX_TOASTS = 5;

const toastStyles: Record<
  ToastType,
  {
    icon: typeof CheckCircle2;
    className: string;
    iconClassName: string;
    textClassName: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/95",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
    textClassName: "text-emerald-900 dark:text-emerald-100",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/95",
    iconClassName: "text-red-600 dark:text-red-400",
    textClassName: "text-red-900 dark:text-red-100",
  },
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/95",
    iconClassName: "text-blue-600 dark:text-blue-400",
    textClassName: "text-blue-900 dark:text-blue-100",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/95",
    iconClassName: "text-amber-600 dark:text-amber-400",
    textClassName: "text-amber-900 dark:text-amber-100",
  },
};

const defaultDurations: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  info: 4500,
  warning: 5000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      const id = ++nextId.current;

      setToasts((current) => [
        ...current.slice(-(MAX_TOASTS - 1)),
        { id, message, type },
      ]);

      const timer = setTimeout(
        () => removeToast(id),
        options?.duration ?? defaultDurations[type]
      );
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const api: ToastApi = {
    success: (message, options) => addToast("success", message, options),
    error: (message, options) => addToast("error", message, options),
    info: (message, options) => addToast("info", message, options),
    warning: (message, options) => addToast("warning", message, options),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-full sm:max-w-sm"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          const Icon = style.icon;

          return (
            <div
              key={toast.id}
              role={toast.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-xl [animation:toast-slide-in_220ms_ease-out] dark:shadow-black/30 ${style.className}`}
            >
              <Icon
                size={21}
                className={`mt-0.5 shrink-0 ${style.iconClassName}`}
              />
              <p
                className={`min-w-0 flex-1 text-sm font-medium leading-6 ${style.textClassName}`}
              >
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
                aria-label="Fermer la notification"
              >
                <X size={17} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translate3d(20px, -8px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [class*="toast-slide-in"] {
            animation: none !important;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast doit être utilisé dans ToastProvider.");
  }

  return context;
}
