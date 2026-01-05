# Admin Feature - User Journeys

This document captures all user journeys and flows for the Admin Dashboard feature package.

## 1. Access Admin Dashboard (Admin User)
**Given** the user has admin privileges (isAdmin: true)  
**When** they navigate to /admin  
**Then** they see the admin dashboard with tabs for Users, Flyers, Reports, and Chats

## 2. Access Admin Dashboard (Non-Admin User)
**Given** the user does not have admin privileges  
**When** they attempt to navigate to /admin  
**Then** they see an "Access Denied" message

## 3. View Admin Badge
**Given** the user is an admin viewing the dashboard  
**When** the dashboard loads  
**Then** they see a shield icon and "Admin Dashboard" header

## 4. View Users Tab
**Given** the admin is on the dashboard  
**When** they select the "Users" tab  
**Then** they see a paginated list of all users with statistics

## 5. Search Users
**Given** the admin is on the Users tab  
**When** they enter a search term in the search box  
**Then** users matching the name or email are displayed

## 6. Filter Users by Status
**Given** the admin is on the Users tab  
**When** they select a filter (active/inactive/verified/all)  
**Then** only users matching that status are displayed

## 7. View User Statistics
**Given** the admin is viewing the Users tab  
**When** the data loads  
**Then** they see total users, active users, inactive users, and verified users counts

## 8. Expand User Details
**Given** the admin is viewing the users list  
**When** they click on a user row  
**Then** detailed user information expands showing stats, recent ads, and actions

## 9. Activate User Account
**Given** the admin is viewing an inactive user  
**When** they click "Activate"  
**Then** the user's account is activated (isActive: true)

## 10. Deactivate User Account
**Given** the admin is viewing an active user  
**When** they click "Deactivate"  
**Then** the user's account is deactivated and all their flyers are deactivated

## 11. Prevent Admin Deactivation
**Given** the admin is viewing another admin user  
**When** they attempt to deactivate  
**Then** the action is prevented (cannot deactivate admin accounts)

## 12. Verify User
**Given** the admin is viewing an unverified user  
**When** they click "Verify"  
**Then** the user's verification status is set to true

## 13. Unverify User
**Given** the admin is viewing a verified user  
**When** they click "Unverify"  
**Then** the user's verification status is set to false

## 14. Delete User Account
**Given** the admin is viewing a user  
**When** they click "Delete" and confirm the action  
**Then** all user's flyers are soft-deleted and the user account is hard-deleted

## 15. Prevent Admin Deletion
**Given** the admin is viewing another admin user  
**When** they attempt to delete  
**Then** the action is prevented (cannot delete admin accounts)

## 16. Paginate Users
**Given** there are more users than fit on one page  
**When** the admin scrolls to the bottom  
**Then** the next page of users is loaded

## 17. View Flyers Tab
**Given** the admin is on the dashboard  
**When** they select the "Flyers" tab  
**Then** they see a list of all flyers including soft-deleted ones

## 18. Search Flyers
**Given** the admin is on the Flyers tab  
**When** they enter a search term  
**Then** flyers matching the title, description, or location are displayed

## 19. Filter Flyers by Status
**Given** the admin is on the Flyers tab  
**When** they select a filter (active/inactive/deleted/all)  
**Then** only flyers matching that status are displayed

## 20. Filter Flyers by Category
**Given** the admin is on the Flyers tab  
**When** they select a category from the dropdown  
**Then** only flyers in that category are displayed

## 21. View Flyer Statistics
**Given** the admin is viewing the Flyers tab  
**When** the data loads  
**Then** they see total flyers, active flyers, inactive flyers, and deleted flyers counts

## 22. View Flyer Images
**Given** the admin is viewing a flyer  
**When** they click "View Images"  
**Then** an image management modal opens showing all flyer images

## 23. Delete Specific Image
**Given** the admin is viewing flyer images  
**When** they click delete on a specific image and confirm  
**Then** that image is removed from the flyer

## 24. Prevent Last Image Deletion
**Given** the admin is viewing a flyer with only one image  
**When** they attempt to delete it  
**Then** a warning is shown (flyers must have at least one image)

## 25. Close Image Modal
**Given** the image management modal is open  
**When** the admin clicks close or clicks outside  
**Then** the modal closes

## 26. Soft-Delete Flyer
**Given** the admin is viewing a flyer  
**When** they click "Delete Flyer" and confirm  
**Then** the flyer is soft-deleted (isDeleted: true, isActive: false)

## 27. View Deleted Flyers
**Given** the admin has filtered to show deleted flyers  
**When** the filter is applied  
**Then** soft-deleted flyers are displayed with a "Deleted" badge

## 28. Paginate Flyers
**Given** there are more flyers than fit on one page  
**When** the admin scrolls to the bottom  
**Then** the next page of flyers is loaded

## 29. View Reports Tab
**Given** the admin is on the dashboard  
**When** they select the "Reports" tab  
**Then** they see all user-submitted reports

## 30. Filter Reports by Status
**Given** the admin is on the Reports tab  
**When** they select a status filter (pending/reviewed/resolved)  
**Then** only reports with that status are displayed

## 31. View Report Statistics
**Given** the admin is viewing the Reports tab  
**When** the data loads  
**Then** they see total reports, pending reports, reviewed reports, and resolved reports counts

## 32. View Report Details
**Given** the admin is viewing a report  
**When** they expand the report  
**Then** they see the reporter, reported entity, reason, and description

## 33. Update Report Status to Reviewed
**Given** the admin is viewing a pending report  
**When** they click "Mark as Reviewed"  
**Then** the report status is updated to "reviewed"

## 34. Update Report Status to Resolved
**Given** the admin is viewing a reviewed report  
**When** they click "Mark as Resolved"  
**Then** the report status is updated to "resolved"

## 35. View Reported Flyer
**Given** the admin is viewing a report about a flyer  
**When** they click on the flyer link  
**Then** they navigate to that flyer's detail page

## 36. View Reported User
**Given** the admin is viewing a report about a user  
**When** they click on the user link  
**Then** they navigate to that user's details

## 37. View Chats Tab
**Given** the admin is on the dashboard  
**When** they select the "Chats" tab  
**Then** they see a chat viewer interface

## 38. Load Chat by ID
**Given** the admin is on the Chats tab  
**When** they enter a chat ID and click "Load Chat"  
**Then** the full chat conversation is displayed

## 39. View Chat Details
**Given** the admin has loaded a chat  
**When** the chat displays  
**Then** they see buyer info, seller info, flyer info, and all messages

## 40. Read-Only Chat Access
**Given** the admin is viewing a chat  
**When** they see the message interface  
**Then** they cannot send messages (read-only access for moderation)

## 41. View Chat Messages
**Given** the admin has loaded a chat  
**When** messages are displayed  
**Then** they see all messages in chronological order with sender information

## 42. Navigate Between Admin Tabs
**Given** the admin is on any tab  
**When** they click a different tab  
**Then** the view switches to that tab with appropriate data

## 43. Confirmation Modals
**Given** the admin attempts a destructive action (delete user, delete flyer, delete image)  
**When** they click the action button  
**Then** a confirmation modal appears requiring explicit confirmation

## 44. Cancel Destructive Action
**Given** a confirmation modal is displayed  
**When** the admin clicks "Cancel"  
**Then** the modal closes and no action is taken

## 45. Confirm Destructive Action
**Given** a confirmation modal is displayed  
**When** the admin clicks "Confirm" or "Delete"  
**Then** the action is executed and the modal closes

## 46. View User Ad Count
**Given** the admin is viewing users  
**When** user data is displayed  
**Then** each user shows their total number of posted flyers

## 47. View Flyer Owner
**Given** the admin is viewing flyers  
**When** flyer data is displayed  
**Then** each flyer shows the owner's name and email

## 48. Admin Access Check
**Given** any admin query or mutation is called  
**When** the backend processes the request  
**Then** requireAdmin(ctx) is called to verify admin privileges

## 49. Toast Notifications
**Given** the admin performs an action  
**When** the action completes (success or error)  
**Then** a toast notification displays the result

## 50. Responsive Admin Layout
**Given** the admin is viewing the dashboard  
**When** they resize the browser window  
**Then** the layout adapts to different screen sizes

## 51. Loading States
**Given** admin data is being fetched  
**When** queries are loading  
**Then** appropriate loading indicators are displayed

## 52. Empty States
**Given** no data matches the current filters  
**When** the filtered results are empty  
**Then** an appropriate empty state message is displayed

## 53. Error Handling
**Given** an error occurs during an admin operation  
**When** the error is caught  
**Then** an error message is displayed to the admin

## 54. Deactivation Cascade
**Given** the admin deactivates a user  
**When** the deactivation completes  
**Then** all of that user's flyers are also deactivated

## 55. Deletion Cascade
**Given** the admin deletes a user  
**When** the deletion completes  
**Then** all of that user's flyers are soft-deleted before the user is hard-deleted
