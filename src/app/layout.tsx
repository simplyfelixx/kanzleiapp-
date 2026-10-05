import "./globals.css";
import type { Metadata } from "next";
import { StoreProvider } from "@/components/Store";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = { title: "Kanzlei – Prototyp" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
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
