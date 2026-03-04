// ── v2 Schema — aligned with MiniShopBot API ──────────────────

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "merchant";
  merchant_id?: number | null;
  merchant_name?: string;
}

export interface Merchant {
  id: number;
  name: string;
  slug: string;
  owner_name: string;
  email: string;
  phone?: string;
  tagline?: string;
  description?: string;
  icon_emoji?: string;
  accent_color?: string;
  plan: string;
  status: string;
  telegram_token?: string;
  deep_link_code?: string;
  fb_page?: string;
  instagram?: string;
  product_count?: number;
  order_count?: number;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  merchant_id: number;
  merchant_name?: string;
  category_id?: number | null;
  category_name?: string;
  base_price: number;
  compare_price?: number | null;
  stock: number;
  sku?: string;
  weight?: number;
  delivery_days?: number;
  icon_emoji?: string;
  primary_image?: string | null;
  rating_avg?: number;
  review_count?: number;
  is_active: boolean;
  is_featured?: boolean;
  created_at?: string;
}

export interface OrderItem {
  id?: number;
  product_id?: number;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  selected_variants?: any;
}

export interface Order {
  id: number;
  order_code: string;
  user_id: number;
  customer_name?: string;
  customer_phone?: string;
  merchant_id: number;
  merchant_name?: string;
  subtotal: number;
  discount_amount?: number;
  total: number;
  status: string;
  delivery_address?: string;
  delivery_province?: string;
  payment_method?: string;
  payment_status?: string;
  customer_note?: string;
  admin_note?: string;
  created_at?: string;
  items?: OrderItem[];
}

export interface Stats {
  total_merchants?: number;
  pending_merchants?: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  total_customers?: number;
  recent_orders: Array<{
    id: number;
    order_code: string;
    total: number;
    status: string;
    created_at: string;
    customer_name?: string;
  }>;
}

export interface Category {
  id: number;
  name: string;
  name_kh?: string;
  merchant_id?: number | null;
  merchant_name?: string;
  icon_emoji?: string;
  sort_order?: number;
  is_active?: boolean;
  product_count?: number;
}

export interface User {
  id: number;
  telegram_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  language?: string;
  address?: string;
  is_active?: boolean;
  created_at?: string;
  orders?: Array<{
    id: number;
    order_code: string;
    total: number;
    status: string;
    created_at: string;
  }>;
}

export interface PromoCode {
  id: number;
  merchant_id: number;
  code: string;
  type: "percent" | "flat";
  value: number;
  min_order: number;
  max_uses?: number | null;
  used_count: number;
  expires_at?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface SupportTicket {
  id: number;
  subject: string;
  status: "open" | "replied" | "closed";
  order_id?: number | null;
  customer_name?: string;
  customer_username?: string;
  last_message?: string;
  message_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TicketMessage {
  id: number;
  ticket_id?: number;
  sender_type: "customer" | "merchant";
  sender_id: number;
  body: string;
  created_at: string;
}
