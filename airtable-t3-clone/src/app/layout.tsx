import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ThemeProvider } from "~/app/_components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import "~/styles/globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "AirClone",
  description: "Airtable clone",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`} suppressHydrationWarning>
      <head>
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <Script id="tailwind-config" strategy="beforeInteractive">
          {`
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  boxShadow: {
                    'airtable': '0 2px 8px rgba(0,0,0,0.1)',
                    'airtable-hover': '0 4px 12px rgba(0,0,0,0.15)',
                  },
                }
              }
            }
          `}
        </Script>
      </head>
      <body>
        <TRPCReactProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}