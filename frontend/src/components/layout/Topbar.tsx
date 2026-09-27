import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useAuth } from "../../context/authContextValue";
import { useTheme } from "../../context/ThemeContext";

type TopbarProps = {
  onMenuClick: () => void;
};

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  manager: "Manager",
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === "light" ? Moon : Sun;
  const nextThemeLabel = theme === "light" ? "sombre" : "clair";

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 transition-colors dark:border-slate-800 dark:bg-slate-900 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Espace de gestion</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gestion e-commerce intelligente
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label={"Activer le thème " + nextThemeLabel}
          title={"Activer le thème " + nextThemeLabel}
        >
          <ThemeIcon size={18} />
        </button>

        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {user?.role ? roleLabels[user.role] ?? user.role : ""}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
