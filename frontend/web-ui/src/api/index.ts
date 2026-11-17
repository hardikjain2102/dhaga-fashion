// Single entry point for all backend calls.
// Milestone 5 replaces the bodies below with real fetch() calls to /api/*.
import { seedProducts, seedUsers, type MockUser } from "./mockData";
import {
  CATEGORIES,
  type Address, type Cart, type CartLine, type Fulfilment, type Order, type Product,
  type ProductInput, type ProductQuery, type SellerOrderItem, type SignupInput, type User,
} from "../types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- tiny sessionStorage helpers (mock persistence only) ----------
const SESSION_KEY = "dhaga.session";
const CARTS_KEY = "dhaga.carts";
const ORDERS_KEY = "dhaga.orders";
const USERS_KEY = "dhaga.users";
const PRODUCTS_KEY = "dhaga.products";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: mock state just won't persist */
  }
}

// ---------- in-memory "database" ----------
const users: MockUser[] = load<MockUser[]>(USERS_KEY, seedUsers.map((u) => ({ ...u })));
const products: Product[] = load<Product[]>(
  PRODUCTS_KEY,
  seedProducts.map((p) => ({ ...p, sizes: p.sizes.map((s) => ({ ...s })) }))
);

interface RawLine { productId: string; size: string; quantity: number }
const carts: Record<string, RawLine[]> = load(CARTS_KEY, {});
const orders: Order[] = load(ORDERS_KEY, []);

const persist = () => {
  save(CARTS_KEY, carts);
  save(ORDERS_KEY, orders);
  save(USERS_KEY, users);
  save(PRODUCTS_KEY, products);
};

// ---------- helpers ----------
const toUser = (u: MockUser): User => ({
  id: u.id, name: u.name, email: u.email, role: u.role, sellerStatus: u.sellerStatus,
});

const saveSession = (user: User) => save(SESSION_KEY, user);

function requireCustomer(): User {
  const u = api.getSession();
  if (!u) throw new ApiError(401, "Please log in.");
  if (u.role !== "customer") throw new ApiError(403, "Only customer accounts can do this.");
  return u;
}

// Sellers: role check, plus (for writes) a fresh status check against the user record.
// The status in the session copy can be stale, so it is never trusted for writes.
function requireSeller(mustBeApproved: boolean): User {
  const session = api.getSession();
  if (!session) throw new ApiError(401, "Please log in.");
  if (session.role !== "seller") throw new ApiError(403, "Only seller accounts can do this.");
  const record = users.find((u) => u.id === session.id);
  const status = record?.sellerStatus ?? session.sellerStatus;
  if (mustBeApproved && status !== "approved") {
    throw new ApiError(
      403,
      status === "suspended"
        ? "Your seller account is suspended."
        : "Your seller account is awaiting admin approval."
    );
  }
  return session;
}

function findSize(productId: string, size: string) {
  const product = products.find((p) => p.id === productId);
  if (!product) throw new ApiError(404, "Product not found.");
  const entry = product.sizes.find((s) => s.size === size);
  if (!entry) throw new ApiError(400, "Invalid size.");
  return { product, entry };
}

function buildCart(userId: string): Cart {
  const lines: CartLine[] = [];
  for (const raw of carts[userId] ?? []) {
    const product = products.find((p) => p.id === raw.productId);
    const entry = product?.sizes.find((s) => s.size === raw.size);
    if (!product || !entry) continue;
    lines.push({
      productId: product.id,
      name: product.name,
      swatch: product.swatch,
      size: raw.size,
      unitPrice: product.price,
      quantity: raw.quantity,
      available: entry.stock,
      lineTotal: product.price * raw.quantity,
    });
  }
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

function releaseStock(order: Order) {
  for (const item of order.items) {
    const entry = products.find((p) => p.id === item.productId)?.sizes.find((s) => s.size === item.size);
    if (entry) entry.stock += item.quantity;
  }
}

// Mock of the stale-order CronJob: PENDING orders past expiry are cancelled and stock is released.
function expireStale() {
  const now = Date.now();
  let changed = false;
  for (const o of orders) {
    if (o.status === "PENDING" && new Date(o.expiresAt).getTime() < now) {
      o.status = "CANCELLED";
      releaseStock(o);
      changed = true;
    }
  }
  if (changed) persist();
}

// Server-side style validation. The browser form validates too, but this is the one that counts.
function cleanProduct(input: ProductInput): ProductInput {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 80) throw new ApiError(400, "Name must be 3 to 80 characters.");
  if (!(CATEGORIES as readonly string[]).includes(input.category)) throw new ApiError(400, "Invalid category.");
  if (!Number.isInteger(input.price) || input.price < 1 || input.price > 1_000_000) {
    throw new ApiError(400, "Price must be a whole number of rupees between 1 and 1,000,000.");
  }
  const description = input.description.trim();
  if (description.length < 10 || description.length > 500) {
    throw new ApiError(400, "Description must be 10 to 500 characters.");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(input.swatch)) throw new ApiError(400, "Invalid colour.");
  if (input.sizes.length === 0 || input.sizes.length > 8) throw new ApiError(400, "Add 1 to 8 sizes.");

  const seen = new Set<string>();
  const sizes = input.sizes.map((s) => {
    const size = s.size.trim();
    if (!size || size.length > 10) throw new ApiError(400, "Each size needs a label of up to 10 characters.");
    if (seen.has(size.toLowerCase())) throw new ApiError(400, `Size "${size}" is listed twice.`);
    seen.add(size.toLowerCase());
    if (!Number.isInteger(s.stock) || s.stock < 0 || s.stock > 100_000) {
      throw new ApiError(400, `Stock for size "${size}" must be a whole number from 0 to 100000.`);
    }
    return { size, stock: s.stock };
  });
  return { name, category: input.category, price: input.price, description, swatch: input.swatch, sizes };
}

const NEXT_STEP: Record<Fulfilment, Fulfilment | null> = {
  placed: "packed",
  packed: "shipped",
  shipped: "delivered",
  delivered: null,
};

// ---------- the API ----------
export const api = {
  getSession(): User | null {
    return load<User | null>(SESSION_KEY, null);
  },

  // Re-reads the user record so a status change (for example admin approval) shows up.
  async refreshSession(): Promise<User | null> {
    const session = api.getSession();
    if (!session) return null;
    await delay(150);
    const record = users.find((u) => u.id === session.id);
    if (!record) return session;
    const fresh = toUser(record);
    saveSession(fresh);
    return fresh;
  },

  async login(email: string, password: string): Promise<User> {
    await delay();
    const found = users.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
    if (!found) throw new ApiError(401, "Invalid email or password.");
    if (found.role === "seller" && found.sellerStatus === "suspended") {
      throw new ApiError(403, "This seller account is suspended.");
    }
    const user = toUser(found);
    saveSession(user);
    return user;
  },

  async signup(input: SignupInput): Promise<User> {
    await delay();
    const email = input.email.trim().toLowerCase();
    if (users.some((u) => u.email === email)) throw new ApiError(409, "An account with this email already exists.");
    const created: MockUser = {
      id: `u-${Date.now()}`,
      name: input.name.trim(),
      email,
      password: input.password,
      role: input.role,
      sellerStatus: input.role === "seller" ? "pending" : undefined,
    };
    users.push(created);
    persist();
    const user = toUser(created);
    saveSession(user);
    return user;
  },

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
  },

  // ----- catalog (public reads) -----
  async listProducts(query: ProductQuery = {}): Promise<Product[]> {
    await delay();
    const q = query.q?.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!query.category || p.category === query.category) &&
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    );
  },

  async getProduct(id: string): Promise<Product> {
    await delay();
    const p = products.find((x) => x.id === id);
    if (!p) throw new ApiError(404, "Product not found.");
    return p;
  },

  // ----- seller: own products -----
  async listMyProducts(): Promise<Product[]> {
    const user = requireSeller(false);
    await delay();
    return products.filter((p) => p.sellerId === user.id);
  },

  async createProduct(input: ProductInput): Promise<Product> {
    const user = requireSeller(true);
    await delay();
    const data = cleanProduct(input);
    const product: Product = {
      id: `p-${Date.now().toString(36)}`,
      ...data,
      sellerId: user.id, // taken from the logged-in user, never from the request
      sellerName: user.name,
    };
    products.push(product);
    persist();
    return product;
  },

  async updateProduct(id: string, input: ProductInput): Promise<Product> {
    const user = requireSeller(true);
    await delay();
    const product = products.find((p) => p.id === id);
    if (!product) throw new ApiError(404, "Product not found.");
    if (product.sellerId !== user.id) throw new ApiError(403, "You can only edit your own products.");
    Object.assign(product, cleanProduct(input));
    persist();
    return product;
  },

  async deleteProduct(id: string): Promise<void> {
    const user = requireSeller(true);
    await delay();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) throw new ApiError(404, "Product not found.");
    if (products[idx].sellerId !== user.id) throw new ApiError(403, "You can only delete your own products.");
    products.splice(idx, 1);
    persist();
  },

  // ----- seller: fulfilment of own items in PAID orders -----
  async listMyOrderItems(): Promise<SellerOrderItem[]> {
    const user = requireSeller(false);
    await delay();
    expireStale();
    const rows: SellerOrderItem[] = [];
    for (const o of orders) {
      if (o.status !== "PAID") continue;
      for (const i of o.items) {
        if (i.sellerId !== user.id) continue;
        rows.push({
          orderId: o.id,
          createdAt: o.createdAt,
          productId: i.productId,
          name: i.name,
          size: i.size,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          fulfilment: i.fulfilment,
          address: o.address,
        });
      }
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async advanceFulfilment(orderId: string, productId: string, size: string): Promise<void> {
    const user = requireSeller(true);
    await delay(200);
    const order = orders.find((o) => o.id === orderId && o.status === "PAID");
    const item = order?.items.find((i) => i.productId === productId && i.size === size);
    if (!order || !item) throw new ApiError(404, "Order item not found.");
    if (item.sellerId !== user.id) throw new ApiError(403, "This item belongs to another seller.");
    const next = NEXT_STEP[item.fulfilment];
    if (!next) throw new ApiError(409, "This item is already delivered.");
    item.fulfilment = next;
    persist();
  },

  // ----- cart (customer only) -----
  async getCart(): Promise<Cart> {
    const user = requireCustomer();
    await delay(100);
    return buildCart(user.id);
  },

  async addToCart(productId: string, size: string, quantity = 1): Promise<Cart> {
    const user = requireCustomer();
    await delay(100);
    const { entry } = findSize(productId, size);
    const cart = (carts[user.id] ??= []);
    const existing = cart.find((l) => l.productId === productId && l.size === size);
    const wanted = (existing?.quantity ?? 0) + quantity;
    if (entry.stock === 0) throw new ApiError(409, "This size is out of stock.");
    if (wanted > entry.stock) throw new ApiError(409, `Only ${entry.stock} left in size ${size}.`);
    if (existing) existing.quantity = wanted;
    else cart.push({ productId, size, quantity });
    persist();
    return buildCart(user.id);
  },

  async setCartQuantity(productId: string, size: string, quantity: number): Promise<Cart> {
    const user = requireCustomer();
    await delay(100);
    const cart = (carts[user.id] ??= []);
    const idx = cart.findIndex((l) => l.productId === productId && l.size === size);
    if (idx === -1) throw new ApiError(404, "Item is not in your cart.");
    if (quantity <= 0) {
      cart.splice(idx, 1);
    } else {
      const { entry } = findSize(productId, size);
      if (quantity > entry.stock) throw new ApiError(409, `Only ${entry.stock} left in size ${size}.`);
      cart[idx].quantity = quantity;
    }
    persist();
    return buildCart(user.id);
  },

  async removeFromCart(productId: string, size: string): Promise<Cart> {
    return api.setCartQuantity(productId, size, 0);
  },

  // ----- orders (customer only, own orders only) -----
  async checkout(address: Address): Promise<Order> {
    const user = requireCustomer();
    await delay(400);
    const cart = buildCart(user.id);
    if (cart.lines.length === 0) throw new ApiError(400, "Your cart is empty.");

    // 1) validate every line first, so a failure changes nothing (mock of the DB transaction)
    for (const line of cart.lines) {
      const { entry } = findSize(line.productId, line.size);
      if (line.quantity > entry.stock) {
        throw new ApiError(409, `${line.name} (${line.size}): only ${entry.stock} left. Update your cart.`);
      }
    }
    // 2) reserve stock
    const items = cart.lines.map((line) => {
      const { product, entry } = findSize(line.productId, line.size);
      entry.stock -= line.quantity;
      return {
        productId: product.id,
        name: product.name,
        size: line.size,
        unitPrice: product.price,
        quantity: line.quantity,
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        fulfilment: "placed" as const,
      };
    });
    // 3) create the PENDING order and clear the cart
    const now = Date.now();
    const order: Order = {
      id: `DF-${now.toString(36).toUpperCase()}`,
      userId: user.id,
      status: "PENDING",
      items,
      total: cart.total,
      address,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    };
    orders.push(order);
    carts[user.id] = [];
    persist();
    return order;
  },

  async payOrder(orderId: string, outcome: "success" | "failure"): Promise<Order> {
    const user = requireCustomer();
    await delay(600);
    expireStale();
    const order = orders.find((o) => o.id === orderId && o.userId === user.id);
    if (!order) throw new ApiError(404, "Order not found.");
    if (order.status !== "PENDING") throw new ApiError(409, `Order is already ${order.status}.`);
    if (outcome === "success") {
      order.status = "PAID";
    } else {
      order.status = "CANCELLED";
      releaseStock(order);
    }
    persist();
    return order;
  },

  async listMyOrders(): Promise<Order[]> {
    const user = requireCustomer();
    await delay();
    expireStale();
    return orders
      .filter((o) => o.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getOrder(id: string): Promise<Order> {
    const user = requireCustomer();
    await delay();
    expireStale();
    const order = orders.find((o) => o.id === id && o.userId === user.id);
    if (!order) throw new ApiError(404, "Order not found.");
    return order;
  },
};
