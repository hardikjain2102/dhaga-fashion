export type Role = "customer" | "seller" | "admin";
export type SellerStatus = "pending" | "approved" | "suspended";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  sellerStatus?: SellerStatus; // only for sellers
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: "customer" | "seller"; // admins are never self-registered
}

export const CATEGORIES = ["Kurta", "Saree", "Dupatta", "Shirt", "Dress"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface SizeStock {
  size: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number; // INR
  description: string;
  sizes: SizeStock[];
  swatch: string; // placeholder colour instead of an image
  sellerId: string;
  sellerName: string;
}

export interface ProductQuery {
  q?: string;
  category?: Category | "";
}

// What a seller submits when creating or editing a product.
// sellerId and sellerName are NOT part of it: the server takes them from the logged-in user.
export interface ProductInput {
  name: string;
  category: Category;
  price: number;
  description: string;
  swatch: string;
  sizes: SizeStock[];
}

// ---------- cart ----------
export interface CartLine {
  productId: string;
  name: string;
  swatch: string;
  size: string;
  unitPrice: number;
  quantity: number;
  available: number; // current stock for this size
  lineTotal: number;
}

export interface Cart {
  lines: CartLine[];
  total: number;
  itemCount: number;
}

// ---------- orders ----------
export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";
export type Fulfilment = "placed" | "packed" | "shipped" | "delivered";

export interface OrderItem {
  productId: string;
  name: string;
  size: string;
  unitPrice: number;
  quantity: number;
  sellerId: string;
  sellerName: string;
  fulfilment: Fulfilment;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  address: Address;
  createdAt: string; // ISO
  expiresAt: string; // ISO, PENDING orders are cancelled after this time
}

// One row in the seller's fulfilment list: an item of a PAID order that belongs to this seller.
export interface SellerOrderItem {
  orderId: string;
  createdAt: string;
  productId: string;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
  fulfilment: Fulfilment;
  address: Address; // needed to ship; only exposed for PAID orders
}
