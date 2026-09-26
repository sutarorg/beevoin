-- Cash on Delivery no longer requires SMS one-time-password verification.
-- The table only held short-lived OTP authorization tokens, so it can be
-- safely removed without affecting customers, orders, payments or inventory.
DROP TABLE IF EXISTS "cod_phone_verifications";
