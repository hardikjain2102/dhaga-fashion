import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { homeFor, useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(from ?? homeFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-3xl">Log in</h1>
      <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" required
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-thread">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !email || !password}>
          {busy ? "Logging in..." : "Log in"}
        </button>
        <p className="text-center text-sm text-muted">
          New here? <Link to="/signup" className="text-thread underline">Create an account</Link>
        </p>
      </form>

      <details className="mt-6 rounded-md bg-sand-100 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Demo accounts (mock data, development only)</summary>
        <ul className="mt-2 space-y-1 text-muted">
          <li>customer@dhaga.test / Customer@1234</li>
          <li>seller@dhaga.test / Seller@1234 (approved)</li>
          <li>pending@dhaga.test / Seller@1234 (awaiting approval)</li>
          <li>admin@dhaga.test / Admin@1234</li>
        </ul>
      </details>
    </div>
  );
}
