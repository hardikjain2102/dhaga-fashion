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

export type Category = "Kurta" | "Saree" | "Dupatta" | "Shirt" | "Dress";

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
