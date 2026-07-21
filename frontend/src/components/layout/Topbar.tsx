import { LogOut, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

type TopbarProps = {
  onMenuClick: () => void;
};

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  manager: "Manager",
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 className="font-semibold text-slate-900">Espace de gestion</h2>
          <p className="text-sm text-slate-500">
            Gestion e-commerce intelligente
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500">
            {user?.role ? roleLabels[user.role] ?? user.role : ""}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}