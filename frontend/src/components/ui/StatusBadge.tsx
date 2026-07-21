import type { ReactNode } from "react";

export type StatusBadgeVariant =
  | "success"
  | "info"
  | "warning"
  | "ai"
  | "danger"
  | "neutral"
  | "attention";

type StatusBadgeProps = {
  children: ReactNode;
  variant?: StatusBadgeVariant;
};

const variantClasses: Record<StatusBadgeVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  ai: "border-violet-200 bg-violet-50 text-violet-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  attention: "border-orange-200 bg-orange-50 text-orange-700",
};

export default function StatusBadge({
  children,
  variant = "neutral",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
