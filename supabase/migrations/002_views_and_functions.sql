-- 002_views_and_functions.sql
-- Views for complex joins + RPC for atomic order creation

-- ══════════════════════════════════════════════════════════════
-- VIEW: products_with_details
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW products_with_details AS
SELECT
  p.*,
  m.name  AS merchant_name,
  c.name  AS category_name,
  (SELECT pi.url FROM product_images pi
   WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS primary_image
FROM products p
LEFT JOIN merchants m ON m.id = p.merchant_id
LEFT JOIN categories c ON c.id = p.category_id;

-- ══════════════════════════════════════════════════════════════
-- VIEW: cart_items_with_details
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW cart_items_with_details AS
SELECT
  ci.id,
  ci.cart_id,
  ci.product_id,
  ci.quantity,
  ci.selected_variants,
  ci.unit_price,
  ci.created_at,
  p.name        AS product_name,
  p.stock       AS product_stock,
  p.is_active   AS product_active,
  m.id          AS merchant_id,
  m.name        AS merchant_name,
  ct.user_id,
  (SELECT pi.url FROM product_images pi
   WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS primary_image,
  (ci.unit_price * ci.quantity) AS line_total
FROM cart_items ci
JOIN cart ct     ON ct.id = ci.cart_id
JOIN products p  ON p.id = ci.product_id
JOIN merchants m ON m.id = ct.merchant_id;

-- ══════════════════════════════════════════════════════════════
-- VIEW: orders_with_merchant
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW orders_with_merchant AS
SELECT
  o.*,
  m.name AS merchant_name
FROM orders o
JOIN merchants m ON m.id = o.merchant_id;

-- ══════════════════════════════════════════════════════════════
-- VIEW: reviews_with_users
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW reviews_with_users AS
SELECT
  r.*,
  u.first_name,
  u.username
FROM reviews r
JOIN users u ON u.id = r.user_id
WHERE r.is_visible = TRUE;

-- ══════════════════════════════════════════════════════════════
-- VIEW: active_promos
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW active_promos AS
SELECT
  pc.*,
  m.name AS merchant_name
FROM promo_codes pc
JOIN merchants m ON m.id = pc.merchant_id
WHERE pc.is_active = TRUE
  AND (pc.expires_at IS NULL OR pc.expires_at >= CURRENT_DATE)
  AND (pc.max_uses IS NULL OR pc.used_count < pc.max_uses);

-- ══════════════════════════════════════════════════════════════
-- VIEW: categories_with_count
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW categories_with_count AS
SELECT
  c.*,
  COALESCE(cnt.product_count, 0) AS product_count
FROM categories c
LEFT JOIN (
  SELECT category_id, COUNT(*) AS product_count
  FROM products
  WHERE is_active = TRUE
  GROUP BY category_id
) cnt ON cnt.category_id = c.id;

-- ══════════════════════════════════════════════════════════════
-- RPC: place_order — atomic order creation
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION place_order(
  p_user_id         INT,
  p_merchant_id     INT,
  p_delivery_address TEXT,
  p_delivery_province VARCHAR DEFAULT NULL,
  p_customer_note   TEXT DEFAULT NULL,
  p_payment_method  payment_method DEFAULT 'cod',
  p_promo_code      VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cart_id         INT;
  v_order_id        INT;
  v_order_code      VARCHAR(20);
  v_subtotal        DECIMAL(10,2) := 0;
  v_discount        DECIMAL(10,2) := 0;
  v_delivery_fee    DECIMAL(10,2) := 0;
  v_total           DECIMAL(10,2);
  v_promo           RECORD;
  v_item            RECORD;
BEGIN
  -- 1. Find cart
  SELECT id INTO v_cart_id
  FROM cart
  WHERE user_id = p_user_id AND merchant_id = p_merchant_id;

  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'CART_EMPTY';
  END IF;

  -- 2. Calculate subtotal from cart items
  SELECT COALESCE(SUM(ci.unit_price * ci.quantity), 0) INTO v_subtotal
  FROM cart_items ci
  WHERE ci.cart_id = v_cart_id;

  IF v_subtotal = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY';
  END IF;

  -- 3. Delivery fee
  IF v_subtotal > 50 THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := 5;
  END IF;

  -- 4. Promo code validation
  IF p_promo_code IS NOT NULL AND p_promo_code <> '' THEN
    SELECT * INTO v_promo
    FROM promo_codes
    WHERE merchant_id = p_merchant_id
      AND code = p_promo_code
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
      AND (max_uses IS NULL OR used_count < max_uses);

    IF FOUND THEN
      IF v_subtotal >= v_promo.min_order THEN
        IF v_promo.type = 'percent' THEN
          v_discount := ROUND(v_subtotal * v_promo.value / 100, 2);
        ELSE
          v_discount := LEAST(v_promo.value, v_subtotal);
        END IF;
      END IF;
    END IF;
  END IF;

  v_total := v_subtotal + v_delivery_fee - v_discount;

  -- 5. Generate order code
  v_order_code := 'FS-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- 6. Insert order
  INSERT INTO orders (
    order_code, user_id, merchant_id, promo_code_id,
    subtotal, discount_amount, delivery_fee, total,
    status, payment_method, payment_status,
    delivery_address, delivery_province, customer_note
  ) VALUES (
    v_order_code, p_user_id, p_merchant_id,
    CASE WHEN v_promo.id IS NOT NULL THEN v_promo.id ELSE NULL END,
    v_subtotal, v_discount, v_delivery_fee, v_total,
    'pending', p_payment_method, 'unpaid',
    p_delivery_address, p_delivery_province, p_customer_note
  )
  RETURNING id INTO v_order_id;

  -- 7. Insert order items from cart & deduct stock
  FOR v_item IN
    SELECT ci.product_id, p.name AS product_name, p.sku AS product_sku,
           ci.selected_variants, ci.quantity, ci.unit_price,
           (ci.unit_price * ci.quantity) AS item_subtotal
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id
  LOOP
    INSERT INTO order_items (order_id, product_id, product_name, product_sku, selected_variants, quantity, unit_price, subtotal)
    VALUES (v_order_id, v_item.product_id, v_item.product_name, v_item.product_sku, v_item.selected_variants, v_item.quantity, v_item.unit_price, v_item.item_subtotal);

    UPDATE products SET stock = GREATEST(stock - v_item.quantity, 0) WHERE id = v_item.product_id;
  END LOOP;

  -- 8. Record promo usage
  IF v_promo.id IS NOT NULL AND v_discount > 0 THEN
    INSERT INTO promo_usages (promo_code_id, user_id, order_id, discount_applied)
    VALUES (v_promo.id, p_user_id, v_order_id, v_discount);

    UPDATE promo_codes SET used_count = used_count + 1 WHERE id = v_promo.id;
  END IF;

  -- 9. Clear cart
  DELETE FROM cart_items WHERE cart_id = v_cart_id;
  DELETE FROM cart WHERE id = v_cart_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_code', v_order_code,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'status', 'pending',
    'payment_method', p_payment_method,
    'created_at', NOW()
  );
END;
$$;
