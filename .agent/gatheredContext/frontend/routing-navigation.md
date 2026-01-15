---
trigger: always_on
description: Routing and navigation structure
---

# Routing & Navigation

**Last Updated**: 2025-12-20

## Routes (React Router v7)
- **/**: HomePage (Flyers grid)
- **/ad/:id**: AdDetailPage (View flyer, contact seller)
- **/post**: PostAdPage (Create new listing)
- **/edit/:id**: EditAdPage (Edit existing listing)
- **/dashboard**: DashboardPage (User flyers, favorites, settings)
- **/messages**: MessagesPage (User conversations)
- **/admin**: AdminDashboard (Admin-only, user/flyer management)
- **/terms**: TermsPage
- **/community-guidelines**: CommunityGuidelinesPage

## Navigation Components
- **Layout**: Wraps all pages. Handles responsive structure.
- **Header**: Desktop top navigation.
- **Sidebar**: Desktop side navigation (collapsible).
- **BottomNav**: Mobile bottom navigation (visible < 768px).

## Patterns
- **Deep Linking**: /ad/:id for direct access to flyers.
- **Responsive Nav**: Sidebar collapses on mobile; BottomNav appears.
- **Protected Routes**: Dashboard, Messages, Post require authentication.
- **Admin Route**: /admin requires isAdmin flag on user.
- **Lazy Loading**: All routes except HomePage use React.lazy().
