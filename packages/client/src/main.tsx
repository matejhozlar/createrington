import { createRoot } from "react-dom/client";
import { z } from "zod";
import App from "./App.tsx";
import "./index.css";

// Disable zod v4's JIT (which uses `new Function()`) so we can keep a
// strict CSP without `unsafe-eval`.
z.config({ jitless: true });

createRoot(document.getElementById("root")!).render(<App />);
