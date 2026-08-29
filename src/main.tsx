import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";
import { App } from "./App";
import { QuickChat } from "@/components/chat/QuickChat";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { installGlobalErrorHandlers } from "@/lib/errors";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found.");
const isQuickChat = new URLSearchParams(window.location.search).get("window") === "quick-chat";
if (isQuickChat) document.documentElement.classList.add("quick-chat-window");
installGlobalErrorHandlers();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {isQuickChat ? <QuickChat /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
