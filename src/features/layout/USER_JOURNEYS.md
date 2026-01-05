# Layout Feature - User Journeys

This document captures all user journeys and flows for the Layout and Navigation feature package.

## Header Component

### 1. View Header
**Given** the user is on any page  
**When** the page loads  
**Then** they see the header with logo, search bar, location selector, and action buttons

### 2. View Logo
**Given** the user is viewing the header  
**When** the header renders  
**Then** they see the "FlyerBoard" logo/brand name

### 3. Click Logo to Home
**Given** the user is on any page  
**When** they click the FlyerBoard logo  
**Then** they navigate to the home page

### 4. Search Flyers
**Given** the user is on the header  
**When** they type in the search bar  
**Then** the search query is updated and flyers are filtered in real-time

### 5. Clear Search
**Given** the user has entered a search query  
**When** they clear the search input  
**Then** all flyers are displayed again

### 6. Mobile Search Icon
**Given** the user is on mobile  
**When** they view the header  
**Then** they see a search icon instead of a full search bar

### 7. Open Mobile Search
**Given** the user is on mobile  
**When** they click the search icon  
**Then** the search input expands or a search modal opens

### 8. Select Location
**Given** the user is viewing the header  
**When** they click on the location selector  
**Then** a location search dropdown appears

### 9. Search Locations
**Given** the location dropdown is open  
**When** they type a suburb or postcode  
**Then** matching location suggestions appear

### 10. Choose Location
**Given** location suggestions are displayed  
**When** they click on a location  
**Then** that location is selected and flyers are filtered by location

### 11. Mobile Location Icon
**Given** the user is on mobile  
**When** they view the header  
**Then** they see a location icon instead of full location text

### 12. View Right Actions
**Given** the user is viewing the header  
**When** the header renders  
**Then** they see action buttons (sign in/dashboard, post flyer, etc.)

### 13. Toggle Sidebar (Desktop)
**Given** the user is on desktop  
**When** they click the menu button  
**Then** the sidebar collapses or expands

### 14. Toggle Sidebar (Mobile)
**Given** the user is on mobile  
**When** they click the menu button  
**Then** the sidebar slides in or out

### 15. Responsive Header Layout
**Given** the user resizes the browser window  
**When** the viewport changes  
**Then** the header adapts between mobile and desktop layouts

## Sidebar Component

### 16. View Sidebar (Desktop)
**Given** the user is on desktop  
**When** the page loads  
**Then** the sidebar is visible by default showing categories

### 17. View Sidebar (Mobile)
**Given** the user is on mobile  
**When** the page loads  
**Then** the sidebar is hidden by default

### 18. View Categories in Sidebar
**Given** the sidebar is open  
**When** the user views it  
**Then** they see a list of all available categories

### 19. Select Category
**Given** the user is viewing the sidebar  
**When** they click on a category  
**Then** flyers are filtered to show only that category

### 20. View All Categories
**Given** the user has selected a category  
**When** they click "All Categories" or clear the filter  
**Then** all flyers are displayed

### 21. Category Icons
**Given** the user is viewing categories  
**When** categories are displayed  
**Then** each category shows its associated icon

### 22. Collapsed Sidebar (Desktop)
**Given** the sidebar is collapsed on desktop  
**When** the user views it  
**Then** only category icons are shown without text

### 23. Expanded Sidebar (Desktop)
**Given** the sidebar is expanded on desktop  
**When** the user views it  
**Then** category icons and names are both shown

### 24. Close Mobile Sidebar
**Given** the sidebar is open on mobile  
**When** the user clicks outside the sidebar or selects a category  
**Then** the sidebar closes automatically

## Bottom Navigation Component

### 25. View Bottom Nav (Mobile)
**Given** the user is on mobile  
**When** they view any page  
**Then** they see a bottom navigation bar with 5 items

### 26. Hide Bottom Nav (Desktop)
**Given** the user is on desktop  
**When** they view any page  
**Then** the bottom navigation is hidden

### 27. Navigate to Home
**Given** the user is on mobile  
**When** they tap the "Home" button in bottom nav  
**Then** they navigate to the home page

### 28. Navigate to Saved (Authenticated)
**Given** the user is authenticated and on mobile  
**When** they tap the "Saved" button  
**Then** they navigate to the dashboard saved flyers tab

### 29. Navigate to Saved (Unauthenticated)
**Given** the user is not authenticated and on mobile  
**When** they tap the "Saved" button  
**Then** the authentication modal opens

### 30. Navigate to Post Flyer (Authenticated)
**Given** the user is authenticated and on mobile  
**When** they tap the "PIN" button  
**Then** they navigate to the post flyer page

### 31. Navigate to Post Flyer (Unauthenticated)
**Given** the user is not authenticated and on mobile  
**When** they tap the "PIN" button  
**Then** the authentication modal opens

### 32. Navigate to Messages (Authenticated)
**Given** the user is authenticated and on mobile  
**When** they tap the "Messages" button  
**Then** they navigate to the dashboard messages tab

### 33. Navigate to Messages (Unauthenticated)
**Given** the user is not authenticated and on mobile  
**When** they tap the "Messages" button  
**Then** the authentication modal opens

### 34. Navigate to Dashboard (Authenticated)
**Given** the user is authenticated and on mobile  
**When** they tap the "Dashboard" button  
**Then** they navigate to their dashboard

### 35. Show Sign In (Unauthenticated)
**Given** the user is not authenticated and on mobile  
**When** they view the bottom nav  
**Then** they see "Sign In" instead of "Dashboard"

### 36. Open Auth Modal from Bottom Nav
**Given** the user is not authenticated and on mobile  
**When** they tap "Sign In"  
**Then** the authentication modal opens

### 37. Active Tab Indicator
**Given** the user is on a specific page  
**When** they view the bottom nav  
**Then** the corresponding nav item is highlighted/active

### 38. PIN Button Styling
**Given** the user is viewing the bottom nav  
**When** they see the PIN button  
**Then** it is prominently styled (larger, different color) as the primary action

## Layout Component

### 39. Main Layout Structure
**Given** the user is on any page  
**When** the page renders  
**Then** they see the header, sidebar (desktop), main content area, and bottom nav (mobile)

### 40. Content Area Padding
**Given** the user is viewing content  
**When** the layout renders  
**Then** appropriate padding is applied using centralized layout tokens

### 41. Responsive Layout
**Given** the user resizes the browser  
**When** the viewport changes  
**Then** the layout adapts between mobile and desktop configurations

### 42. Sidebar Overlay (Mobile)
**Given** the sidebar is open on mobile  
**When** the user views the page  
**Then** a dark overlay appears behind the sidebar

### 43. Dismiss Sidebar Overlay
**Given** the sidebar overlay is visible on mobile  
**When** the user taps the overlay  
**Then** the sidebar closes

### 44. Sticky Header
**Given** the user scrolls down the page  
**When** they scroll  
**Then** the header remains fixed at the top

### 45. Sticky Bottom Nav (Mobile)
**Given** the user scrolls on mobile  
**When** they scroll  
**Then** the bottom navigation remains fixed at the bottom

### 46. Content Scroll
**Given** the page content is longer than the viewport  
**When** the user scrolls  
**Then** only the main content area scrolls (header and nav stay fixed)

### 47. Sidebar Scroll (Desktop)
**Given** there are many categories  
**When** the user views the sidebar  
**Then** the sidebar content is scrollable if it exceeds viewport height

### 48. Z-Index Layering
**Given** multiple UI elements are displayed  
**When** they overlap  
**Then** proper z-index ensures correct stacking (modals > header > sidebar > content)

### 49. Focus Management
**Given** the user opens a modal or sidebar  
**When** it opens  
**Then** focus is trapped within that component for keyboard navigation

### 50. Keyboard Navigation
**Given** the user is using keyboard navigation  
**When** they press Tab  
**Then** focus moves through interactive elements in logical order

### 51. Accessibility Labels
**Given** the user is using a screen reader  
**When** they navigate the layout  
**Then** all interactive elements have appropriate aria-labels and roles

### 52. Mobile Viewport Meta
**Given** the user is on a mobile device  
**When** the page loads  
**Then** the viewport is properly configured to prevent zooming and ensure responsive behavior

### 53. Safe Area Insets (Mobile)
**Given** the user is on a device with notches or home indicators  
**When** they view the layout  
**Then** content respects safe area insets and doesn't overlap system UI

### 54. Theme Consistency
**Given** the user is viewing any page  
**When** the layout renders  
**Then** consistent colors, spacing, and typography are applied throughout

### 55. Loading States
**Given** the page is loading  
**When** initial data is being fetched  
**Then** appropriate loading indicators are shown in the layout
