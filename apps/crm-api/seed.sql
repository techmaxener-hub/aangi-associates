-- Run once after schema.sql. Seeds the two singleton config rows with the
-- same defaults the Postgres migrations shipped (0004_crm_core.sql,
-- 0007_telephony.sql). The initial admin user is NOT created here (needs
-- a real bcrypt hash, which this SQL-only file can't generate) — run
-- setup_admin.php once instead, per its own header comment.

INSERT INTO calculator_config (id) VALUES (1);

INSERT INTO dialer_rules (id, post_call_whatsapp_template) VALUES (
  1,
  'Hi {{name}}, thanks for speaking with Aangi Associates. We will follow up shortly with next steps.'
);
