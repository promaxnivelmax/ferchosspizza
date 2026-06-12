-- ══════════════════════════════════════════════════════════════
-- FERCHOS ERP POS — Schema completo para Supabase PostgreSQL
-- Proyecto: asywerfhslaqgdkkizyn
-- Zona horaria: America/Bogota (UTC-5)
-- Versión: 1.0.0
-- 
-- INSTRUCCIONES:
--   1. Abre Supabase Dashboard → SQL Editor
--   2. Pega TODO este archivo y ejecuta
--   3. Verifica en Table Editor que aparezcan todas las tablas
-- ══════════════════════════════════════════════════════════════

-- ── Configuración inicial ─────────────────────────────────────
SET timezone = 'America/Bogota';

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════════════════════
-- 1. PERFILES DE USUARIO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'cajero'
                  CHECK (role IN ('admin','cajero','mesero','cocina','domiciliario','cliente')),
  business_unit TEXT DEFAULT 'all'
                  CHECK (business_unit IN ('desayunos','almuerzos','pizzeria','all')),
  phone         TEXT,
  avatar_url    TEXT,
  pin           TEXT,                        -- PIN de acceso rápido (hasheado)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_role     ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active   ON public.user_profiles(is_active);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: crear perfil al registrar usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sin nombre'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cajero')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════════════════════
-- 2. CATEGORÍAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  business_unit TEXT NOT NULL DEFAULT 'all'
                  CHECK (business_unit IN ('desayunos','almuerzos','pizzeria','all')),
  icon          TEXT,
  color         TEXT DEFAULT '#f97316',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_unit ON public.categories(business_unit);

-- ══════════════════════════════════════════════════════════════
-- 3. INGREDIENTES / INVENTARIO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ingredients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kg'
                    CHECK (unit IN ('kg','g','L','ml','unidad','docena','paquete')),
  stock_current   DECIMAL(10,3) NOT NULL DEFAULT 0,
  stock_minimum   DECIMAL(10,3) NOT NULL DEFAULT 0,
  stock_maximum   DECIMAL(10,3),
  cost_per_unit   DECIMAL(12,2) NOT NULL DEFAULT 0,
  supplier        TEXT,
  expiry_date     DATE,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock status calculado automáticamente
CREATE OR REPLACE FUNCTION public.get_stock_status(current DECIMAL, minimum DECIMAL)
RETURNS TEXT AS $$
BEGIN
  IF current <= 0 THEN RETURN 'critical'; END IF;
  IF current <= minimum * 0.5 THEN RETURN 'critical'; END IF;
  IF current <= minimum THEN RETURN 'warning'; END IF;
  RETURN 'ok';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE INDEX IF NOT EXISTS idx_ingredients_stock ON public.ingredients(stock_current, stock_minimum);

CREATE TRIGGER trg_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 4. PRODUCTOS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  description       TEXT,
  price             DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost              DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_url         TEXT,
  category_id       UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  business_unit     TEXT NOT NULL DEFAULT 'all'
                      CHECK (business_unit IN ('desayunos','almuerzos','pizzeria','all')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_available      BOOLEAN NOT NULL DEFAULT true,
  preparation_time  INTEGER NOT NULL DEFAULT 10,     -- minutos
  calories          INTEGER,
  is_pizza          BOOLEAN NOT NULL DEFAULT false,
  allow_halves      BOOLEAN NOT NULL DEFAULT false,  -- permite mitad y mitad
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_unit       ON public.products(business_unit);
CREATE INDEX IF NOT EXISTS idx_products_category   ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active     ON public.products(is_active, is_available);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Relación producto–ingrediente ────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_ingredients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity      DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'kg',
  UNIQUE(product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_ingr_product ON public.product_ingredients(product_id);

-- ═══════════════════════════════════════════════════════════
-- 5. EXTRAS / ADICIONALES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.extras (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost          DECIMAL(12,2) NOT NULL DEFAULT 0,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  category      TEXT NOT NULL DEFAULT 'topping'
                  CHECK (category IN ('pizza_extra','topping','sauce','side','drink')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 6. MESAS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tables (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number           INTEGER NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  capacity         INTEGER NOT NULL DEFAULT 4,
  status           TEXT NOT NULL DEFAULT 'disponible'
                     CHECK (status IN ('disponible','ocupada','pendiente_pago','reservada')),
  section          TEXT DEFAULT 'Salón principal',
  current_order_id UUID,                          -- FK circular, se añade después
  opened_at        TIMESTAMPTZ,
  reserved_for     TEXT,
  reserved_at      TIMESTAMPTZ,
  notes            TEXT,
  pos_x            INTEGER DEFAULT 0,             -- Posición en mapa visual
  pos_y            INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tables_status ON public.tables(status);

CREATE TRIGGER trg_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 7. CLIENTES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL UNIQUE,
  email           TEXT,
  address         TEXT,
  city            TEXT DEFAULT 'Bucaramanga',
  notes           TEXT,
  total_spent     DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_orders    INTEGER NOT NULL DEFAULT 0,
  last_order_at   TIMESTAMPTZ,
  tier            TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (tier IN ('nuevo','regular','frecuente','vip')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_tier  ON public.clients(tier);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 8. PEDIDOS
-- ══════════════════════════════════════════════════════════════

-- Secuencia para número consecutivo
CREATE SEQUENCE IF NOT EXISTS public.order_consecutive_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS public.orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consecutive        INTEGER NOT NULL DEFAULT nextval('public.order_consecutive_seq'),
  type               TEXT NOT NULL DEFAULT 'mesa'
                       CHECK (type IN ('mesa','domicilio','llevar')),
  status             TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (status IN ('pendiente','confirmado','en_preparacion','listo','entregado','cancelado')),
  table_id           UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  client_id          UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id            UUID NOT NULL REFERENCES public.user_profiles(id),
  business_unit      TEXT NOT NULL DEFAULT 'almuerzos'
                       CHECK (business_unit IN ('desayunos','almuerzos','pizzeria')),
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount           DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_fee       DECIMAL(12,2) NOT NULL DEFAULT 0,
  total              DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method     TEXT CHECK (payment_method IN ('efectivo','nequi','daviplata','transferencia','tarjeta','mixto')),
  payment_reference  TEXT,
  notes              TEXT,
  -- Domicilio
  delivery_address   TEXT,
  delivery_user_id   UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- Tiempos
  estimated_time     INTEGER,                        -- minutos
  paid_at            TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status    ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table     ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_unit      ON public.orders(business_unit);
CREATE INDEX IF NOT EXISTS idx_orders_user      ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_date      ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_consec    ON public.orders(consecutive DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK circular tables ↔ orders
ALTER TABLE public.tables
  ADD CONSTRAINT fk_tables_current_order
  FOREIGN KEY (current_order_id) REFERENCES public.orders(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ══════════════════════════════════════════════════════════════
-- 9. ÍTEMS DE PEDIDO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id),
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  DECIMAL(12,2) NOT NULL,
  subtotal    DECIMAL(12,2) NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (status IN ('pendiente','en_preparacion','listo','entregado','cancelado')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

-- ── Sabores de pizza ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pizza_flavors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id  UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id),
  fraction       DECIMAL(4,2) NOT NULL DEFAULT 1.0,  -- 1=entera, 0.5=mitad, 0.25=cuarto
  position       INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pizza_flavors_item ON public.pizza_flavors(order_item_id);

-- ── Extras de ítem ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_item_extras (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id  UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  extra_id       UUID NOT NULL REFERENCES public.extras(id),
  quantity       INTEGER NOT NULL DEFAULT 1,
  unit_price     DECIMAL(12,2) NOT NULL,
  subtotal       DECIMAL(12,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_extras_item ON public.order_item_extras(order_item_id);

-- ══════════════════════════════════════════════════════════════
-- 10. CAJA
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cashbox_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opened_by         UUID NOT NULL REFERENCES public.user_profiles(id),
  closed_by         UUID REFERENCES public.user_profiles(id),
  opening_balance   DECIMAL(14,2) NOT NULL DEFAULT 0,
  closing_balance   DECIMAL(14,2),
  expected_balance  DECIMAL(14,2),
  difference        DECIMAL(14,2),
  total_sales       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_expenses    DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_open           BOOLEAN NOT NULL DEFAULT true,
  notes             TEXT,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cashbox_open ON public.cashbox_sessions(is_open);

CREATE TABLE IF NOT EXISTS public.cashbox_movements (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cashbox_session_id  UUID NOT NULL REFERENCES public.cashbox_sessions(id),
  type                TEXT NOT NULL
                        CHECK (type IN ('apertura','cierre','venta','gasto','ajuste','retiro','ingreso')),
  description         TEXT NOT NULL,
  reference           TEXT,
  amount              DECIMAL(14,2) NOT NULL,           -- positivo=ingreso, negativo=egreso
  balance_after       DECIMAL(14,2) NOT NULL,
  business_unit       TEXT CHECK (business_unit IN ('desayunos','almuerzos','pizzeria','all')),
  payment_method      TEXT CHECK (payment_method IN ('efectivo','nequi','daviplata','transferencia','tarjeta','mixto')),
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id             UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashbox_mov_session ON public.cashbox_movements(cashbox_session_id);
CREATE INDEX IF NOT EXISTS idx_cashbox_mov_date    ON public.cashbox_movements(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 11. MOVIMIENTOS DE INVENTARIO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id  UUID NOT NULL REFERENCES public.ingredients(id),
  type           TEXT NOT NULL
                   CHECK (type IN ('entrada','salida','ajuste','desperdicio','vencimiento')),
  quantity       DECIMAL(10,3) NOT NULL,
  unit_cost      DECIMAL(12,2),
  total_cost     DECIMAL(12,2),
  reference      TEXT,                        -- orden ID si fue venta
  notes          TEXT,
  user_id        UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_ingredient ON public.inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date       ON public.inventory_movements(created_at DESC);

-- Trigger: actualizar stock automáticamente al registrar movimiento
CREATE OR REPLACE FUNCTION public.update_ingredient_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('entrada') THEN
    UPDATE public.ingredients
    SET stock_current = stock_current + NEW.quantity,
        updated_at    = NOW()
    WHERE id = NEW.ingredient_id;
  ELSIF NEW.type IN ('salida','desperdicio','vencimiento') THEN
    UPDATE public.ingredients
    SET stock_current = GREATEST(0, stock_current - NEW.quantity),
        updated_at    = NOW()
    WHERE id = NEW.ingredient_id;
  ELSIF NEW.type = 'ajuste' THEN
    UPDATE public.ingredients
    SET stock_current = NEW.quantity,
        updated_at    = NOW()
    WHERE id = NEW.ingredient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_movement
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_ingredient_stock();

-- ══════════════════════════════════════════════════════════════
-- 12. PROMOCIONES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.promotions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL
                        CHECK (type IN ('descuento_porcentaje','descuento_fijo','2x1','combo')),
  value               DECIMAL(12,2) NOT NULL DEFAULT 0,
  business_unit       TEXT CHECK (business_unit IN ('desayunos','almuerzos','pizzeria','all')),
  min_order_amount    DECIMAL(12,2),
  valid_from          TIMESTAMPTZ,
  valid_to            TIMESTAMPTZ,
  active_days         INTEGER[],                        -- 0=dom … 6=sab
  active_from_hour    INTEGER,
  active_to_hour      INTEGER,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  times_used          INTEGER NOT NULL DEFAULT 0,
  max_uses            INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active);

-- ══════════════════════════════════════════════════════════════
-- 13. AUDITORÍA
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,                    -- 'CREATE_ORDER', 'UPDATE_PRODUCT', etc.
  table_name  TEXT NOT NULL,
  record_id   TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user   ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table  ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_date   ON public.audit_logs(created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 14. ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizza_flavors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_extras     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbox_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbox_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;

-- ── Función helper: obtener rol del usuario autenticado ───────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Función helper: verificar si es admin ────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ── Función helper: verificar rol activo ─────────────────────
CREATE OR REPLACE FUNCTION public.has_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = ANY(required_roles)
      AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- POLICIES — user_profiles
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_read_own" ON public.user_profiles;
CREATE POLICY "users_read_own" ON public.user_profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "admin_manage_users" ON public.user_profiles;
CREATE POLICY "admin_manage_users" ON public.user_profiles
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "users_update_own" ON public.user_profiles;
CREATE POLICY "users_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- POLICIES — categories (todos leen, solo admin escribe)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "all_read_categories" ON public.categories;
CREATE POLICY "all_read_categories" ON public.categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admin_write_categories" ON public.categories;
CREATE POLICY "admin_write_categories" ON public.categories
  FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- POLICIES — products
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_products" ON public.products;
CREATE POLICY "staff_read_products" ON public.products
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND public.has_role(ARRAY['admin','cajero','mesero','cocina','domiciliario'])
  );

DROP POLICY IF EXISTS "admin_write_products" ON public.products;
CREATE POLICY "admin_write_products" ON public.products
  FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- POLICIES — tables (mesas)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_tables" ON public.tables;
CREATE POLICY "staff_read_tables" ON public.tables
  FOR SELECT USING (
    public.has_role(ARRAY['admin','cajero','mesero'])
  );

DROP POLICY IF EXISTS "staff_update_tables" ON public.tables;
CREATE POLICY "staff_update_tables" ON public.tables
  FOR UPDATE USING (
    public.has_role(ARRAY['admin','cajero','mesero'])
  );

DROP POLICY IF EXISTS "admin_manage_tables" ON public.tables;
CREATE POLICY "admin_manage_tables" ON public.tables
  FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- POLICIES — orders (pedidos)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_orders" ON public.orders;
CREATE POLICY "staff_read_orders" ON public.orders
  FOR SELECT USING (
    public.has_role(ARRAY['admin','cajero','mesero','cocina','domiciliario'])
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "staff_create_orders" ON public.orders;
CREATE POLICY "staff_create_orders" ON public.orders
  FOR INSERT WITH CHECK (
    public.has_role(ARRAY['admin','cajero','mesero'])
  );

DROP POLICY IF EXISTS "staff_update_orders" ON public.orders;
CREATE POLICY "staff_update_orders" ON public.orders
  FOR UPDATE USING (
    public.has_role(ARRAY['admin','cajero','mesero','cocina','domiciliario'])
  );

DROP POLICY IF EXISTS "admin_delete_orders" ON public.orders;
CREATE POLICY "admin_delete_orders" ON public.orders
  FOR DELETE USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- POLICIES — order_items
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_manage_order_items" ON public.order_items;
CREATE POLICY "staff_manage_order_items" ON public.order_items
  FOR ALL USING (
    public.has_role(ARRAY['admin','cajero','mesero','cocina'])
  );

-- ─────────────────────────────────────────────────────────────
-- POLICIES — kitchen (cocina solo lee, no crea pedidos)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kitchen_read_orders" ON public.orders;
-- (Ya cubierto por staff_read_orders arriba)

-- ─────────────────────────────────────────────────────────────
-- POLICIES — clients
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_manage_clients" ON public.clients;
CREATE POLICY "staff_manage_clients" ON public.clients
  FOR ALL USING (
    public.has_role(ARRAY['admin','cajero'])
  );

-- ─────────────────────────────────────────────────────────────
-- POLICIES — cashbox (caja — admin y cajero)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cashbox_staff" ON public.cashbox_sessions;
CREATE POLICY "cashbox_staff" ON public.cashbox_sessions
  FOR ALL USING (
    public.has_role(ARRAY['admin','cajero'])
  );

DROP POLICY IF EXISTS "cashbox_mov_staff" ON public.cashbox_movements;
CREATE POLICY "cashbox_mov_staff" ON public.cashbox_movements
  FOR ALL USING (
    public.has_role(ARRAY['admin','cajero'])
  );

-- ─────────────────────────────────────────────────────────────
-- POLICIES — inventory (solo admin)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_ingredients" ON public.ingredients;
CREATE POLICY "admin_ingredients" ON public.ingredients
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admin_inv_movements" ON public.inventory_movements;
CREATE POLICY "admin_inv_movements" ON public.inventory_movements
  FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- POLICIES — promotions
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_promotions" ON public.promotions;
CREATE POLICY "staff_read_promotions" ON public.promotions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admin_write_promotions" ON public.promotions;
CREATE POLICY "admin_write_promotions" ON public.promotions
  FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- POLICIES — audit_logs (solo admin lee)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_audit" ON public.audit_logs;
CREATE POLICY "admin_audit" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "insert_audit" ON public.audit_logs;
CREATE POLICY "insert_audit" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Políticas para extras y product_ingredients ───────────────
DROP POLICY IF EXISTS "all_read_extras" ON public.extras;
CREATE POLICY "all_read_extras" ON public.extras
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "admin_write_extras" ON public.extras;
CREATE POLICY "admin_write_extras" ON public.extras
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "all_read_prod_ingr" ON public.product_ingredients;
CREATE POLICY "all_read_prod_ingr" ON public.product_ingredients
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "admin_write_prod_ingr" ON public.product_ingredients;
CREATE POLICY "admin_write_prod_ingr" ON public.product_ingredients
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "staff_read_pf" ON public.pizza_flavors;
CREATE POLICY "staff_read_pf" ON public.pizza_flavors
  FOR ALL USING (public.has_role(ARRAY['admin','cajero','mesero','cocina']));

DROP POLICY IF EXISTS "staff_read_oie" ON public.order_item_extras;
CREATE POLICY "staff_read_oie" ON public.order_item_extras
  FOR ALL USING (public.has_role(ARRAY['admin','cajero','mesero','cocina']));

-- ══════════════════════════════════════════════════════════════
-- 15. REALTIME — Habilitar para tablas críticas
-- ══════════════════════════════════════════════════════════════

-- Habilitar publicación Realtime en tablas de tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cashbox_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pizza_flavors;

-- ══════════════════════════════════════════════════════════════
-- 16. FUNCIONES DE NEGOCIO
-- ══════════════════════════════════════════════════════════════

-- ── Función: calcular total de una orden ─────────────────────
CREATE OR REPLACE FUNCTION public.calculate_order_total(p_order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_subtotal  DECIMAL := 0;
  v_extras    DECIMAL := 0;
  v_discount  DECIMAL := 0;
  v_delivery  DECIMAL := 0;
BEGIN
  -- Suma de ítems
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM public.order_items WHERE order_id = p_order_id;

  -- Suma de extras
  SELECT COALESCE(SUM(oie.subtotal), 0) INTO v_extras
  FROM public.order_item_extras oie
  JOIN public.order_items oi ON oi.id = oie.order_item_id
  WHERE oi.order_id = p_order_id;

  -- Descuento y delivery fee
  SELECT COALESCE(discount, 0), COALESCE(delivery_fee, 0)
  INTO v_discount, v_delivery
  FROM public.orders WHERE id = p_order_id;

  RETURN (v_subtotal + v_extras + v_delivery - v_discount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Función: actualizar totales de cliente ───────────────────
CREATE OR REPLACE FUNCTION public.update_client_stats(p_client_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total   DECIMAL;
  v_count   INTEGER;
  v_last    TIMESTAMPTZ;
  v_tier    TEXT;
BEGIN
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*),
    MAX(created_at)
  INTO v_total, v_count, v_last
  FROM public.orders
  WHERE client_id = p_client_id
    AND status != 'cancelado';

  -- Calcular tier
  v_tier := CASE
    WHEN v_count >= 30 OR v_total >= 500000 THEN 'vip'
    WHEN v_count >= 15 OR v_total >= 200000 THEN 'frecuente'
    WHEN v_count >= 5  OR v_total >= 50000  THEN 'regular'
    ELSE 'nuevo'
  END;

  UPDATE public.clients
  SET total_spent   = v_total,
      total_orders  = v_count,
      last_order_at = v_last,
      tier          = v_tier,
      updated_at    = NOW()
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Función: registrar movimiento de caja al completar pago ──
CREATE OR REPLACE FUNCTION public.register_payment_to_cashbox(
  p_order_id UUID,
  p_user_id  UUID
) RETURNS VOID AS $$
DECLARE
  v_session    UUID;
  v_balance    DECIMAL;
  v_order      RECORD;
BEGIN
  -- Obtener sesión de caja abierta
  SELECT id INTO v_session
  FROM public.cashbox_sessions
  WHERE is_open = true
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'No hay sesión de caja abierta';
  END IF;

  -- Datos de la orden
  SELECT total, business_unit, payment_method, consecutive
  INTO v_order
  FROM public.orders WHERE id = p_order_id;

  -- Saldo actual
  SELECT COALESCE(MAX(balance_after), opening_balance) INTO v_balance
  FROM public.cashbox_movements cm
  JOIN public.cashbox_sessions cs ON cs.id = cm.cashbox_session_id
  WHERE cm.cashbox_session_id = v_session;

  IF v_balance IS NULL THEN
    SELECT opening_balance INTO v_balance
    FROM public.cashbox_sessions WHERE id = v_session;
  END IF;

  -- Insertar movimiento
  INSERT INTO public.cashbox_movements (
    cashbox_session_id, type, description, reference,
    amount, balance_after, business_unit, payment_method,
    order_id, user_id
  ) VALUES (
    v_session, 'venta',
    'Pedido #' || LPAD(v_order.consecutive::TEXT, 3, '0'),
    p_order_id::TEXT,
    v_order.total,
    v_balance + v_order.total,
    v_order.business_unit,
    v_order.payment_method,
    p_order_id,
    p_user_id
  );

  -- Actualizar totales de sesión
  UPDATE public.cashbox_sessions
  SET total_sales = total_sales + v_order.total
  WHERE id = v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Función: descontar inventario al completar pedido ────────
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_order(
  p_order_id UUID,
  p_user_id  UUID
) RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_ingr RECORD;
BEGIN
  -- Para cada ítem del pedido
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Para cada ingrediente del producto
    FOR v_ingr IN
      SELECT pi.ingredient_id, pi.quantity * v_item.quantity AS total_qty
      FROM public.product_ingredients pi
      WHERE pi.product_id = v_item.product_id
    LOOP
      INSERT INTO public.inventory_movements (
        ingredient_id, type, quantity, reference, notes, user_id
      ) VALUES (
        v_ingr.ingredient_id, 'salida', v_ingr.total_qty,
        p_order_id::TEXT, 'Descuento automático por venta', p_user_id
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Trigger: al pagar una orden → registrar en caja + inventario
CREATE OR REPLACE FUNCTION public.on_order_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo cuando cambia a 'entregado' y hay método de pago
  IF NEW.status = 'entregado' AND OLD.status != 'entregado'
     AND NEW.payment_method IS NOT NULL THEN

    -- Registrar en caja
    PERFORM public.register_payment_to_cashbox(NEW.id, NEW.user_id);

    -- Descontar inventario
    PERFORM public.deduct_inventory_for_order(NEW.id, NEW.user_id);

    -- Actualizar stats del cliente
    IF NEW.client_id IS NOT NULL THEN
      PERFORM public.update_client_stats(NEW.client_id);
    END IF;

    -- Liberar mesa
    IF NEW.table_id IS NOT NULL THEN
      UPDATE public.tables
      SET status = 'disponible',
          current_order_id = NULL,
          opened_at = NULL,
          updated_at = NOW()
      WHERE id = NEW.table_id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_order_paid
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_paid();

-- ── Trigger: al crear una orden → ocupar mesa ────────────────
CREATE OR REPLACE FUNCTION public.on_order_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.table_id IS NOT NULL AND NEW.type = 'mesa' THEN
    UPDATE public.tables
    SET status = 'ocupada',
        current_order_id = NEW.id,
        opened_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_created();

-- ── Función: estadísticas de dashboard ───────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_unit  TEXT DEFAULT 'all',
  p_date  DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sales',   COALESCE(SUM(total), 0),
    'total_orders',  COUNT(*),
    'avg_ticket',    COALESCE(AVG(total), 0),
    'pending',       COUNT(*) FILTER (WHERE status = 'pendiente')
  ) INTO v_result
  FROM public.orders
  WHERE
    DATE(created_at AT TIME ZONE 'America/Bogota') = p_date
    AND status != 'cancelado'
    AND (p_unit = 'all' OR business_unit = p_unit);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 17. DATOS SEMILLA (SEED)
-- ══════════════════════════════════════════════════════════════

-- ── Usuarios del sistema ──────────────────────────────────────
-- NOTA: Los usuarios se crean en Auth, no directamente en la tabla.
-- Ejecuta esto en tu aplicación o en el Dashboard de Supabase → Authentication.
-- Las contraseñas deben ser hasheadas por Supabase Auth.
-- Aquí insertamos los perfiles (auth.users se crean vía Dashboard/API):

-- Los perfil se crean automáticamente via trigger cuando se registra en Auth.
-- Puedes crear usuarios desde: Supabase Dashboard → Authentication → Users → Add User
-- Email: admin@ferchos.com         Password: Ferchos2025!  (Meta: role=admin, full_name=Fernando Sánchez)
-- Email: cajero@ferchos.com        Password: Ferchos2025!  (Meta: role=cajero, full_name=Laura Gómez)
-- Email: mesero@ferchos.com        Password: Ferchos2025!  (Meta: role=mesero, full_name=Carlos Mesa)
-- Email: cocina@ferchos.com        Password: Ferchos2025!  (Meta: role=cocina, full_name=Jefe Cocina)
-- Email: domicilio@ferchos.com     Password: Ferchos2025!  (Meta: role=domiciliario, full_name=Pedro Ruiz)

-- ── Categorías ────────────────────────────────────────────────
INSERT INTO public.categories (name, description, business_unit, icon, sort_order) VALUES
  ('Calentados',        'Desayunos tradicionales calentados', 'desayunos', '🍳', 1),
  ('Huevos',            'Huevos al gusto',                   'desayunos', '🥚', 2),
  ('Panadería',         'Pan, pandebono, almojábana',        'desayunos', '🥐', 3),
  ('Bebidas calientes', 'Tinto, chocolate, aromática',       'desayunos', '☕', 4),
  ('Sopas',             'Sopa del día',                      'almuerzos', '🥣', 5),
  ('Platos fuertes',    'Almuerzo ejecutivo y especiales',   'almuerzos', '🍽️', 6),
  ('Pizzas',            'Pizzas artesanales',                'pizzeria',  '🍕', 7),
  ('Bebidas frías',     'Jugos, limonadas, gaseosas',        'all',       '🥤', 8),
  ('Adicionales',       'Adiciones para cualquier plato',    'all',       '➕', 9)
ON CONFLICT DO NOTHING;

-- ── Ingredientes base ─────────────────────────────────────────
INSERT INTO public.ingredients (name, unit, stock_current, stock_minimum, cost_per_unit) VALUES
  ('Mozzarella',         'kg',    0.8,    2.0,   18000),
  ('Harina de trigo',    'kg',    3.0,    5.0,    3500),
  ('Levadura',           'kg',    0.5,    0.5,   12000),
  ('Salsa de tomate',    'L',     4.5,    2.0,    6500),
  ('Pollo',              'kg',    8.0,    3.0,    9000),
  ('Jamón',              'kg',    1.2,    1.0,   15000),
  ('Pimentón',           'kg',    0.5,    1.0,    4000),
  ('Cebolla cabezona',   'kg',    2.0,    1.0,    2500),
  ('Tomate chonto',      'kg',    3.0,    1.5,    3000),
  ('Huevos',             'unidad',48.0,  24.0,     600),
  ('Aceite',             'L',     5.0,    2.0,    7000),
  ('Sal',                'kg',    2.0,    1.0,    1500),
  ('Arroz',              'kg',   10.0,    3.0,    3000),
  ('Papa criolla',       'kg',    4.0,    2.0,    2800),
  ('Fríjoles',           'kg',    3.0,    1.5,    6000),
  ('Chorizo',            'kg',    1.5,    0.5,   18000),
  ('Chicharrón',         'kg',    1.0,    0.5,   22000),
  ('Chocolate',          'kg',    1.0,    0.5,   12000),
  ('Leche',              'L',     6.0,    3.0,    3800),
  ('Pepperoni',          'kg',    1.0,    0.5,   22000),
  ('Champiñones',        'kg',    0.8,    0.5,   12000),
  ('Piña',               'kg',    1.5,    0.5,    4500),
  ('Tocineta',           'kg',    0.5,    0.5,   24000),
  ('Maíz dulce',         'kg',    0.8,    0.5,    5000)
ON CONFLICT DO NOTHING;

-- ── Productos — Desayunos ─────────────────────────────────────
INSERT INTO public.products (name, description, price, cost, business_unit, preparation_time, is_active, sort_order)
SELECT name, description, price, cost, 'desayunos', prep, true, srt FROM (VALUES
  ('Calentado Paisa',   'Arroz, fríjoles, carne, huevo, chicharrón y chocolate',  12000, 4200, 10, 1),
  ('Huevos Pericos',    'Huevos revueltos con tomate, cebolla y cilantro',          9000, 2800,  5, 2),
  ('Huevos al Gusto',   'Fritos, revueltos, tibios o cocidos. A tu gusto',          8000, 2500,  5, 3),
  ('Changua',           'Sopa de leche con huevo y pan',                            8000, 2600,  6, 4),
  ('Pandebono',         'Pandebono casero recién horneado (x3)',                    4500,  900,  3, 5),
  ('Almojábana',        'Almojábana tradicional recién horneada (x3)',              4000,  800,  3, 6),
  ('Chocolate con Pan', 'Taza de chocolate con dos panes',                          7000, 2000,  4, 7),
  ('Tinto',             'Tinto de origen colombiano',                               2500,  500,  2, 8)
) AS t(name, description, price, cost, prep, srt)
ON CONFLICT DO NOTHING;

-- ── Productos — Almuerzos ─────────────────────────────────────
INSERT INTO public.products (name, description, price, cost, business_unit, preparation_time, is_active, sort_order)
SELECT name, description, price, cost, 'almuerzos', prep, true, srt FROM (VALUES
  ('Almuerzo Corriente','Sopa, arroz, fríjoles, proteína, ensalada y jugo',        14000, 5200, 10, 1),
  ('Bandeja Paisa',     'Fríjoles, arroz, carne, chorizo, chicharrón, huevo, maduro y aguacate', 22000, 8500, 15, 2),
  ('Sopa del Día',      'Sopa casera del día, cambia cada jornada',                 8000, 2400,  8, 3),
  ('Pechuga a la Plancha','Pechuga de pollo a la plancha con guarnición',          18000, 6000, 12, 4),
  ('Cazuela de Fríjoles','Cazuela de fríjoles con todos los elementos',            14000, 4800, 10, 5),
  ('Agua Panela',       'Agua panela natural con limón',                            3000,  600,  3, 6),
  ('Jugo Natural',      'Jugo natural de temporada (mora, lulo, maracuyá…)',        5000, 1200,  4, 7)
) AS t(name, description, price, cost, prep, srt)
ON CONFLICT DO NOTHING;

-- ── Productos — Pizzería ──────────────────────────────────────
INSERT INTO public.products (name, description, price, cost, business_unit, preparation_time, is_active, is_pizza, allow_halves, sort_order)
SELECT name, description, price, cost, 'pizzeria', prep, true, true, true, srt FROM (VALUES
  ('Pizza Hawaiana',   'Jamón, piña y mozzarella extra',            32000, 10500, 18, 1),
  ('Pizza Ranchera',   'Carne molida, pimentón, cebolla, mozzarella', 34000, 11000, 18, 2),
  ('Pizza Pollo BBQ',  'Pollo desmechado, salsa BBQ y mozzarella',  34000, 11500, 18, 3),
  ('Pizza 4 Carnes',   'Jamón, salami, carne, chorizo y mozzarella',38000, 13000, 20, 4),
  ('Pizza Vegetariana','Pimentón, champiñones, maíz, brócoli',      30000,  9000, 18, 5),
  ('Pizza Pepperoni',  'Pepperoni y queso mozzarella',              32000, 10500, 18, 6),
  ('Pizza Especial',   'Pizza de la casa con ingredientes secretos', 42000, 14000, 20, 7),
  ('Pizza Margarita',  'Salsa de tomate, mozzarella y albahaca',    28000,  8500, 16, 8)
) AS t(name, description, price, cost, prep, srt)
ON CONFLICT DO NOTHING;

-- ── Bebidas ───────────────────────────────────────────────────
INSERT INTO public.products (name, description, price, cost, business_unit, preparation_time, is_active, sort_order)
SELECT name, description, price, cost, 'all', prep, true, srt FROM (VALUES
  ('Limonada Natural', 'Limonada de limón con hierbabuena',         5000, 1200,  4, 1),
  ('Gaseosa 350ml',    'Coca-Cola, Sprite, Manzana o Naranja',      3500,  900,  1, 2),
  ('Agua Botella',     'Agua mineral sin gas 600ml',                 2500,  700,  1, 3),
  ('Jugo en Caja',     'Hit o Del Valle sabores varios',            3000,  900,  1, 4)
) AS t(name, description, price, cost, prep, srt)
ON CONFLICT DO NOTHING;

-- ── Extras / Adicionales de pizza ─────────────────────────────
INSERT INTO public.extras (name, price, cost, category, is_active) VALUES
  ('Queso extra',   2500, 800, 'pizza_extra', true),
  ('Tocineta',      3500, 1200, 'pizza_extra', true),
  ('Champiñones',   2500, 900, 'pizza_extra', true),
  ('Pollo extra',   3500, 1200, 'pizza_extra', true),
  ('Maíz dulce',    2000, 600, 'pizza_extra', true),
  ('Pimentón',      2000, 600, 'pizza_extra', true),
  ('Salsa BBQ',     1500, 400, 'sauce', true),
  ('Salsa rosada',  1500, 400, 'sauce', true),
  ('Ají casero',    1000, 200, 'sauce', true)
ON CONFLICT DO NOTHING;

-- ── Mesas ─────────────────────────────────────────────────────
INSERT INTO public.tables (number, name, capacity, section, pos_x, pos_y) VALUES
  (1,  'Mesa 1',  4, 'Salón principal', 0,   0),
  (2,  'Mesa 2',  4, 'Salón principal', 140, 0),
  (3,  'Mesa 3',  4, 'Salón principal', 280, 0),
  (4,  'Mesa 4',  6, 'Salón principal', 0,   140),
  (5,  'Mesa 5',  6, 'Salón principal', 140, 140),
  (6,  'Mesa 6',  4, 'Salón principal', 280, 140),
  (7,  'Mesa 7',  2, 'Barra',           0,   280),
  (8,  'Mesa 8',  2, 'Barra',           140, 280),
  (9,  'Mesa 9',  4, 'Terraza',         280, 280),
  (10, 'Mesa 10', 4, 'Terraza',         0,   420),
  (11, 'Mesa 11', 8, 'Salón VIP',       140, 420),
  (12, 'Mesa 12', 8, 'Salón VIP',       280, 420)
ON CONFLICT (number) DO NOTHING;

-- ── Sesión de caja inicial ────────────────────────────────────
-- (Solo se inserta si no hay ninguna sesión abierta)
-- Esta la debe crear el admin al abrir el día.
-- Aquí solo dejamos un ejemplo comentado.
-- INSERT INTO public.cashbox_sessions (opened_by, opening_balance)
-- SELECT id, 50000 FROM public.user_profiles WHERE role = 'admin' LIMIT 1;

-- ══════════════════════════════════════════════════════════════
-- 18. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ══════════════════════════════════════════════════════════════

-- Dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_created_date
  ON public.orders (DATE(created_at AT TIME ZONE 'America/Bogota'));

CREATE INDEX IF NOT EXISTS idx_orders_status_unit
  ON public.orders (status, business_unit);

-- Búsqueda de clientes por teléfono
CREATE INDEX IF NOT EXISTS idx_clients_phone_lower
  ON public.clients (LOWER(phone));

-- Full text search en productos
CREATE INDEX IF NOT EXISTS idx_products_name_search
  ON public.products USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

-- ══════════════════════════════════════════════════════════════
-- 19. VISTAS ÚTILES
-- ══════════════════════════════════════════════════════════════

-- Vista: Pedidos activos con detalles
CREATE OR REPLACE VIEW public.v_active_orders AS
SELECT
  o.id,
  o.consecutive,
  o.type,
  o.status,
  o.business_unit,
  o.total,
  o.notes,
  o.created_at,
  t.name AS table_name,
  t.number AS table_number,
  up.full_name AS waiter_name,
  c.full_name AS client_name,
  c.phone AS client_phone,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_elapsed
FROM public.orders o
LEFT JOIN public.tables t ON t.id = o.table_id
LEFT JOIN public.user_profiles up ON up.id = o.user_id
LEFT JOIN public.clients c ON c.id = o.client_id
WHERE o.status NOT IN ('entregado', 'cancelado');

-- Vista: Stock bajo (alertas de inventario)
CREATE OR REPLACE VIEW public.v_low_stock AS
SELECT
  id,
  name,
  unit,
  stock_current,
  stock_minimum,
  cost_per_unit,
  public.get_stock_status(stock_current, stock_minimum) AS stock_status
FROM public.ingredients
WHERE stock_current <= stock_minimum
  AND is_active = true
ORDER BY stock_current / NULLIF(stock_minimum, 0) ASC;

-- Vista: Ventas del día con detalle
CREATE OR REPLACE VIEW public.v_today_sales AS
SELECT
  o.id,
  o.consecutive,
  o.business_unit,
  o.total,
  o.payment_method,
  o.type,
  o.status,
  o.created_at,
  up.full_name AS user_name
FROM public.orders o
LEFT JOIN public.user_profiles up ON up.id = o.user_id
WHERE
  DATE(o.created_at AT TIME ZONE 'America/Bogota') = CURRENT_DATE
  AND o.status != 'cancelado';

-- ══════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ══════════════════════════════════════════════════════════════

-- Verificación final
DO $$
DECLARE
  tbl_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tbl_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

  RAISE NOTICE '✅ FERCHOS POS — Schema creado exitosamente';
  RAISE NOTICE '📊 Total tablas en schema público: %', tbl_count;
  RAISE NOTICE '🔐 RLS habilitado en todas las tablas';
  RAISE NOTICE '⚡ Realtime habilitado en: orders, order_items, tables, ingredients';
  RAISE NOTICE '🌱 Datos semilla insertados: categorías, ingredientes, productos, mesas';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASOS:';
  RAISE NOTICE '1. Crear usuarios en Supabase Dashboard → Authentication → Users';
  RAISE NOTICE '2. Usuario admin: admin@ferchos.com / Ferchos2025!';
  RAISE NOTICE '3. Configurar variables de entorno en Vercel';
END $$;
