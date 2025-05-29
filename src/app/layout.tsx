import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import CursorLightEffect from '~/components/effects/CursorLightEffect';
import Providers from './providers';

export const metadata: Metadata = {
  title: "Jello Kanban",
  description: "Jello Kanban is a simple and effective way to manage your projects and tasks.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
        <CursorLightEffect />
      </body>
    </html>
  );
}
