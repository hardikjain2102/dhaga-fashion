// Single entry point for all backend calls.
// Milestone 5 replaces the bodies below with real fetch() calls to /api/*.
import { seedProducts, seedUsers, type MockUser } from "./mockData";
import type {
  Address, Cart, CartLine, Order, Product, ProductQuery, SignupInput, User,
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
const STOCK_KEY = "dhaga.stock";

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
const users: MockUser[] = [...seedUsers];
const products: Product[] = seedProducts.map((p) => ({ ...p, sizes: p.sizes.map((s) => ({ ...s })) }));

const savedStock = load<Record<string, number>>(STOCK_KEY, {});
products.forEach((p) =>
  p.sizes.forEach((s) => {
    const k = `${p.id}|${s.size}`;
    if (k in savedStock) s.stock = savedStock[k];
  })
);

interface RawLine { productId: string; size: string; quantity: number }
const carts: Record<string, RawLine[]> = load(CARTS_KEY, {});
const orders: Order[] = load(ORDERS_KEY, []);

const persist = () => {
  save(CARTS_KEY, carts);
  save(ORDERS_KEY, orders);
  const stock: Record<string, number> = {};
  products.forEach((p) => p.sizes.forEach((s) => (stock[`${p.id}|${s.size}`] = s.stock)));
  save(STOCK_KEY, stock);
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

// ---------- the API ----------
export const api = {
  getSession(): User | null {
    return load<User | null>(SESSION_KEY, null);
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
    const user = toUser(created);
    saveSession(user);
    return user;
  },

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
  },

  // ----- catalog -----
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
