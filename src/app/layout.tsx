import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import CursorLightEffect from '~/components/effects/CursorLightEffect';
import Providers from './providers';

export const metadata: Metadata = {
  title: "SSE Goals for 25/26",
  description: "RITs SSE needs a means to track its goals, so that we can actually measure the success of our efforts.",
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
