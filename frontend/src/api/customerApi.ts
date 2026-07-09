import axiosClient from "./axiosClient";
import type { Customer, CustomerFormData } from "../types/customer";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function prepareCustomerPayload(data: CustomerFormData) {
  return {
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    phone: data.phone || null,
    address: data.address || null,
  };
}

export async function getCustomers(search = "") {
  const response = await axiosClient.get<ApiResponse<Customer[]>>(
    `/customers${search ? `?search=${search}` : ""}`
  );

  return response.data.data;
}

export async function createCustomer(data: CustomerFormData) {
  const response = await axiosClient.post<ApiResponse<Customer>>(
    "/customers",
    prepareCustomerPayload(data)
  );

  return response.data;
}

export async function updateCustomer(id: number, data: CustomerFormData) {
  const response = await axiosClient.put<ApiResponse<Customer>>(
    `/customers/${id}`,
    prepareCustomerPayload(data)
  );

  return response.data;
}

export async function deleteCustomer(id: number) {
  const response = await axiosClient.delete<ApiResponse<null>>(
    `/customers/${id}`
  );

  return response.data;


  
}

import type { Order } from "../types/order";

export async function getCustomer(id: number) {
  const response = await axiosClient.get<ApiResponse<Customer & { orders?: Order[] }>>(
    `/customers/${id}`
  );

  return response.data.data;
}

export async function getCustomerOrders(id: number) {
  const response = await axiosClient.get<ApiResponse<Order[]>>(
    `/customers/${id}/orders`
  );

  return response.data.data;
}