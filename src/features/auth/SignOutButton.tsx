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
        className="p-2 rounded-lg hover:bg-muted transition-colors"
        onClick={handleSignOut}
        title="Sign out"
      >
        <LogOut className="w-5 h-5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      onClick={handleSignOut}
    >
      <LogOut className="w-4 h-4" />
      Sign out
    </button>
  );
}
