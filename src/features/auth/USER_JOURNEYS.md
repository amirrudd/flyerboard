# Auth Feature - User Journeys

This document captures all user journeys and flows for the Authentication feature package.
Auth is SMS OTP via Descope; the sign-in modal is rendered globally by `Layout.tsx` and
opened through the shared `setShowAuthModal` (React Router outlet context / props). User rows
live in Convex and are synced from Descope. Sources of truth: `SmsOtpSignIn.tsx`,
`layout/Layout.tsx`, `context/UserSyncContext.tsx`, `lib/useDescopeUserSync.ts`,
`lib/useAuthRecovery.ts`, `components/ui/ErrorFallback.tsx`, `convex/descopeAuth.ts`,
`convex/lib/auth.ts`.

## 1. Open Sign-In Modal from a CTA
**Given** the user is not authenticated
**When** they trigger a gated action (Post a flyer, message a seller / sale / bundle, save an ad, open dashboard, bottom-nav Sell/Account)
**Then** the CTA calls the shared `setShowAuthModal(true)` and the global SMS OTP modal opens (single instance in `Layout.tsx`; consumers reach it via `useOutletContext` or props)

## 2. Enter Phone Number (Australia only)
**Given** the user is on step 1
**When** they type their mobile number
**Then** non-numeric characters are stripped on input and the value is capped at 10 digits

## 3. Validate Phone Number
**Given** the user has typed a number
**When** it does not match `^04\d{8}$` (10 digits starting with 04)
**Then** the submit button ("Get Verification Code") stays disabled; on submit a "valid Australian mobile number" error toast shows

## 4. Send OTP Code
**Given** a valid AU mobile number
**When** they submit step 1
**Then** the number is converted to +61 international format and `sdk.otp.signUpOrIn.sms()` is called; on success a "Verification code sent!" toast shows and the form slides to step 2

## 5. Send OTP Error
**Given** the send request fails (`resp.ok` false, network, or Descope error)
**When** the failure returns
**Then** an error toast shows the message and the user stays on step 1

## 6. Start / Persist Resend Timer
**Given** the OTP was sent successfully
**When** send completes
**Then** a 60-second countdown starts and is written to `localStorage` keyed by phone number (`otp_timer_<phone>`), so it survives refresh, navigation, and closing the modal; the timer is re-read whenever `phoneNumber` changes

## 7. OTP Entry Screen
**Given** the user is on step 2
**When** the screen renders
**Then** 6 single-digit boxes are shown, the first is auto-focused (~300ms delay), and the sent-to phone number is displayed

## 8. OTP Input Behaviour
**Given** the user is entering the code
**When** they type / paste / press Backspace
**Then** typing a digit advances focus to the next box; pasting a multi-digit string distributes digits across boxes and focuses the next empty/last box; Backspace on an empty box moves focus to the previous box; only numeric input is accepted

## 9. Resend OTP
**Given** the user is on step 2
**When** the timer has expired (button disabled while `remainingTime > 0` or sending)
**Then** clicking "Resend Code" re-sends via `signUpOrIn.sms`, restarts the 60s timer, and shows a "Code resent!" toast; the label shows the live countdown while active

## 10. Verify OTP Code
**Given** the user has entered 6 digits
**When** they submit step 2
**Then** `sdk.otp.verify.sms(+61…, code)` runs; on success a "Phone number verified!" toast shows and the persisted timer is cleared

## 11. Verify OTP Error
**Given** the entered code is wrong or verification fails
**When** the failure returns
**Then** an error toast shows, the 6 boxes are cleared, and focus returns to the first box

## 12. New vs Existing User Branch
**Given** OTP verification succeeded
**When** the response is inspected
**Then** if Descope reports `data.firstSeen === true` the user is treated as NEW and advanced to step 3 (name collection); otherwise sign-in completes immediately and the modal closes

## 13. New-User Name Collection (Required, gated)
**Given** a new user reached step 3
**When** the step 3 screen shows
**Then** the name input is auto-focused, accepts only letters/spaces/hyphens/apostrophes/periods (max 50), and requires 2–50 characters; the modal is made NON-dismissable (no close button, backdrop click ignored) until the name is submitted. There is intentionally no back button on step 3 (dead-coded `showStep3BackButton = false`)

## 14. Complete New-User Sign Up
**Given** the new user submitted a valid name
**When** step 3 is submitted
**Then** `syncDescopeUser({ name })` writes the Convex `users` row, then the modal closes

## 15. Back to Phone Entry
**Given** the user is on step 2
**When** they click the back arrow
**Then** they return to step 1 and the OTP boxes are cleared

## 16. Close Auth Modal (dismissable steps only)
**Given** the modal is open on step 1 or 2 (dismissable)
**When** they click the X button or click the backdrop outside the card
**Then** the modal closes. NOTE: there is NO Escape-key handler for the auth modal — Escape does not close it. On step 3 both close paths are disabled.

## 17. Session Loading Gate
**Given** Descope is still restoring the session
**When** `useSession().isSessionLoading` is true
**Then** `App` short-circuits to `<PageLoader />` before rendering routes

## 18. Session Persistence
**Given** the user has signed in
**When** they refresh or return later
**Then** Descope (`autoRefresh`) restores the session; UI auth state comes from `useSession().isAuthenticated`, never a Convex query (avoids first-paint flicker)

## 19. Global User-Sync on Authentication
**Given** the user is authenticated and the Descope `user` object is loaded
**When** `useDescopeUserSync` runs (via `UserSyncProvider`)
**Then** it calls `syncDescopeUser({ name, email })` from the Descope profile; on success `isUserSynced` becomes true. Phone numbers are deliberately NOT synced/stored (privacy)

## 20. Gate Authed Queries on Sync
**Given** a Descope-authed user may not yet exist in the Convex `users` table
**When** a component runs an authenticated query/mutation
**Then** it gates args on `isAuthenticated && !isSessionLoading && isUserSynced ? args : "skip"` (via `useUserSync()`) to avoid "Not authenticated" race errors

## 21. Backend Auth + Duplicate-Account Guard
**Given** any Descope-authed mutation/query
**When** it resolves the caller
**Then** `getDescopeUserId(ctx)` looks up the user by `tokenIdentifier === identity.subject`. On sync, an email already owned by a different account throws ("An account with this email already exists") rather than silently linking — no cross-method auto-linking (anti-hijack)

## 22. Sign Out
**Given** the user is authenticated
**When** they click the sign-out button (`SignOutButton`, renders null when not authenticated)
**Then** `sdk.logout()` runs and the optional `onSignOut` callback fires (typically navigate home); `useDescopeUserSync` resets `isUserSynced` to false on the auth-state change

## 23. Auth-Error Recovery ("Session Expired")
**Given** an auth-related error reaches an `ErrorBoundary` (message matches `isAuthError` patterns: "Not authenticated", "Unauthorized", "401", token/session expired, etc.)
**When** `ErrorFallback` renders
**Then** it shows a "Session Expired" screen with a "Sign out & retry" action that calls `sdk.logout()` and navigates home for a fresh login

## 24. Display Name Privacy
**Given** a user has no explicit name
**When** the display name is derived in `syncDescopeUser`
**Then** it falls back name → email-prefix → "User"; elsewhere names are shown as first name + last initial
