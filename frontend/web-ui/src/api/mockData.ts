// FAKE DATA for UI development only. Replaced by real API calls in Milestone 5.
import type { Product, SellerStatus, Role } from "../types";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string; // demo-only; real passwords are bcrypt-hashed in auth-svc
  role: Role;
  sellerStatus?: SellerStatus;
}

export const seedUsers: MockUser[] = [
  { id: "u-admin", name: "Admin", email: "admin@dhaga.test", password: "Admin@1234", role: "admin" },
  { id: "u-cust1", name: "Riya Shah", email: "customer@dhaga.test", password: "Customer@1234", role: "customer" },
  { id: "u-sell1", name: "Anaya Weaves", email: "seller@dhaga.test", password: "Seller@1234", role: "seller", sellerStatus: "approved" },
  { id: "u-sell2", name: "Loom & Co", email: "loom@dhaga.test", password: "Seller@1234", role: "seller", sellerStatus: "approved" },
  { id: "u-sell3", name: "New Threads", email: "pending@dhaga.test", password: "Seller@1234", role: "seller", sellerStatus: "pending" },
];

const sz = (...pairs: [string, number][]) => pairs.map(([size, stock]) => ({ size, stock }));

export const seedProducts: Product[] = [
  { id: "p1", name: "Indigo Block-Print Kurta", category: "Kurta", price: 1899, swatch: "#3b4a6b", sellerId: "u-sell1", sellerName: "Anaya Weaves",
    description: "Hand block-printed cotton kurta with a relaxed straight fit.", sizes: sz(["S", 8], ["M", 12], ["L", 6], ["XL", 0]) },
  { id: "p2", name: "Ivory Chanderi Saree", category: "Saree", price: 4599, swatch: "#e9e1cf", sellerId: "u-sell2", sellerName: "Loom & Co",
    description: "Lightweight Chanderi silk-cotton saree with a subtle zari border.", sizes: sz(["Free", 5]) },
  { id: "p3", name: "Terracotta Cotton Dupatta", category: "Dupatta", price: 799, swatch: "#b5573d", sellerId: "u-sell1", sellerName: "Anaya Weaves",
    description: "Soft mulmul dupatta, naturally dyed in earthy terracotta.", sizes: sz(["Free", 20]) },
  { id: "p4", name: "Sage Linen Shirt", category: "Shirt", price: 1499, swatch: "#8a9a7b", sellerId: "u-sell2", sellerName: "Loom & Co",
    description: "Breathable linen shirt with a clean collar and curved hem.", sizes: sz(["S", 4], ["M", 9], ["L", 9], ["XL", 3]) },
  { id: "p5", name: "Mustard Handloom Kurta", category: "Kurta", price: 2199, swatch: "#c79a2b", sellerId: "u-sell1", sellerName: "Anaya Weaves",
    description: "Handloom cotton kurta with side slits and a mandarin collar.", sizes: sz(["S", 2], ["M", 5], ["L", 0], ["XL", 0]) },
  { id: "p6", name: "Midnight Maxi Dress", category: "Dress", price: 3299, swatch: "#1f2a44", sellerId: "u-sell2", sellerName: "Loom & Co",
    description: "Flowing cotton-modal maxi dress with pockets.", sizes: sz(["S", 6], ["M", 6], ["L", 4]) },
  { id: "p7", name: "Rose Bandhani Dupatta", category: "Dupatta", price: 999, swatch: "#d19a9a", sellerId: "u-sell2", sellerName: "Loom & Co",
    description: "Traditional Bandhani tie-dye on soft georgette.", sizes: sz(["Free", 14]) },
  { id: "p8", name: "Charcoal Cotton Saree", category: "Saree", price: 2899, swatch: "#4a4744", sellerId: "u-sell1", sellerName: "Anaya Weaves",
    description: "Everyday cotton saree with a woven checks border.", sizes: sz(["Free", 11]) },
];
