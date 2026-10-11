import type { NextConfig } from "next";

/**
 * En-têtes de sécurité appliqués à toutes les pages.
 * La CSP stricte (nonce) sera ajoutée quand les écrans d'examen seront développés.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  experimental: {
    // Import Excel des étudiants : fichiers jusqu'à 2 Mo (+ marge multipart).
    serverActions: { bodySizeLimit: "3mb" },
  },
  // exceljs reste un module Node classique (non empaqueté).
  serverExternalPackages: ["exceljs", "pdfkit"],
  // Polices embarquées dans les PDF (lues sur disque à l'exécution).
  outputFileTracingIncludes: {
    "/api/v1/exams/**": ["./assets/fonts/**", "./public/ofppt.*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
