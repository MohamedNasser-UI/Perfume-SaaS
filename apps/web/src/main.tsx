import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { App } from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const client = new QueryClient();

function ToasterHost() {
  const { locale } = useI18n();
  return <Toaster richColors position={locale === "ar" ? "top-left" : "top-right"} dir={locale === "ar" ? "rtl" : "ltr"} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <ToasterHost />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
