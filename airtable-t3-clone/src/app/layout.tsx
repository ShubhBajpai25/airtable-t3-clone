import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ThemeProvider } from "~/app/_components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import "~/styles/globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | NotTable",
    default: "NotTable",
  },
  description: "The ultimate Airtable clone!",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = saved === 'dark' || (!saved && prefersDark) ? 'dark' : 'light';

                if (theme === 'dark') document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');

                // optional but useful for debugging / future selectors
                document.documentElement.dataset.theme = theme;
              } catch (e) {}
            `,
          }}
        />
      </head>

      {/* Apply token background/text + make full height */}
      <body
        className={[
          GeistSans.variable,
          "min-h-screen bg-[var(--bg)] text-[var(--fg)]",
        ].join(" ")}
      >
        <TRPCReactProvider>
          <ThemeProvider>
            {/* Optional global wrapper so every page inherits tokens + scrollbar */}
            <div className="scrollbar min-h-screen bg-[var(--bg)]">
              {children}
            </div>
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
