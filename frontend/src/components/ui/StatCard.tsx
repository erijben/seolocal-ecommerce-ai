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
    card: "border-slate-200 bg-white",
    icon: "bg-slate-100 text-slate-600",
    value: "text-slate-900",
  },
  success: {
    card: "border-emerald-200 bg-emerald-50/40",
    icon: "bg-emerald-100 text-emerald-700",
    value: "text-emerald-950",
  },
  info: {
    card: "border-blue-200 bg-blue-50/40",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-950",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/50",
    icon: "bg-amber-100 text-amber-700",
    value: "text-amber-950",
  },
  danger: {
    card: "border-red-200 bg-red-50/50",
    icon: "bg-red-100 text-red-700",
    value: "text-red-950",
  },
  ai: {
    card: "border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-violet-50/60",
    icon: "bg-indigo-100 text-indigo-700",
    value: "text-indigo-950",
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
      className={`rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${styles.card}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className={`mt-2 text-3xl font-bold ${styles.value}`}>{value}</h3>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}
        >
          {icon}
        </div>
      </div>

      {description && (
        <p className="mt-3 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}