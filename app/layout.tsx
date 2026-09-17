import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toasts";

export const metadata: Metadata = {
  title: "Autohaus Frisch Communication Assistant — unofficial prototype",
  description:
    "Unofficial prototype built for a workshop exercise. Not an Autohaus Frisch service. All records are synthetic.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* suppressHydrationWarning covers attributes injected into <html>/<body> by
       browser extensions before React hydrates. It is shallow: mismatches
       inside the app still report normally. */
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
