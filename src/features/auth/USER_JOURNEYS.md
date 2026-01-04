# Auth Feature - User Journeys

This document captures all user journeys and flows for the Authentication feature package.

## 1. View Sign-In Form
**Given** the user is not authenticated  
**When** they click a sign-in button or access a protected feature  
**Then** the SMS OTP sign-in modal is displayed

## 2. Enter Phone Number
**Given** the user is on the sign-in form  
**When** they enter their Australian mobile number  
**Then** the phone number is formatted and validated

## 3. Strip Non-Numeric Characters
**Given** the user is typing a phone number  
**When** they enter non-numeric characters  
**Then** only numeric digits are retained in the input

## 4. Validate Phone Number
**Given** the user has entered a phone number  
**When** the number is not a valid Australian mobile (10 digits starting with 04)  
**Then** the "Get Verification Code" button remains disabled

## 5. Enable Send Button
**Given** the user has entered a valid Australian mobile number  
**When** the validation passes  
**Then** the "Get Verification Code" button becomes enabled

## 6. Send OTP Code
**Given** the user has entered a valid phone number  
**When** they click "Get Verification Code"  
**Then** an OTP is sent via SMS to their phone number (in +61 international format)

## 7. Transition to OTP Entry
**Given** the OTP has been sent successfully  
**When** the send operation completes  
**Then** the form transitions to step 2 showing OTP input boxes

## 8. Start Resend Timer
**Given** the OTP has been sent  
**When** the send operation completes  
**Then** a 60-second countdown timer starts and is stored in localStorage

## 9. Display OTP Input Boxes
**Given** the user is on step 2  
**When** the OTP entry screen is displayed  
**Then** 6 individual input boxes are shown for the verification code

## 10. Enter OTP Code
**Given** the user has received the OTP  
**When** they enter all 6 digits  
**Then** the code is captured and ready for verification

## 11. Paste OTP Code
**Given** the user has copied the OTP  
**When** they paste into the first OTP input box  
**Then** all 6 digits are distributed across the input boxes

## 12. Verify OTP Code
**Given** the user has entered the complete OTP  
**When** they click "Complete Verification"  
**Then** the OTP is verified with Descope using the phone number in +61 format

## 13. Successful Verification
**Given** the OTP is correct  
**When** verification completes successfully  
**Then** the user is authenticated, the timer is cleared, and the modal closes

## 14. Failed Verification
**Given** the OTP is incorrect  
**When** verification fails  
**Then** an error toast is displayed with the error message

## 15. Send OTP Error
**Given** the user attempts to send OTP  
**When** the send operation fails (network error, etc.)  
**Then** an error toast is displayed

## 16. Navigate Back to Phone Entry
**Given** the user is on the OTP entry screen  
**When** they click the back button  
**Then** they return to step 1 (phone number entry)

## 17. Resend OTP
**Given** the user is on the OTP entry screen and the timer has expired  
**When** they click "Resend Code"  
**Then** a new OTP is sent and the timer restarts

## 18. Timer Countdown
**Given** the resend timer is active  
**When** time passes  
**Then** the countdown displays remaining seconds

## 19. Timer Expiry
**Given** the resend timer is counting down  
**When** it reaches 0  
**Then** the "Resend Code" button becomes enabled

## 20. Persistent Timer State
**Given** the user has requested an OTP  
**When** they refresh the page or close the modal  
**Then** the timer state persists in localStorage for that phone number

## 21. Close Auth Modal
**Given** the auth modal is open  
**When** the user clicks outside the modal or presses Escape  
**Then** the modal closes

## 22. Sign Out
**Given** the user is authenticated  
**When** they click the sign-out button  
**Then** their session is terminated and they are signed out

## 23. Session Persistence
**Given** the user has signed in  
**When** they refresh the page  
**Then** their authentication session persists via Descope

## 24. User Sync to Database
**Given** the user has successfully authenticated with Descope  
**When** the authentication completes  
**Then** their user record is synced to the Convex database

## 25. User Sync Context
**Given** the user is authenticated  
**When** components need to verify user sync status  
**Then** the UserSyncContext provides `isUserSynced` state

## 26. Display Name Privacy
**Given** a user's name is displayed in the app  
**When** the display name is generated  
**Then** only the first name and last initial are shown (e.g., "John D.")

## 27. Scam-Free Messaging
**Given** the user is viewing the sign-in form  
**When** they read the form description  
**Then** they see emphasis on "scam-free" verification via SMS OTP

## 28. Australian Phone Number Only
**Given** the user is entering a phone number  
**When** they try to enter a non-Australian number  
**Then** validation prevents submission (must start with 04 and be 10 digits)

## 29. International Format Conversion
**Given** the user enters a phone number in local format (04XX XXX XXX)  
**When** the number is sent to Descope  
**Then** it is converted to international format (+61XXX XXX XXX)

## 30. Auto-focus OTP Input
**Given** the user transitions to the OTP entry screen  
**When** the screen loads  
**Then** the first OTP input box is automatically focused

## 31. OTP Input Navigation
**Given** the user is entering the OTP  
**When** they type a digit  
**Then** focus automatically moves to the next input box

## 32. Clear OTP on Error
**Given** the user has entered an incorrect OTP  
**When** verification fails  
**Then** they can clear and re-enter the code

## 33. Name Input (Optional)
**Given** the user is on the OTP verification screen  
**When** they see the name input field  
**Then** they can optionally enter their name for their profile

## 34. Protected Routes
**Given** the user is not authenticated  
**When** they attempt to access protected features (post flyer, messages, dashboard)  
**Then** they are prompted to sign in first
