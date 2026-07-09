import type { Category } from "./category";

export type ProductStatus = "active" | "inactive";

export type Product = {
  id: number;
  category_id: number;
  name: string;
  description?: string | null;
  price: number | string;
  stock_quantity: number;
  stock_alert_threshold: number;
  image?: string | null;
  status: ProductStatus;
  category?: Category;
};

export type ProductFormData = {
  category_id: string;
  name: string;
  description: string;
  price: string;
  stock_quantity: string;
  stock_alert_threshold: string;
  image: string;
  status: ProductStatus;
};