import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import CategoriesPage from "../pages/CategoriesPage";
import ProductsPage from "../pages/ProductsPage";
import CustomersPage from "../pages/CustomersPage";
import OrdersPage from "../pages/OrdersPage";
import OrderDetailsPage from "../pages/OrderDetailsPage";
import AdminLayout from "../components/layout/AdminLayout";
import CustomerDetailsPage from "../pages/CustomerDetailsPage";
import AiAssistantPage from "../pages/AiAssistantPage";
import AiReportsPage from "../pages/AiReportsPage";
import AiAgentInsightsPage from "../pages/AiAgentInsightsPage";
import AiStockForecastPage from "../pages/AiStockForecastPage";
import KnowledgeBasePage from "../pages/KnowledgeBasePage.tsx";
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Chargement...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderDetailsPage />} />
        <Route path="customers/:customerId" element={<CustomerDetailsPage />} />

        <Route path="ai-assistant" element={<AiAssistantPage />} />
<Route path="ai-reports" element={<AiReportsPage />} />
<Route path="ai-agent-insights" element={<AiAgentInsightsPage />} />
<Route path="ai-stock-forecast" element={<AiStockForecastPage />} />
<Route path="/knowledge-base" element={<KnowledgeBasePage />} />
      </Route>
    </Routes>
  );
}