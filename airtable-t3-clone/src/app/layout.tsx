import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ThemeProvider } from "~/app/_components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import "~/styles/globals.css";

export const metadata: Metadata = {
  title: "AirClone",
  description: "Airtable clone",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={GeistSans.variable}>
        <TRPCReactProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}