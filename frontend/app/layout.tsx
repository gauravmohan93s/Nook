import './globals.css';
import Navbar from "@/components/Navbar";
import { Providers } from "./providers";
import { Fraunces, Space_Grotesk } from "next/font/google";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-family",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif-family",
  display: "swap",
});

export const metadata = {
  title: "Nook | Your Window to the Best Writing",
  description: "Democratizing access to world-class insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${space.variable} ${fraunces.variable} antialiased`}>
        <Providers>
            <Navbar />
            {children}
        </Providers>
      </body>
    </html>
  );
}
