# Ads Feature - User Journeys

This document captures all user journeys and flows for the Ads feature package.

## 1. Browse Flyers
**Given** the user is on the home page  
**When** they view the flyers grid  
**Then** they see a list of active flyers with images, titles, prices, and locations

## 2. View Flyer Details
**Given** the user is browsing flyers  
**When** they click on a flyer card  
**Then** they see the full flyer details including all images, description, location map, and seller information

## 3. Share Flyer
**Given** the user is viewing a flyer detail page  
**When** they click the share button (in header or sidebar)  
**Then** the flyer URL is copied to clipboard and a success toast is shown

## 4. Filter Flyers by Category
**Given** the user is on the home page  
**When** they select a category from the sidebar  
**Then** only flyers in that category are displayed with the category name shown

## 5. Search Flyers
**Given** the user is on the home page  
**When** they type a search query in the header search bar  
**Then** flyers matching the search term are displayed

## 6. View Loading State
**Given** flyers are being fetched from the server  
**When** the data is loading  
**Then** skeleton loading cards are displayed

## 7. View Empty State
**Given** no flyers match the current filters  
**When** the flyers grid is rendered  
**Then** "No Flyers Found" message is displayed

## 8. View Free Items
**Given** a flyer has price set to 0  
**When** the flyer is displayed in the grid  
**Then** "Free" is shown instead of "$0"

## 9. Post New Flyer (Authenticated)
**Given** the user is authenticated  
**When** they navigate to the post flyer page and fill in all required fields (title, category, price, location, description, images)  
**Then** the flyer is created and they are navigated to the appropriate page (dashboard if from dashboard, home otherwise)

## 10. Validate Post Form
**Given** the user is on the post flyer page  
**When** they attempt to submit without filling required fields  
**Then** the submit button remains disabled and form validation prevents submission

## 11. Upload Images
**Given** the user is posting a flyer  
**When** they add images via the image upload component  
**Then** images are compressed to 90% WebP quality and uploaded to R2 storage

## 12. Edit Existing Flyer
**Given** the user owns a flyer  
**When** they navigate to edit mode with the flyer data  
**Then** the form is pre-filled with existing flyer data and shows "Update Flyer" button

## 13. Delete Images While Editing
**Given** the user is editing a flyer with existing images  
**When** they remove some images from the image upload component  
**Then** only the remaining images are sent to the update mutation (deleted images are filtered out)

## 14. Delete Flyer
**Given** the user is editing their flyer  
**When** they click the delete button and confirm the deletion  
**Then** the flyer is soft-deleted (isDeleted: true) and they are navigated back

## 15. Validate Price Input
**Given** the user is entering a price  
**When** they type in the price field  
**Then** only whole numbers are accepted (no decimals, no leading zeros, no non-numeric characters, max 999999999)

## 16. Character Limits
**Given** the user is filling the post form  
**When** they type in text fields  
**Then** character limits are enforced (title: 100, description: 500, extended description: 2000, location: 100)

## 17. Character Counters
**Given** the user is typing in description fields  
**When** they enter text  
**Then** character counters update in real-time showing "X / MAX characters"

## 18. Location Search
**Given** the user is entering a location  
**When** they type in the location field  
**Then** location suggestions appear and they can select from the dropdown

## 19. Message Seller (Authenticated)
**Given** the user is viewing a flyer they don't own and is authenticated  
**When** they click the "Message Seller" button  
**Then** a chat is created or opened for that flyer

## 20. View Flyer Messages (Seller)
**Given** the user owns a flyer with messages  
**When** they navigate to the messages view for that flyer  
**Then** they see all chat conversations with buyers

## 21. Authentication Required for Messaging
**Given** the user is not authenticated  
**When** they view flyer messages  
**Then** they see a loading state until authentication is confirmed

## 22. User Sync Required for Messaging
**Given** the user is authenticated but not yet synced to database  
**When** the messages component loads  
**Then** chat queries are skipped until user sync is complete

## 23. Message Ordering
**Given** the user is viewing a chat conversation  
**When** messages are displayed  
**Then** they are ordered chronologically (oldest to newest)

## 24. Message Alignment
**Given** the user is viewing messages  
**When** messages are rendered  
**Then** seller messages are right-aligned with primary background, buyer messages are left-aligned with white background

## 25. Bottom Alignment with Scroll
**Given** the user is viewing a chat  
**When** there are few messages  
**Then** messages align to the bottom of the container

**Given** the user is viewing a chat  
**When** there are many messages  
**Then** the container is scrollable and allows viewing message history

## 26. Auto-scroll to Latest Message
**Given** a new message is sent or received  
**When** the messages list updates  
**Then** the view automatically scrolls to the latest message

## 27. Mobile Touch Scrolling
**Given** the user is on a mobile device  
**When** they scroll through messages  
**Then** touch scrolling works smoothly with pan-y and overscroll-behavior

## 28. Empty Chat State
**Given** a flyer has no messages yet  
**When** the seller views the messages page  
**Then** "No messages yet" empty state is displayed

## 29. Select Conversation
**Given** the seller has multiple chat conversations  
**When** they haven't selected a chat yet  
**Then** "Select a conversation" prompt is displayed

## 30. Send Message
**Given** the user is in an active chat  
**When** they type a message and click send  
**Then** the message is sent and appears in the conversation

## 31. Increment Flyer Views
**Given** a user views a flyer detail page  
**When** the page loads  
**Then** the view count for that flyer is incremented

## 32. Save/Unsave Flyer (Authenticated)
**Given** the user is authenticated and viewing a flyer  
**When** they click the save/heart button  
**Then** the flyer is added to or removed from their saved flyers

## 33. Report Flyer (Authenticated)
**Given** the user is authenticated and viewing a flyer  
**When** they click the report button and submit a report  
**Then** a report is created for admin review

## 34. View Seller Profile from Flyer
**Given** the user is viewing a flyer detail page  
**When** they see the seller information section  
**Then** they can view the seller's name, rating, and verification status

## 35. View Location Map
**Given** a flyer has location data  
**When** the flyer detail page loads  
**Then** a map showing the approximate location is displayed

## 36. Image Lightbox
**Given** the user is viewing flyer images  
**When** they click on an image  
**Then** a full-screen lightbox opens with navigation between images

## 37. Navigate Between Images
**Given** the user has opened the image lightbox  
**When** they use arrow keys or click navigation buttons  
**Then** they can view all flyer images in sequence

## 38. Close Lightbox
**Given** the image lightbox is open  
**When** they press Escape or click the close button  
**Then** the lightbox closes and returns to the flyer detail view

## 39. Price History Display
**Given** a flyer's price has been reduced  
**When** the flyer is displayed  
**Then** the previous price is shown with a strikethrough next to the current price

## 40. Infinite Scroll
**Given** the user is browsing the flyers grid  
**When** they scroll to the bottom of the page  
**Then** more flyers are automatically loaded
