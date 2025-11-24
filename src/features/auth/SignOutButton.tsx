"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { LogOut } from "lucide-react";

interface SignOutButtonProps {
  onSignOut?: () => void;
  iconOnly?: boolean;
}

export function SignOutButton({ onSignOut, iconOnly = false }: SignOutButtonProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    // Call the callback to navigate to home page
    onSignOut?.();
  };

  if (iconOnly) {
    return (
      <button
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={handleSignOut}
        title="Sign out"
      >
        <LogOut className="w-5 h-5 text-gray-700" />
      </button>
    );
  }

  return (
    <button
      className="px-4 py-2 rounded-lg bg-white text-neutral-600 border border-neutral-200 font-semibold hover:bg-neutral-50 hover:text-neutral-900 transition-colors shadow-sm hover:shadow"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
}
