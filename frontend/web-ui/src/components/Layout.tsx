import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { titleFor } from "../lib/titles";
import ErrorBoundary from "./ErrorBoundary";
import Navbar from "./Navbar";

export default function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    document.title = `${titleFor(pathname)} | Dhaga Fashion`;
    // Only on real page changes (not on first load): scroll to top and move focus to the content.
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      window.scrollTo(0, 0);
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <Navbar />
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none"
      >
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-sand-200 py-6 text-center text-sm text-muted">
        Dhaga Fashion. Handcrafted threads, delivered.
      </footer>
    </div>
  );
}
