"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Sign In Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <span className="text-2xl font-black">N</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="mb-8 text-3xl font-semibold text-white">
            Sign in to NotTable
          </h1>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLoading ? "Signing in..." : "Continue with Google"}
          </button>

          {/* Footer Note */}
          <p className="mt-8 text-sm text-gray-600">
            By continuing, you agree to our imaginary Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Right Side - Quote/Testimonial */}
      <div className="hidden w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 lg:flex">
        <div className="flex flex-col items-center justify-center px-16 text-center">
          <div className="max-w-2xl">
            <svg
              className="mb-6 h-12 w-12 text-blue-200 opacity-50"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            
            <blockquote className="space-y-3 text-white">
              <p className="text-3xl font-bold leading-relaxed">
                Imagine NOT having to deal with SQL at all. Feel relieved yet?
              </p>
              <p className="text-lg font-normal leading-relaxed">
                Rediscover organization, with the{" "}
                <span className="text-3xl font-bold">Airtable</span>
                ...clone.
              </p>
            </blockquote>
            
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-white/20">
                <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white">
                  SB
                </div>
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">Shubh Bajpai</div>
                <div className="text-sm text-blue-200">Creator of NotTable</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}

