const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, "Home"],
  [/^\/products$/, "Shop"],
  [/^\/products\/[^/]+$/, "Product"],
  [/^\/login$/, "Log in"],
  [/^\/signup$/, "Sign up"],
  [/^\/forbidden$/, "Not allowed"],
  [/^\/cart$/, "Cart"],
  [/^\/checkout$/, "Checkout"],
  [/^\/pay\/[^/]+$/, "Payment"],
  [/^\/orders$/, "My orders"],
  [/^\/orders\/[^/]+$/, "Order"],
  [/^\/seller$/, "Seller dashboard"],
  [/^\/seller\/products$/, "Seller products"],
  [/^\/seller\/products\/(new|[^/]+\/edit)$/, "Seller product form"],
  [/^\/seller\/orders$/, "Seller orders"],
  [/^\/admin$/, "Admin overview"],
  [/^\/admin\/users$/, "Admin users"],
  [/^\/admin\/products$/, "Admin products"],
  [/^\/admin\/orders$/, "Admin orders"],
];

export function titleFor(pathname: string): string {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const [pattern, title] of TITLES) {
    if (pattern.test(clean)) return title;
  }
  return "Page not found";
}
