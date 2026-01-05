"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

type CreateWorkspaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workspaceId: string) => void;
};

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const createMutation = api.workspace.create.useMutation({
    onSuccess: (data) => {
      setName("");
      setError("");
      onSuccess(data.id);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    if (name.trim().length > 80) {
      setError("Workspace name must be 80 characters or less");
      return;
    }

    createMutation.mutate({ name: name.trim() });
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      setName("");
      setError("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl">
          {/* Header */}
          <div className="border-b border-[var(--border-soft)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--fg)]">
              Create New Workspace
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              A workspace contains bases that organize your data.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-4">
              <label
                htmlFor="workspace-name"
                className="mb-2 block text-sm font-medium text-[var(--fg)]"
              >
                Workspace Name
              </label>
              <input
                id="workspace-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="e.g., My Projects"
                className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-[var(--fg)] placeholder:text-[var(--muted)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
                disabled={createMutation.isPending}
                maxLength={80}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={createMutation.isPending}
                className="rounded-lg border border-[var(--border-soft)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createMutation.isPending ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}