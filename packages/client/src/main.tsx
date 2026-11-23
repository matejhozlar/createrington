import { createRoot } from "react-dom/client";
import { z } from "zod";
import { AnimatedIconProvider } from "@createrington/icons";
import App from "./App.tsx";
import "./index.css";

z.config({ jitless: true });

createRoot(document.getElementById("root")!).render(
  <AnimatedIconProvider>
    <App />
  </AnimatedIconProvider>,
);
