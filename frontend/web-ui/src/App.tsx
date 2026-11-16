import { Route, Routes } from "react-router-dom";
import { RequireRole } from "./auth/RequireRole";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { ComingSoon, Forbidden, NotFound } from "./pages/Simple";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forbidden" element={<Forbidden />} />

        <Route path="cart" element={<RequireRole roles={["customer"]}><ComingSoon title="Cart" part="b" /></RequireRole>} />
        <Route path="orders" element={<RequireRole roles={["customer"]}><ComingSoon title="My orders" part="b" /></RequireRole>} />
        <Route path="seller" element={<RequireRole roles={["seller"]}><ComingSoon title="Seller dashboard" part="c" /></RequireRole>} />
        <Route path="admin" element={<RequireRole roles={["admin"]}><ComingSoon title="Admin panel" part="d" /></RequireRole>} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
