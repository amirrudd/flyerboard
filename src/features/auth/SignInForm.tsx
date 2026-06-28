"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Envelope, Lock, ArrowRight, CircleNotch } from '@phosphor-icons/react';
import { Link } from "react-router-dom";

interface SignInFormProps {
  flow: "signIn" | "signUp";
  setFlow: (flow: "signIn" | "signUp") => void;
}

export function SignInForm({ flow, setFlow }: SignInFormProps) {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            console.error("Sign in/up error:", error);
            let toastTitle: string;
            if (error.message.includes("A user with this email already exists")) {
              toastTitle = "A user with this email already exists. Please sign in.";
            } else if (error.message.includes("Invalid password")) {
              if (flow === "signUp") {
                toastTitle = "Account may already exist. Please try signing in.";
              } else {
                toastTitle = "Invalid password. Please try again.";
              }
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Incorrect email or password. Please try again."
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <div className="space-y-3">
          <div className="relative group">
            <label htmlFor="auth-email" className="sr-only">
              Email address
            </label>
            <Envelope
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors"
              aria-hidden="true"
            />
            <input
              id="auth-email"
              className="w-full h-11 pl-11 pr-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
              type="email"
              name="email"
              placeholder="Email address"
              autoComplete="email"
              required
            />
          </div>
          <div className="relative group">
            <label htmlFor="auth-password" className="sr-only">
              Password
            </label>
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors"
              aria-hidden="true"
            />
            <input
              id="auth-password"
              className="w-full h-11 pl-11 pr-4 bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
              type="password"
              name="password"
              placeholder="Password"
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              required
            />
          </div>
        </div>

        <button
          className="h-11 px-4 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 mt-2 group"
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <CircleNotch className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            <>
              {flow === "signIn" ? "Sign in" : "Create account"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary font-semibold hover:underline underline-offset-2 transition-colors ml-1"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up" : "Sign in"}
          </button>
        </p>
        {flow === "signUp" && (
          <p className="text-xs text-muted-foreground mt-2 max-w-prose">
            By signing up you agree to our{" "}
            <Link
              to="/terms"
              className="text-primary hover:underline underline-offset-2 font-medium"
            >
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link
              to="/terms#privacy"
              className="text-primary hover:underline underline-offset-2 font-medium"
            >
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </form>

    </div>
  );
}
