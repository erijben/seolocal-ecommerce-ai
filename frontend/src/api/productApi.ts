import axiosClient from "./axiosClient";
import type { Product, ProductFormData } from "../types/product";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type ProductFilters = {
  search?: string;
  category_id?: string;
  status?: string;
  low_stock?: boolean;
};

function buildQuery(filters: ProductFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.append("search", filters.search);
  if (filters.category_id) params.append("category_id", filters.category_id);
  if (filters.status) params.append("status", filters.status);
  if (filters.low_stock) params.append("low_stock", "1");

  const query = params.toString();

  return query ? `?${query}` : "";
}

function prepareProductPayload(data: ProductFormData) {
  return {
    category_id: Number(data.category_id),
    name: data.name,
    description: data.description || null,
    price: Number(data.price),
    stock_quantity: Number(data.stock_quantity),
    stock_alert_threshold: Number(data.stock_alert_threshold || 5),
    image: data.image || null,
    status: data.status,
  };
}

export async function getProducts(filters: ProductFilters = {}) {
  const response = await axiosClient.get<ApiResponse<Product[]>>(
    `/products${buildQuery(filters)}`
  );

  return response.data.data;
}

export async function createProduct(data: ProductFormData) {
  const response = await axiosClient.post<ApiResponse<Product>>(
    "/products",
    prepareProductPayload(data)
  );

  return response.data;
}

export async function updateProduct(id: number, data: ProductFormData) {
  const response = await axiosClient.put<ApiResponse<Product>>(
    `/products/${id}`,
    prepareProductPayload(data)
  );

  return response.data;
}

export async function deleteProduct(id: number) {
  const response = await axiosClient.delete<ApiResponse<Product | null>>(
    `/products/${id}`
  );

  return response.data;
}