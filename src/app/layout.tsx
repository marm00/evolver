import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";

export const metadata = {
  title: "Evolver Game - Reverse Bullet Hell Roguelike",
  description: "Dive into the dynamic world of Evolver, a reality-based reverse bullet hell roguelike game. Experience intense gameplay, adaptive enemies, and a richly detailed environment.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
