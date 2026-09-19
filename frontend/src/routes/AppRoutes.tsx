import { Navigate, Route, Routes } from "react-router-dom";
import { ADMIN_ONLY_ROLES } from "../auth/authorization";
import AdminLayout from "../components/layout/AdminLayout";
import AiAgentInsightsPage from "../pages/AiAgentInsightsPage";
import AiAssistantPage from "../pages/AiAssistantPage";
import AiReportsPage from "../pages/AiReportsPage";
import AiStockForecastPage from "../pages/AiStockForecastPage";
import CategoriesPage from "../pages/CategoriesPage";
import CustomerDetailsPage from "../pages/CustomerDetailsPage";
import CustomersPage from "../pages/CustomersPage";
import DashboardPage from "../pages/DashboardPage";
import ForbiddenPage from "../pages/ForbiddenPage";
import KnowledgeBasePage from "../pages/KnowledgeBasePage";
import LoginPage from "../pages/LoginPage";
import OrderDetailsPage from "../pages/OrderDetailsPage";
import OrdersPage from "../pages/OrdersPage";
import ProductsPage from "../pages/ProductsPage";
import {
  ProtectedRoute,
  RoleProtectedRoute,
} from "./ProtectedRoute";

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
        <Route path="ai-stock-forecast" element={<AiStockForecastPage />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route
          path="ai-agent-insights"
          element={
            <RoleProtectedRoute allowedRoles={ADMIN_ONLY_ROLES}>
              <AiAgentInsightsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="knowledge-base"
          element={
            <RoleProtectedRoute allowedRoles={ADMIN_ONLY_ROLES}>
              <KnowledgeBasePage />
            </RoleProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
