CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('customer', 'seller', 'admin')),
  seller_status text CHECK (seller_status IN ('pending', 'approved', 'suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- sellers always have a status, everyone else never does
  CONSTRAINT seller_status_matches_role CHECK (
    (role = 'seller' AND seller_status IS NOT NULL) OR (role <> 'seller' AND seller_status IS NULL)
  )
);

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,   -- SHA-256 of the token; the token itself is never stored
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
