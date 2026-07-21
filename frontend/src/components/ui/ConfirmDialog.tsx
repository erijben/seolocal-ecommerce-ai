import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  loading = false,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      closeDisabled={loading}
      size="sm"
    >
      <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={
            destructive
              ? "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              : "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {loading && <Loader2 size={17} className="animate-spin" />}
          {loading ? "Traitement..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
