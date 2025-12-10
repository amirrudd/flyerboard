"use client";
import { useDescope, useSession } from "@descope/react-sdk";
import { LogOut } from "lucide-react";

interface SignOutButtonProps {
  onSignOut?: () => void;
  iconOnly?: boolean;
}

export function SignOutButton({ onSignOut, iconOnly = false }: SignOutButtonProps) {
  const { isAuthenticated } = useSession();
  const sdk = useDescope();

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    await sdk.logout();
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
      className="auth-button flex items-center justify-center gap-2 group"
      onClick={handleSignOut}
    >
      Sign out
      <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
    </button>
  );
}
