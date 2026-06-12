// ══════════════════════════════════════════════════════════════
// FERCHOS POS — Tipos globales del sistema
// Archivo: src/lib/types/index.ts
// ══════════════════════════════════════════════════════════════

// ── Roles del sistema ─────────────────────────────────────────
export type UserRole =
  | 'admin'
  | 'cajero'
  | 'mesero'
  | 'cocina'
  | 'domiciliario'
  | 'cliente';

// ── Unidades de negocio ───────────────────────────────────────
export type BusinessUnit = 'desayunos' | 'almuerzos' | 'pizzeria' | 'all';

// ── Estado de mesa ────────────────────────────────────────────
export type TableStatus = 'disponible' | 'ocupada' | 'pendiente_pago' | 'reservada';

// ── Tipos de pedido ───────────────────────────────────────────
export type OrderType = 'mesa' | 'domicilio' | 'llevar';

// ── Estado de pedido ──────────────────────────────────────────
export type OrderStatus =
  | 'pendiente'
  | 'confirmado'
  | 'en_preparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

// ── Métodos de pago ───────────────────────────────────────────
export type PaymentMethod =
  | 'efectivo'
  | 'nequi'
  | 'daviplata'
  | 'transferencia'
  | 'tarjeta'
  | 'mixto';

// ── Estado de caja ────────────────────────────────────────────
export type CashboxMovementType = 'apertura' | 'cierre' | 'venta' | 'gasto' | 'ajuste';

// ── Estado de inventario ──────────────────────────────────────
export type StockStatus = 'ok' | 'warning' | 'critical';

// ─────────────────────────────────────────────────────────────
// ENTIDADES
// ─────────────────────────────────────────────────────────────

/** Perfil de usuario del sistema */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  business_unit?: BusinessUnit;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

/** Categoría de producto */
export interface Category {
  id: string;
  name: string;
  description?: string;
  business_unit: BusinessUnit;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

/** Ingrediente / materia prima */
export interface Ingredient {
  id: string;
  name: string;
  unit: string;               // kg, g, L, ml, unidad
  stock_current: number;
  stock_minimum: number;
  cost_per_unit: number;
  supplier?: string;
  expiry_date?: string;
  stock_status: StockStatus;
  created_at: string;
  updated_at: string;
}

/** Producto del menú */
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost: number;
  image_url?: string;
  category_id: string;
  category?: Category;
  business_unit: BusinessUnit;
  is_active: boolean;
  is_available: boolean;       // Disponible en horario actual
  preparation_time: number;    // Minutos
  calories?: number;
  is_pizza: boolean;
  allow_halves: boolean;       // Permite mitad y mitad
  ingredients?: ProductIngredient[];
  created_at: string;
  updated_at: string;
}

/** Relación producto–ingrediente */
export interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  ingredient?: Ingredient;
  quantity: number;
  unit: string;
}

/** Mesa del restaurante */
export interface Table {
  id: string;
  number: number;
  name: string;               // "Mesa 1", "Terraza 2", etc.
  capacity: number;
  status: TableStatus;
  section?: string;           // "Salón", "Terraza", "VIP"
  current_order_id?: string;
  opened_at?: string;
  reserved_for?: string;
  notes?: string;
  created_at: string;
}

/** Adicional para pizza u otros productos */
export interface Extra {
  id: string;
  name: string;
  price: number;
  cost: number;
  ingredient_id?: string;
  category: string;           // 'pizza_extra', 'topping', 'sauce'
  is_active: boolean;
}

/** Ítem dentro de un pedido */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
  // Para pizzas personalizadas
  pizza_flavors?: PizzaFlavor[];
  extras?: OrderItemExtra[];
  status: OrderStatus;
  created_at: string;
}

/** Sabor de pizza en un ítem */
export interface PizzaFlavor {
  id: string;
  order_item_id: string;
  product_id: string;
  product?: Product;
  fraction: number;           // 1 = entera, 0.5 = mitad, 0.25 = cuarto
  position: number;           // 1, 2, 3, 4
}

/** Extra agregado a un ítem */
export interface OrderItemExtra {
  id: string;
  order_item_id: string;
  extra_id: string;
  extra?: Extra;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/** Pedido completo */
export interface Order {
  id: string;
  consecutive: number;        // Número visible: #001, #002…
  type: OrderType;
  status: OrderStatus;
  table_id?: string;
  table?: Table;
  client_id?: string;
  client?: Client;
  user_id: string;            // Quien tomó el pedido
  user?: UserProfile;
  business_unit: BusinessUnit;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  notes?: string;
  // Domicilio
  delivery_address?: string;
  delivery_user_id?: string;
  delivery_user?: UserProfile;
  delivery_fee: number;
  delivered_at?: string;
  // Tiempos
  estimated_time?: number;    // Minutos estimados
  created_at: string;
  updated_at: string;
  paid_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
}

/** Cliente registrado */
export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  total_spent: number;
  total_orders: number;
  last_order_at?: string;
  tier: 'nuevo' | 'regular' | 'frecuente' | 'vip';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Movimiento de caja */
export interface CashboxMovement {
  id: string;
  cashbox_session_id: string;
  type: CashboxMovementType;
  description: string;
  reference?: string;
  amount: number;             // Positivo: ingreso, Negativo: egreso
  balance_after: number;
  business_unit?: BusinessUnit;
  payment_method?: PaymentMethod;
  order_id?: string;
  user_id: string;
  user?: UserProfile;
  created_at: string;
}

/** Sesión de caja (apertura → cierre) */
export interface CashboxSession {
  id: string;
  opened_by: string;
  closed_by?: string;
  opening_balance: number;
  closing_balance?: number;
  expected_balance?: number;
  difference?: number;
  opened_at: string;
  closed_at?: string;
  is_open: boolean;
  movements?: CashboxMovement[];
  total_sales: number;
  total_expenses: number;
}

/** Movimiento de inventario */
export interface InventoryMovement {
  id: string;
  ingredient_id: string;
  ingredient?: Ingredient;
  type: 'entrada' | 'salida' | 'ajuste' | 'desperdicio' | 'vencimiento';
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference?: string;         // ID de pedido si fue por venta
  notes?: string;
  user_id: string;
  created_at: string;
}

/** Promoción */
export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: 'descuento_porcentaje' | 'descuento_fijo' | '2x1' | 'combo';
  value: number;              // % o $ según tipo
  business_unit?: BusinessUnit;
  applicable_products?: string[];
  min_order_amount?: number;
  valid_from?: string;
  valid_to?: string;
  active_days?: number[];     // 0=dom, 1=lun… 6=sab
  active_from_hour?: number;
  active_to_hour?: number;
  is_active: boolean;
  times_used: number;
  max_uses?: number;
  created_at: string;
}

/** Log de auditoría */
export interface AuditLog {
  id: string;
  user_id: string;
  user?: UserProfile;
  action: string;             // 'CREATE_ORDER', 'UPDATE_PRODUCT', etc.
  table_name: string;
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// TIPOS DE UI / ESTADO
// ─────────────────────────────────────────────────────────────

/** Ítem en el carrito del POS (antes de convertirlo en OrderItem) */
export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  pizza_flavors?: {
    product: Product;
    fraction: number;
    position: number;
  }[];
  extras?: {
    extra: Extra;
    quantity: number;
  }[];
  unit_price: number;
  subtotal: number;
}

/** Estado del carrito */
export interface CartState {
  items: CartItem[];
  type: OrderType;
  table_id?: string;
  client_id?: string;
  notes?: string;
  discount: number;
  subtotal: number;
  total: number;
}

/** Filtros para dashboard */
export interface DashboardFilters {
  business_unit: BusinessUnit;
  date_from?: string;
  date_to?: string;
  period: 'today' | 'week' | 'month' | 'custom';
}

/** Estadísticas del dashboard */
export interface DashboardStats {
  total_sales: number;
  total_orders: number;
  avg_ticket: number;
  gross_profit: number;
  sales_by_hour: { hour: number; total: number }[];
  sales_by_unit: { unit: BusinessUnit; total: number }[];
  top_products: { product: Product; quantity: number; total: number }[];
  payment_methods: { method: PaymentMethod; count: number; total: number }[];
  pending_orders: number;
  active_tables: number;
}

/** Respuesta de API paginada */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/** Respuesta estándar de API */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
