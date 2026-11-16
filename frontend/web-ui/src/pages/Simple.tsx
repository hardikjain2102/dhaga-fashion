import { Link } from "react-router-dom";

export function ComingSoon({ title, part }: { title: string; part: string }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 text-muted">This screen is built in Milestone 4{part}.</p>
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="text-3xl">Not allowed</h1>
      <p className="mt-2 text-muted">Your account does not have access to this page.</p>
      <Link to="/" className="btn-primary mt-6">Back to shop</Link>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="text-3xl">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">Back to shop</Link>
    </div>
  );
}
