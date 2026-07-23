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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
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
            <div className="flex min-h-screen">
              <Nav />
              <main className="flex-1 min-w-0 px-6 py-8 md:px-10">{children}</main>
            </div>
          </ConfirmProvider>
        </CharacterProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
