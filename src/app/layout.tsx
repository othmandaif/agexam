import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NavProgress } from "@/components/navigation/nav-progress";
import { NavTracker } from "@/components/navigation/nav-tracker";
import { QueryProvider } from "@/components/providers/query-provider";
import { APP_NAME } from "@/lib/routes";
import { inter, jetbrains } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Examens QCM en ligne, sereins et équitables.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#315bef",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Suspense fallback={null}>
          <NavTracker />
          <NavProgress />
        </Suspense>
      </body>
    </html>
  );
}
