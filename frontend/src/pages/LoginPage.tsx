import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("admin@smartcommerce.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch {
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3">
            <ShoppingBag size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SmartCommerce</h1>
            <p className="text-white/80">AI Dashboard</p>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-5xl font-bold leading-tight">
            Gérez votre boutique avec un tableau de bord intelligent.
          </h2>
          <p className="max-w-xl text-lg text-white/80">
            Produits, clients, commandes, stocks et statistiques commerciales
            dans une seule plateforme.
          </p>
        </div>

        <p className="text-sm text-white/70">
          Laravel API + React Dashboard
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-50 px-6 lg:w-1/2">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <ShoppingBag />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">
              Connexion Admin
            </h2>
            <p className="mt-2 text-slate-500">
              Accédez à votre back-office e-commerce.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@smartcommerce.com"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}