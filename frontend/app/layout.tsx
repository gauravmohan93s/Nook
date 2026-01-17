import './globals.css';
import Navbar from "@/components/Navbar";
import { Providers } from "./providers";

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
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
            <Navbar />
            {children}
        </Providers>
      </body>
    </html>
  );
}