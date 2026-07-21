import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  Boxes,
  Activity,
  FileText,
  LayoutDashboard,
  ShoppingCart,
  Tags,
  Users,
  TrendingUp,
  X,
  BookOpen,
  
} from "lucide-react";


type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const links = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/categories", label: "Catégories", icon: Tags },
  { to: "/products", label: "Produits", icon: Boxes },
  { to: "/customers", label: "Clients", icon: Users },
  { to: "/orders", label: "Commandes", icon: ShoppingCart },
  { to: "/ai-assistant", label: "Assistant IA", icon: Bot },
  {
  label: "Base de connaissances",
  to: "/knowledge-base",
  icon: BookOpen,
},
  { to: "/ai-agent-insights", label: "Suivi de l’assistant", icon: Activity },
  { to: "/ai-stock-forecast", label: "Prévisions de stock", icon: TrendingUp },
{ to: "/ai-reports", label: "Rapports IA", icon: FileText },

];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white p-5 transition-[transform,background-color,border-color] duration-300 dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:block lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              SmartCommerce
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Administration</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.to;

            return (
              <Link
                key={link.label}
                to={link.to}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}