import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { env } from "~/env";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  adapter: PrismaAdapter(db),
  pages: {
    signIn: "/signin", // 👈 Custom sign-in page
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnSignIn = nextUrl.pathname.startsWith("/signin");
      
      // Allow access to signin page when not logged in
      if (!isLoggedIn && isOnSignIn) {
        return true;
      }
      
      // Redirect to signin if not logged in and trying to access protected routes
      if (!isLoggedIn) {
        return false; // This triggers redirect to pages.signIn
      }
      
      // Redirect to home if logged in and trying to access signin page
      if (isLoggedIn && isOnSignIn) {
        return Response.redirect(new URL("/", nextUrl));
      }
      
      return true;
    },
    session: ({ session, user }) => ({
      ...session,
      user: { ...session.user, id: user.id },
    }),
  },
} satisfies NextAuthConfig;