import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition hover:text-thread ${isActive ? "text-thread font-medium" : "text-ink"}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-sand-200 bg-paper/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
        <Link to="/" className="font-display text-2xl tracking-tight">
          Dhaga<span className="text-thread">.</span>
        </Link>

        <div className="flex items-center gap-5">
          <NavLink to="/" end className={linkClass}>Shop</NavLink>
          {user?.role === "customer" && (
            <>
              <NavLink to="/cart" className={linkClass}>Cart</NavLink>
              <NavLink to="/orders" className={linkClass}>My orders</NavLink>
            </>
          )}
          {user?.role === "seller" && <NavLink to="/seller" className={linkClass}>Seller dashboard</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted sm:inline">
                {user.name} <span className="rounded bg-sand-200 px-1.5 py-0.5 text-xs">{user.role}</span>
              </span>
              <button className="btn-outline" onClick={onLogout}>Log out</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-outline">Log in</Link>
              <Link to="/signup" className="btn-primary">Sign up</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
