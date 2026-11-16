// Single entry point for all backend calls.
// Milestone 5 replaces the bodies below with real fetch() calls to /api/*.
import { seedProducts, seedUsers, type MockUser } from "./mockData";
import type { Product, ProductQuery, SignupInput, User } from "../types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const SESSION_KEY = "dhaga.session";

const users: MockUser[] = [...seedUsers];
const products: Product[] = [...seedProducts];

const toUser = (u: MockUser): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  sellerStatus: u.sellerStatus,
});

const saveSession = (user: User) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));

export const api = {
  getSession(): User | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
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
};
