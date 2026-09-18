import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toasts";

export const metadata: Metadata = {
  title: "WorkshopGuard — Customer Communication Assistant",
  description:
    "Conflict-aware customer communication for vehicle workshops—safe multilingual drafts, employee approvals, communication preferences and auditable status updates.",
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
