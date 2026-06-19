# Super Admin Dashboard - Future Implementation Plan

When we are ready to build the Super Admin dashboard for SmartTable, it will be a straightforward process since all the data already exists in Supabase. The goal is to build a high-level UI to manage the entire platform without touching the database directly.

## Core Features to Build

### 1. High-Level Analytics & Revenue
- **MRR (Monthly Recurring Revenue):** Calculate total active tables × ₦2,000.
- **Total Revenue:** Pull total sum from verified Paystack transactions in the `restaurants` and `events` tables.
- **Active vs Inactive Breakdown:** Visual pie chart showing restaurants on free trial, active, past due, or suspended.

### 2. User & Restaurant Management
- **Master List:** A searchable data table listing every registered restaurant/event organizer.
- **Impersonation:** A "Login As" button that temporarily sets your local storage auth to a specific restaurant's ID so you can see exactly what their dashboard looks like for troubleshooting.
- **Status Toggles:** A one-click toggle to suspend or ban a restaurant (immediately hiding their QR menus).

### 3. Subscription & Billing Overrides
- **Manual Activation:** Ability to manually set a restaurant's status to `active` and extend their `subscription_expires_at` date. Useful for clients who prefer to pay you via direct bank transfer rather than Paystack.
- **Table Adjustments:** Ability to manually bump up a restaurant's `table_count` in case of edge cases or special promotions.

### 4. System Logs & Audit
- Track failed payments or Edge Function errors.
- Monitor active event dates.

## Security Architecture
- The dashboard will be built on a protected route (e.g., `/super-admin`).
- It will enforce strict RLS (Row Level Security) or UI checks to ensure it only loads if the currently logged-in user matches `lightorbinnovations@gmail.com` or `olatunbosunfemi5@gmail.com`.

**Complexity:** Low to Medium. Since we already have the Supabase queries and UI components (Shadcn/Tailwind) set up across the app, this will mainly consist of creating a new Layout and fetching aggregate data.
