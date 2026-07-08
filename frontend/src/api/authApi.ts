import axiosClient from "./axiosClient";
import type { LoginResponse, User } from "../types/auth";

export async function loginApi(email: string, password: string) {
  const response = await axiosClient.post<LoginResponse>("/login", {
    email,
    password,
  });

  return response.data;
}

export async function meApi() {
  const response = await axiosClient.get<{
    success: boolean;
    data: User;
  }>("/me");

  return response.data;
}

export async function logoutApi() {
  const response = await axiosClient.post<{
    success: boolean;
    message: string;
  }>("/logout");

  return response.data;
}