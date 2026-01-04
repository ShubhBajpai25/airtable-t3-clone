import { auth } from "~/server/auth";

export default async function DebugSessionPage() {
  const session = await auth();
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">Session Debug</h1>
        
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Current Session:</h2>
          <pre className="overflow-auto rounded bg-gray-900 p-4 text-sm text-green-400">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        {session?.user && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">User Info:</h2>
            <div className="space-y-2 text-sm">
              <p><strong>User ID:</strong> {session.user.id}</p>
              <p><strong>Name:</strong> {session.user.name}</p>
              <p><strong>Email:</strong> {session.user.email}</p>
              <p><strong>Image:</strong> {session.user.image}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}