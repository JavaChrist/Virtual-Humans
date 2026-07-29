import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { CharacterProvider } from "@/lib/character-context";
import { ConfirmProvider } from "@/components/confirm";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Virtual Humans Studio",
  description: "Generate images, voice and video for your virtual human — with live budget estimates.",
  applicationName: "Virtual Humans Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VH Studio",
  },
  icons: {
    // ?v=8 : casse le cache navigateur/OS pour forcer le rechargement du favicon.
    icon: [
      { url: "/icon.svg?v=8", type: "image/svg+xml" },
      { url: "/favicon.ico?v=8", sizes: "48x48", type: "image/x-icon" },
      { url: "/icons/icon-192.png?v=8", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=8", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=8", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">
        <CharacterProvider>
          <ConfirmProvider>
            <div className="flex min-h-screen flex-col md:flex-row">
              <Nav />
              <main
                className="flex-1 min-w-0 pt-5 md:pt-8 content-x"
                style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
              >
                {children}
              </main>
            </div>
          </ConfirmProvider>
        </CharacterProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
