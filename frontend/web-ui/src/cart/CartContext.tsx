import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { Cart } from "../types";

const EMPTY: Cart = { lines: [], total: 0, itemCount: 0 };

interface CartValue {
  cart: Cart;
  refresh: () => Promise<void>;
  add: (productId: string, size: string, quantity?: number) => Promise<void>;
  setQuantity: (productId: string, size: string, quantity: number) => Promise<void>;
  remove: (productId: string, size: string) => Promise<void>;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart>(EMPTY);
  const isCustomer = user?.role === "customer";

  const refresh = useCallback(async () => {
    if (!isCustomer) {
      setCart(EMPTY);
      return;
    }
    try {
      setCart(await api.getCart());
    } catch {
      setCart(EMPTY);
    }
  }, [isCustomer]);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  const add = useCallback(async (productId: string, size: string, quantity = 1) => {
    setCart(await api.addToCart(productId, size, quantity));
  }, []);
  const setQuantity = useCallback(async (productId: string, size: string, quantity: number) => {
    setCart(await api.setCartQuantity(productId, size, quantity));
  }, []);
  const remove = useCallback(async (productId: string, size: string) => {
    setCart(await api.removeFromCart(productId, size));
  }, []);

  const value = useMemo(
    () => ({ cart, refresh, add, setQuantity, remove }),
    [cart, refresh, add, setQuantity, remove]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
