import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastOptions = {
  duration?: number;
};

export type ToastApi = Record<
  ToastType,
  (message: string, options?: ToastOptions) => void
>;

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast doit être utilisé dans ToastProvider.");
  }

  return context;
}
