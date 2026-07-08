import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h2 className="font-semibold text-slate-900">Back-office</h2>
        <p className="text-sm text-slate-500">
          Gestion e-commerce intelligente
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
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