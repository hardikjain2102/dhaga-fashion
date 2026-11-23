export type Role = "customer" | "seller" | "admin";
export type SellerStatus = "pending" | "approved" | "suspended";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  seller_status: SellerStatus | null;
  created_at: Date;
}
