import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/categories", label: "Catégories", icon: Tags },
  { to: "/products", label: "Produits", icon: Boxes },
  { to: "/customers", label: "Clients", icon: Users },
  { to: "/orders", label: "Commandes", icon: ShoppingCart },
  { to: "/dashboard", label: "Stats", icon: BarChart3 },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-72 border-r border-slate-200 bg-white p-5 lg:block">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">SmartCommerce</h1>
        <p className="text-sm text-slate-500">Admin Dashboard</p>
      </div>

      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const active = location.pathname === link.to;

          return (
            <Link
              key={link.label}
              to={link.to}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}