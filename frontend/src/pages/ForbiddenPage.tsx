import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForbiddenPage() {
  return (
    <section className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <ShieldAlert size={28} />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Accès interdit
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Votre rôle ne permet pas d’accéder à cette page. Si vous pensez qu’il
          s’agit d’une erreur, contactez un administrateur.
        </p>

        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </section>
  );
}
