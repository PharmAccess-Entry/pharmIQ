-- Performance indexes for high-volume queries
-- These cover the most common query patterns used by the dashboard

-- Orders: the main query always filters by restaurant_id and sorts by created_at
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON orders (restaurant_id, created_at DESC);

-- Orders: status filtering is extremely common (Active tab, counts)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
  ON orders (restaurant_id, status);

-- Notifications: bell icon query
CREATE INDEX IF NOT EXISTS idx_notifications_restaurant_created
  ON notifications (restaurant_id, created_at DESC);

-- Inventory logs: stock adjustment history
CREATE INDEX IF NOT EXISTS idx_inventory_logs_item
  ON inventory_logs (menu_item_id, created_at DESC);

-- Menu items: loading the full menu
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
  ON menu_items (restaurant_id, category);

-- Sent emails: deduplication lookups
CREATE INDEX IF NOT EXISTS idx_sent_emails_lookup
  ON sent_emails (email, template_key);
