import type { ReactElement } from "react";

// DEV ONLY (route is registered only when import.meta.env.DEV is true).
// Visit /__crash to confirm that the error boundary works.
export default function Crash(): ReactElement {
  throw new Error("Intentional test crash");
}
