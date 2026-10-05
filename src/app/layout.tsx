// Schriften lokal ausliefern – keine Anfragen an Google (Datenschutz, schneller, offline)
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import type { Metadata } from "next";
import { StoreProvider } from "@/components/Store";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = { title: "Kanzlei – Prototyp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <StoreProvider>
          <div className="app">
            <TopBar />
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
