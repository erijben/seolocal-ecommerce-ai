export type Customer = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  orders_count?: number;
};

export type CustomerFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
};