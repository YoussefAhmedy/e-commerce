/**
 * Ordered, idempotent migrations. Each entry runs once, inside a transaction,
 * and is recorded in the _migrations ledger.
 *
 * Conventions:
 *  - ids are TEXT (UUID/ulid-style strings generated in app code)
 *  - money is INTEGER cents, currency is TEXT ISO-4217
 *  - timestamps are TEXT ISO-8601 UTC via strftime defaults
 *  - enums are TEXT + CHECK constraints (portable across sqlite/postgres)
 *  - json payloads are TEXT (validated by zod at the application boundary)
 */
export const migrations: Array<{ id: string; sql: string }> = [
  {
    id: '0001_init',
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER','ADMIN')),
  email_verified_at TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- sha256 of the bearer token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('VERIFY_EMAIL','PASSWORD_RESET')),
  token_hash TEXT NOT NULL UNIQUE,  -- sha256 of emailed token
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, purpose);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('POSTER','FRAME')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  compare_at_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  tags TEXT NOT NULL DEFAULT '[]',       -- json array of strings
  attributes TEXT NOT NULL DEFAULT '{}', -- json object (material, color, paper...)
  featured INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_featured ON products(featured, status);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_images_product ON product_images(product_id, position);

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,                        -- "50 × 70 cm" / "Oak · Natural"
  options TEXT NOT NULL DEFAULT '{}',        -- json {size: '50x70'} etc.
  price_delta_cents INTEGER NOT NULL DEFAULT 0,  -- added to base price
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_variants_product ON product_variants(product_id, active);

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  original_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,           -- guest bearer token (cookie)
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CHECKED_OUT','ABANDONED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_carts_user ON carts(user_id, status);

CREATE TABLE cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  customization TEXT,                   -- json {uploadId, note, sizeId...} for custom builds
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (cart_id, variant_id, customization)
);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

CREATE TABLE addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

CREATE TABLE coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('PERCENT','FIXED')),
  value INTEGER NOT NULL CHECK (value > 0),   -- percent 1..100 or cents
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  max_redemptions INTEGER,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,                -- human number PRT-XXXXXX
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_email TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','PAID','FAILED','REFUNDED')),
  fulfillment_status TEXT NOT NULL DEFAULT 'UNFULFILLED' CHECK (fulfillment_status IN ('UNFULFILLED','PROCESSING','SHIPPED','DELIVERED')),
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  coupon_id TEXT REFERENCES coupons(id) ON DELETE SET NULL,
  shipping_address TEXT NOT NULL,           -- json snapshot
  shipping_method TEXT NOT NULL DEFAULT 'STANDARD',
  tracking_number TEXT,
  carrier TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,     -- prevents duplicate orders on retry
  placed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_orders_user ON orders(user_id, placed_at DESC);
CREATE INDEX idx_orders_status ON orders(status, payment_status);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,                        -- snapshot (immutable history)
  sku TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '{}',        -- json snapshot (size/frame/upload)
  preview_url TEXT,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,         -- purchase-time price (never recalculated)
  line_total_cents INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUIRES_CONFIRMATION' CHECK (status IN ('REQUIRES_CONFIRMATION','SUCCEEDED','FAILED','REFUNDED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, intent_id)
);
CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  order_id TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','FAILED','IGNORED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, event_id)                 -- webhook idempotency guard
);

CREATE TABLE coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (coupon_id, order_id)
);
CREATE INDEX idx_redemptions_coupon ON coupon_redemptions(coupon_id);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  verified_purchase INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  UNIQUE (product_id, user_id)
);
CREATE INDEX idx_reviews_product ON reviews(product_id, status);

CREATE TABLE wishlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, product_id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                          -- ORDER_PAID | ORDER_SHIPPED | ...
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);

CREATE TABLE email_log (
  id TEXT PRIMARY KEY,
  to_addr TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','FAILED')),
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at TEXT
);
CREATE INDEX idx_email_log_status ON email_log(status, next_attempt_at);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,             -- e.g. ADMIN_PRODUCT_UPDATE, LOGIN_FAILED
  entity TEXT,
  entity_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- PRODUCT_VIEW | ADD_TO_CART | SEARCH | PURCHASE
  product_id TEXT,
  user_id TEXT,
  session_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_analytics_type_created ON analytics_events(type, created_at);
CREATE INDEX idx_analytics_product ON analytics_events(product_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`,
  },
]
