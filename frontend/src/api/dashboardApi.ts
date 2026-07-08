import axiosClient from "./axiosClient";
import type {
  DashboardStats,
  LowStockProduct,
  OrdersByStatus,
  SalesByPeriodItem,
  TopCustomer,
  TopProduct,
} from "../types/dashboard";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getDashboardStats() {
  const response = await axiosClient.get<ApiResponse<DashboardStats>>(
    "/dashboard/stats"
  );

  return response.data.data;
}

export async function getSalesByPeriod(period: "daily" | "weekly" | "monthly" | "yearly" = "monthly") {
  const response = await axiosClient.get<ApiResponse<SalesByPeriodItem[]>>(
    `/dashboard/sales-by-period?period=${period}`
  );

  return response.data.data;
}

export async function getTopProducts(limit = 5) {
  const response = await axiosClient.get<ApiResponse<TopProduct[]>>(
    `/dashboard/top-products?limit=${limit}`
  );

  return response.data.data;
}

export async function getTopCustomers(limit = 5) {
  const response = await axiosClient.get<ApiResponse<TopCustomer[]>>(
    `/dashboard/top-customers?limit=${limit}`
  );

  return response.data.data;
}

export async function getOrdersByStatus() {
  const response = await axiosClient.get<ApiResponse<OrdersByStatus[]>>(
    "/dashboard/orders-by-status"
  );

  return response.data.data;
}

export async function getLowStockProducts() {
  const response = await axiosClient.get<ApiResponse<LowStockProduct[]>>(
    "/dashboard/low-stock-products"
  );

  return response.data.data;
}