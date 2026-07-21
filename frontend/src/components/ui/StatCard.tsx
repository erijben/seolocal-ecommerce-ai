import type { ReactNode } from "react";

export type StatCardVariant =
  | "default"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "ai";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  variant?: StatCardVariant;
};

const variantStyles: Record<
  StatCardVariant,
  { card: string; icon: string; value: string }
> = {
  default: {
    card: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    value: "text-slate-900 dark:text-white",
  },
  success: {
    card: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/70 dark:bg-emerald-950/30",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    value: "text-emerald-950 dark:text-emerald-100",
  },
  info: {
    card: "border-blue-200 bg-blue-50/40 dark:border-blue-900/70 dark:bg-blue-950/30",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    value: "text-blue-950 dark:text-blue-100",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/50 dark:border-amber-900/70 dark:bg-amber-950/30",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    value: "text-amber-950 dark:text-amber-100",
  },
  danger: {
    card: "border-red-200 bg-red-50/50 dark:border-red-900/70 dark:bg-red-950/30",
    icon: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    value: "text-red-950 dark:text-red-100",
  },
  ai: {
    card: "border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 dark:border-indigo-800 dark:from-indigo-950/60 dark:to-violet-950/40",
    icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
    value: "text-indigo-950 dark:text-indigo-100",
  },
};

export default function StatCard({
  title,
  value,
  icon,
  description,
  variant = "default",
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:shadow-black/10 dark:hover:shadow-black/25 ${styles.card}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className={`mt-2 text-3xl font-bold ${styles.value}`}>{value}</h3>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}
        >
          {icon}
        </div>
      </div>

      {description && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
  );
}