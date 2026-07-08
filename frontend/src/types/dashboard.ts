export type DashboardStats = {
  total_revenue: number | string;
  orders_count: number;
  customers_count: number;
  products_count: number;
  low_stock_count: number;
};

export type SalesByPeriodItem = {
  period: string;
  total_sales: number | string;
  orders_count: number;
};

export type TopProduct = {
  product_id: number;
  product_name: string;
  total_sold: number | string;
  total_revenue: number | string;
};

export type TopCustomer = {
  customer_id: number;
  first_name: string;
  last_name: string;
  email: string;
  orders_count: number;
  total_spent: number | string;
};

export type OrdersByStatus = {
  status: string;
  count: number;
};

export type LowStockProduct = {
  id: number;
  name: string;
  stock_quantity: number;
  stock_alert_threshold: number;
  price: number | string;
  status: string;
  category?: {
    id: number;
    name: string;
  };
};