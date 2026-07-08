import axiosClient from "./axiosClient";
import type { Category } from "../types/category";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export async function getCategories(search = "") {
  const response = await axiosClient.get<ApiResponse<Category[]>>(
    `/categories${search ? `?search=${search}` : ""}`
  );

  return response.data.data;
}