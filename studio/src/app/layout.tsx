import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { CharacterProvider } from "@/lib/character-context";

export const metadata: Metadata = {
  title: "Virtual Humans Studio",
  description: "Generate images, voice and video for your virtual human — with live budget estimates.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">
        <CharacterProvider>
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 min-w-0 px-6 py-8 md:px-10">{children}</main>
          </div>
        </CharacterProvider>
      </body>
    </html>
  );
}
