import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

// NextAuth v5 server helper (cached per-request)
export const auth = cache(uncachedAuth);

// “Legacy-style” helper name
export const getServerAuthSession = cache(async () => {
  return await auth();
});

export { handlers, signIn, signOut };
