import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireRole } from "./auth/RequireRole";
import Layout from "./components/Layout";
import AdminHome from "./pages/admin/AdminHome";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminUsers from "./pages/admin/AdminUsers";
import CartPage from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Crash from "./pages/Crash";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MockPayment from "./pages/MockPayment";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import SellerHome from "./pages/seller/SellerHome";
import SellerLayout from "./pages/seller/SellerLayout";
import SellerOrders from "./pages/seller/SellerOrders";
import SellerProductForm from "./pages/seller/SellerProductForm";
import SellerProducts from "./pages/seller/SellerProducts";
import Signup from "./pages/Signup";
import { Forbidden, NotFound } from "./pages/Simple";

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

        <Route path="seller" element={<RequireRole roles={["seller"]}><SellerLayout /></RequireRole>}>
          <Route index element={<SellerHome />} />
          <Route path="products" element={<SellerProducts />} />
          <Route path="products/new" element={<SellerProductForm />} />
          <Route path="products/:id/edit" element={<SellerProductForm />} />
          <Route path="orders" element={<SellerOrders />} />
        </Route>

        <Route path="admin" element={<RequireRole roles={["admin"]}><AdminLayout /></RequireRole>}>
          <Route index element={<AdminHome />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
        </Route>

        {import.meta.env.DEV && <Route path="__crash" element={<Crash />} />}

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
