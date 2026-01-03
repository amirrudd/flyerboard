# Dashboard Feature - User Journeys

This document captures all user journeys and flows for the User Dashboard feature package.

## 1. Access Dashboard (Authenticated)
**Given** the user is authenticated  
**When** they navigate to the dashboard  
**Then** they see their personal dashboard with tabs for My Flyers, Messages, Saved Flyers, and Profile

## 2. Access Dashboard (Unauthenticated)
**Given** the user is not authenticated  
**When** they navigate to the dashboard  
**Then** they see a "Please sign in" message

## 3. View My Flyers Tab
**Given** the user is on the dashboard  
**When** they select the "My Flyers" tab  
**Then** they see a list of all their posted flyers (active and inactive)

## 4. Empty Flyers State
**Given** the user has not posted any flyers  
**When** they view the My Flyers tab  
**Then** they see "No Flyers Yet" with a "Pin Your First Flyer" button

## 5. Post First Flyer
**Given** the user has no flyers  
**When** they click "Pin Your First Flyer"  
**Then** the post flyer form is opened

## 6. Post Additional Flyer
**Given** the user has existing flyers  
**When** they click "Pin Next Flyer"  
**Then** the post flyer form is opened

## 7. View Flyer Statistics
**Given** the user has posted flyers  
**When** they view the My Flyers tab  
**Then** they see statistics including total flyers, total views, and average rating

## 8. Edit Flyer
**Given** the user is viewing their flyers  
**When** they click the edit button on a flyer  
**Then** the edit flyer form opens with pre-filled data

## 9. Toggle Flyer Active Status
**Given** the user has a flyer  
**When** they click the activate/deactivate toggle  
**Then** the flyer's active status is updated

## 10. Delete Flyer from Dashboard
**Given** the user is viewing their flyers  
**When** they click delete and confirm  
**Then** the flyer is soft-deleted

## 11. View Flyer Details from Dashboard
**Given** the user is viewing their flyers  
**When** they click on a flyer card  
**Then** the flyer detail view opens

## 12. View Messages Tab
**Given** the user is on the dashboard  
**When** they select the "Messages" tab  
**Then** they see all their chat conversations (as seller and buyer)

## 13. Seller Chats
**Given** the user has flyers with messages  
**When** they view the Messages tab  
**Then** they see chats where they are the seller, grouped by flyer

## 14. Buyer Chats
**Given** the user has messaged sellers  
**When** they view the Messages tab  
**Then** they see chats where they are the buyer

## 15. Unread Message Counts
**Given** the user has unread messages  
**When** they view the Messages tab  
**Then** unread counts are displayed on each chat

## 16. Open Chat Conversation
**Given** the user is viewing their messages  
**When** they click on a chat  
**Then** the full conversation opens

## 17. Archive Chat
**Given** the user has a chat conversation  
**When** they click the archive button  
**Then** the chat is moved to archived chats

## 18. View Archived Chats (Desktop)
**Given** the user is on desktop  
**When** they select the "Archived" sub-tab in Messages  
**Then** they see all archived conversations

## 19. Unarchive Chat
**Given** the user has archived chats  
**When** they click unarchive on a chat  
**Then** the chat is restored to active messages

## 20. Empty Messages State
**Given** the user has no messages  
**When** they view the Messages tab  
**Then** they see an empty state message

## 21. View Saved Flyers Tab
**Given** the user is on the dashboard  
**When** they select the "Saved Flyers" tab  
**Then** they see all flyers they have saved/favorited

## 22. Remove from Saved
**Given** the user is viewing saved flyers  
**When** they click the unsave button  
**Then** the flyer is removed from their saved list

## 23. Empty Saved Flyers State
**Given** the user has no saved flyers  
**When** they view the Saved Flyers tab  
**Then** they see an empty state message

## 24. View Profile Tab
**Given** the user is on the dashboard  
**When** they select the "Profile" tab  
**Then** they see their profile information and statistics

## 25. View Profile Statistics
**Given** the user is viewing their profile  
**When** the profile loads  
**Then** they see total flyers posted, total views, average rating, and rating count

## 26. Upload Profile Picture
**Given** the user is on the Profile tab  
**When** they click on their profile picture and select a new image  
**Then** the image is uploaded and their profile picture is updated

## 27. View Verification Status
**Given** the user is viewing their profile  
**When** the profile loads  
**Then** they see their verification status (verified or not verified)

## 28. Identity Verification (Feature Flag)
**Given** the identity verification feature is enabled  
**When** the user views their profile  
**Then** they see a "Verify Identity" button (if not verified)

## 29. View Email Notification Settings
**Given** the user is on the Profile tab  
**When** they scroll to notification settings  
**Then** they see toggles for email notification preferences

## 30. Enable Email Notifications
**Given** the user wants to receive email notifications  
**When** they toggle on "Email Notifications"  
**Then** email notifications are enabled for their account

## 31. Disable Email Notifications
**Given** the user has email notifications enabled  
**When** they toggle off "Email Notifications"  
**Then** email notifications are disabled

## 32. Configure Notification Frequency
**Given** email notifications are enabled  
**When** the user selects a frequency option (instant/daily/weekly)  
**Then** their notification frequency preference is saved

## 33. Mobile Tab Navigation
**Given** the user is on mobile  
**When** they view the dashboard  
**Then** they see a bottom tab bar for navigation between sections

## 34. Desktop Tab Navigation
**Given** the user is on desktop  
**When** they view the dashboard  
**Then** they see a horizontal tab bar at the top

## 35. Mobile Profile Edit Navigation
**Given** the user is on mobile viewing the dashboard  
**When** they click the edit button next to their profile image  
**Then** they navigate to the Profile tab

## 36. Prevent Mobile Access to Desktop-Only Tabs
**Given** the user is on mobile  
**When** they try to access desktop-only tabs via URL (e.g., ?tab=archived)  
**Then** they are redirected to the default tab (My Flyers)

## 37. URL Tab Parameter
**Given** the user is on the dashboard  
**When** they switch tabs  
**Then** the URL updates with the ?tab parameter

## 38. Deep Link to Specific Tab
**Given** the user has a dashboard URL with a tab parameter  
**When** they navigate to that URL  
**Then** the specified tab is automatically selected

## 39. View User Rating
**Given** the user has received ratings  
**When** they view their profile  
**Then** they see their average rating and total number of ratings

## 40. View Recent Activity
**Given** the user is viewing their profile  
**When** the profile loads  
**Then** they see their recent activity summary

## 41. Sign Out from Dashboard
**Given** the user is on the dashboard  
**When** they click the sign-out button  
**Then** they are signed out and redirected to the home page

## 42. Responsive Layout
**Given** the user is viewing the dashboard  
**When** they resize the browser window  
**Then** the layout adapts between mobile and desktop views

## 43. Loading States
**Given** dashboard data is being fetched  
**When** the dashboard loads  
**Then** appropriate loading indicators are shown

## 44. Error States
**Given** an error occurs while fetching dashboard data  
**When** the error is encountered  
**Then** an appropriate error message is displayed

## 45. Refresh Dashboard Data
**Given** the user is on the dashboard  
**When** they perform actions (post, edit, delete flyers)  
**Then** the dashboard data automatically refreshes via Convex reactivity
