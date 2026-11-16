import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { homeFor, useAuth } from "../auth/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"customer" | "seller">("customer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setBusy(true);
    try {
      const user = await signup({ name, email, password, role });
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-3xl">Create your account</h1>
      <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
        <fieldset>
          <legend className="label">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["customer", "seller"] as const).map((r) => (
              <label key={r}
                className={`cursor-pointer rounded-md border p-3 text-center text-sm ${
                  role === r ? "border-thread bg-thread-soft" : "border-sand-300"
                }`}>
                <input type="radio" name="role" value={r} className="sr-only"
                       checked={role === r} onChange={() => setRole(r)} />
                {r === "customer" ? "Shop" : "Sell my products"}
              </label>
            ))}
          </div>
          {role === "seller" && (
            <p className="mt-2 text-xs text-muted">Seller accounts need admin approval before you can list products.</p>
          )}
        </fieldset>

        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" className="input" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirm password</label>
          <input id="confirm" type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>

        {error && <p role="alert" className="text-sm text-thread">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
        <p className="text-center text-sm text-muted">
          Already registered? <Link to="/login" className="text-thread underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
