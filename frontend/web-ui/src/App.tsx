import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireRole } from "./auth/RequireRole";
import Layout from "./components/Layout";
import CartPage from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MockPayment from "./pages/MockPayment";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import Signup from "./pages/Signup";
import { ComingSoon, Forbidden, NotFound } from "./pages/Simple";

const customerOnly = (page: ReactNode) => <RequireRole roles={["customer"]}>{page}</RequireRole>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forbidden" element={<Forbidden />} />

        <Route path="cart" element={customerOnly(<CartPage />)} />
        <Route path="checkout" element={customerOnly(<Checkout />)} />
        <Route path="pay/:orderId" element={customerOnly(<MockPayment />)} />
        <Route path="orders" element={customerOnly(<Orders />)} />
        <Route path="orders/:id" element={customerOnly(<OrderDetail />)} />

        <Route path="seller" element={<RequireRole roles={["seller"]}><ComingSoon title="Seller dashboard" part="c" /></RequireRole>} />
        <Route path="admin" element={<RequireRole roles={["admin"]}><ComingSoon title="Admin panel" part="d" /></RequireRole>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
