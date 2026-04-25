import type { Metadata } from "next";
import {  Nunito } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Header from "@/components/Header";
// import Script from "next/script";

// const spaceGrotesk = Space_Grotesk({
//   variable: "--font-space-grotesk",
//   subsets: ["latin"],
//   display: "swap", 
// });

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "500", "700"],
});

export const metadata: Metadata = {
  title: "FireScreener - Token Analytics Platform",
  description: "First Community Token Analytics Platform. Built by a meme, powered by purpose.  Track tokens burns, charts trends, and unlock AI insights, all in one blazing dashboard, on FireScreener",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script defer src="https://cloud.umami.is/script.js" data-website-id="23de30be-d6d1-4152-b10c-7442a99240ce"></script>
      </head>
      
      
      <body
        className={`${nunito.variable} antialiased`}
      >
        <Header />
        <main>{children}</main>
      </body>
      {/* <script defer src="https://cloud.umami.is/script.js" data-website-id="23de30be-d6d1-4152-b10c-7442a99240ce"></script> */}
      <Analytics />
    </html>
  );
}
