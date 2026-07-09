import axiosClient from "./axiosClient";
import type { Order, OrderFormData, OrderStatus } from "../types/order";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type OrderFilters = {
  status?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
};

function buildQuery(filters: OrderFilters) {
  const params = new URLSearchParams();

  if (filters.status) params.append("status", filters.status);
  if (filters.customer_id) params.append("customer_id", filters.customer_id);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);

  const query = params.toString();

  return query ? `?${query}` : "";
}

function prepareOrderPayload(data: OrderFormData) {
  return {
    customer_id: Number(data.customer_id),
    items: data.items.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
    })),
  };
}

export async function getOrders(filters: OrderFilters = {}) {
  const response = await axiosClient.get<ApiResponse<Order[]>>(
    `/orders${buildQuery(filters)}`
  );

  return response.data.data;
}

export async function getOrder(id: number) {
  const response = await axiosClient.get<ApiResponse<Order>>(`/orders/${id}`);

  return response.data.data;
}

export async function createOrder(data: OrderFormData) {
  const response = await axiosClient.post<ApiResponse<Order>>(
    "/orders",
    prepareOrderPayload(data)
  );

  return response.data;
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  const response = await axiosClient.put<ApiResponse<Order>>(
    `/orders/${id}/status`,
    { status }
  );

  return response.data;
}

export async function cancelOrder(id: number) {
  const response = await axiosClient.delete<ApiResponse<Order>>(`/orders/${id}`);

  return response.data;
}