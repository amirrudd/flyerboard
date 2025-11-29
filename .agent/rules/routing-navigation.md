---
trigger: always_on
description: Routing and navigation structure
---

# Routing & Navigation

## Routes (React Router v7)
- **/**: HomePage (Ads grid)
- **/ad/:id**: AdDetailPage (View ad, contact seller)
- **/post**: PostAdPage (Create new listing)
- **/dashboard**: DashboardPage (User ads, favorites, settings)
- **/terms**: TermsPage
- **/community-guidelines**: CommunityGuidelinesPage

## Navigation Components
- **Layout**: Wraps all pages. Handles responsive structure.
- **Header**: Desktop top navigation.
- **Sidebar**: Desktop side navigation (collapsible).
- **BottomNav**: Mobile bottom navigation (visible < 768px).

## Patterns
- **Deep Linking**: /ad/:id for direct access to ads.
- **Responsive Nav**: Sidebar collapses on mobile; BottomNav appears.
