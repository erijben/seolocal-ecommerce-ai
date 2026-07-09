import axiosClient from "./axiosClient";
import type { Category } from "../types/category";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type CategoryFormData = {
  name: string;
  description: string;
};

export async function getCategories(search = "") {
  const response = await axiosClient.get<ApiResponse<Category[]>>(
    `/categories${search ? `?search=${search}` : ""}`
  );

  return response.data.data;
}

export async function createCategory(data: CategoryFormData) {
  const response = await axiosClient.post<ApiResponse<Category>>(
    "/categories",
    {
      name: data.name,
      description: data.description || null,
    }
  );

  return response.data;
}

export async function updateCategory(id: number, data: CategoryFormData) {
  const response = await axiosClient.put<ApiResponse<Category>>(
    `/categories/${id}`,
    {
      name: data.name,
      description: data.description || null,
    }
  );

  return response.data;
}

export async function deleteCategory(id: number) {
  const response = await axiosClient.delete<ApiResponse<null>>(
    `/categories/${id}`
  );

  return response.data;
}