import type { Customer } from "./customer";
import type { Product } from "./product";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
  product?: Product;
};

export type Order = {
  id: number;
  customer_id: number;
  order_number: string;
  status: OrderStatus;
  total_amount: number | string;
  order_date: string;
  created_at?: string;
  customer?: Customer;
  items?: OrderItem[];
  items_count?: number;
};

export type OrderFormItem = {
  product_id: string;
  quantity: string;
};

export type OrderFormData = {
  customer_id: string;
  items: OrderFormItem[];
};