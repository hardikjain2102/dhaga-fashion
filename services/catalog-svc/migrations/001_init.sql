CREATE TABLE products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL,            -- owned by auth-svc; no foreign key across services
  seller_name text NOT NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  category    text NOT NULL CHECK (category IN ('Kurta', 'Saree', 'Dupatta', 'Shirt', 'Dress')),
  price       integer NOT NULL CHECK (price BETWEEN 1 AND 1000000),   -- whole rupees
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
  swatch      text NOT NULL CHECK (swatch ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_seller_idx   ON products (seller_id);
CREATE INDEX products_category_idx ON products (category);

CREATE TABLE product_sizes (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size       text NOT NULL CHECK (char_length(size) BETWEEN 1 AND 10),
  stock      integer NOT NULL CHECK (stock BETWEEN 0 AND 100000),     -- can never go negative
  position   smallint NOT NULL,                                       -- keeps the seller's size order
  PRIMARY KEY (product_id, size)
);

-- One row per order. Makes reserve/commit/release safe to retry and impossible to double-apply.
CREATE TABLE stock_reservations (
  order_id   text PRIMARY KEY CHECK (char_length(order_id) BETWEEN 1 AND 64),
  status     text NOT NULL CHECK (status IN ('reserved', 'committed', 'released')),
  items      jsonb NOT NULL,            -- [{productId, size, quantity}]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
