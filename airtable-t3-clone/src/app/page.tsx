import Link from "next/link";

import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { BaseList } from "./_components/base-list";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    void api.base.list.prefetch();
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Welcome to your<span className="text-[hsl(280,100%,70%)]">Airtable!</span>
          </h1>
            <div className="flex flex-col items-center justify-center gap-4">
            {session && <p className="text-center text-xl">Logged in as {session.user?.name}</p>}

            <Link
              href={session ? "/api/auth/signout" : "/api/auth/signin"}
              className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
            >
              {session ? "Sign out" : "Sign in"}
            </Link>
          </div>

          {session?.user ? (
            <BaseList />
          ) : (
            <p className="text-white/80">Sign in to create bases and tables.</p>
          )}
        </div>
      </main>
    </HydrateClient>
  );
}