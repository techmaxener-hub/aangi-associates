-- Aangi Associates CRM — MySQL schema, replacing the 13-migration Postgres
-- schema that lived on the now-deleted Supabase project. Ported table by
-- table from that schema (see apps/crm/supabase/migrations/, kept for
-- historical reference) with these deliberate translation choices:
--   * auth.users + profiles merged into one `users` table (no separate
--     managed-auth schema to keep in sync with anymore).
--   * UUID primary keys kept as CHAR(36), generated in PHP (lib/uuid.php)
--     — keeps the frontend's existing `id: string` typing untouched.
--   * jsonb -> JSON; enum-via-CHECK -> MySQL CHECK (needs MySQL 8.0.16+ /
--     MariaDB 10.2+ to actually enforce — confirm the Hostinger plan's
--     version before relying on it, otherwise validate in PHP too).
--   * timestamptz -> DATETIME (not TIMESTAMP, to avoid its 2038 ceiling
--     and MySQL's session-timezone conversion surprises); all values are
--     written as UTC from PHP (gmdate('Y-m-d H:i:s')).
--   * Postgres RLS policies -> explicit checks in apps/crm-api/lib/auth.php,
--     applied per-endpoint. Nothing in this schema enforces row-level
--     access on its own.
--   * The `log_audit()` trigger -> explicit apps/crm-api/lib/audit.php
--     calls in the users/client_policies/opportunities/claims endpoints.
--   * pg_cron + pg_net (renewal reminders' WhatsApp dispatch) -> a PHP
--     script (apps/crm-api/cron/renewal_reminders.php) run by a Hostinger
--     hPanel cron job — MySQL has no scheduler-with-HTTP-call equivalent.
--
-- Run once against a fresh MySQL/MariaDB database, in this order (FK
-- dependency order, matching the original schema-extraction's ordering).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. users (was auth.users + profiles)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32),
  password_hash VARCHAR(255), -- NULL for client-role users (OTP-only login)
  role ENUM('admin','staff','associate','client') NOT NULL,
  full_name VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE INDEX users_phone_idx ON users (phone);

-- 2. otp_codes (new — client-portal login, replaces Supabase Auth's
--    built-in phone+OTP; see apps/crm-api/auth.php)
CREATE TABLE otp_codes (
  id CHAR(36) PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone);

-- 3. clients
CREATE TABLE clients (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  city VARCHAR(255),
  household_name VARCHAR(255),
  owner_id CHAR(36),
  portal_user_id CHAR(36) UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (portal_user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX clients_owner_idx ON clients (owner_id);
CREATE INDEX clients_portal_user_idx ON clients (portal_user_id);

-- 4. integration_settings
CREATE TABLE integration_settings (
  provider VARCHAR(64) PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status ENUM('connected','disconnected','pending') NOT NULL DEFAULT 'disconnected',
  credentials JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by CHAR(36),
  FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- 5. leads
CREATE TABLE leads (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  city VARCHAR(255),
  lead_type VARCHAR(64),
  source VARCHAR(64) NOT NULL DEFAULT 'manual',
  owner VARCHAR(255),
  notes TEXT,
  status ENUM('new','contacted','qualified','converted','dropped') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by CHAR(36),
  converted_client_id CHAR(36),
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  assigned_to CHAR(36),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (converted_client_id) REFERENCES clients(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX leads_phone_idx ON leads (phone);
CREATE INDEX leads_email_idx ON leads (email);
CREATE INDEX leads_assigned_idx ON leads (assigned_to);

-- 6. client_policies
CREATE TABLE client_policies (
  id CHAR(36) PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  policy_number VARCHAR(255),
  insurer VARCHAR(255) NOT NULL DEFAULT 'TATA AIA',
  product_type VARCHAR(255) NOT NULL,
  sum_assured DECIMAL(14,2),
  premium DECIMAL(14,2),
  start_date DATE,
  renewal_date DATE,
  status ENUM('active','lapsed','matured') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX client_policies_client_idx ON client_policies (client_id);
CREATE INDEX client_policies_renewal_idx ON client_policies (renewal_date);
CREATE INDEX client_policies_status_renewal_idx ON client_policies (status, renewal_date);

-- 7. opportunities
CREATE TABLE opportunities (
  id CHAR(36) PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  product_type VARCHAR(255) NOT NULL,
  stage ENUM('inquiry','quote','application','underwriting','bind_issue') NOT NULL DEFAULT 'inquiry',
  owner_id CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX opportunities_client_idx ON opportunities (client_id);

-- 8. claims
CREATE TABLE claims (
  id CHAR(36) PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  policy_id CHAR(36),
  stage ENUM('notified','documentation','insurer_liaison','settled') NOT NULL DEFAULT 'notified',
  notified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (policy_id) REFERENCES client_policies(id)
) ENGINE=InnoDB;
CREATE INDEX claims_client_idx ON claims (client_id);
CREATE INDEX claims_stage_idx ON claims (stage);

-- 9. communications
CREATE TABLE communications (
  id CHAR(36) PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  channel ENUM('whatsapp','call','email','other') NOT NULL,
  notes TEXT,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logged_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (logged_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX communications_client_idx ON communications (client_id);

-- 10. candidates
CREATE TABLE candidates (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  city VARCHAR(255),
  occupation VARCHAR(255),
  track ENUM('associate','staff') NOT NULL,
  stage VARCHAR(64) NOT NULL DEFAULT 'application',
  source VARCHAR(64) NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 11. tasks
CREATE TABLE tasks (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to CHAR(36),
  due_date DATE,
  status ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
  linked_client_id CHAR(36),
  linked_candidate_id CHAR(36),
  created_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (linked_client_id) REFERENCES clients(id),
  FOREIGN KEY (linked_candidate_id) REFERENCES candidates(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX tasks_assigned_idx ON tasks (assigned_to);
CREATE INDEX tasks_assigned_due_idx ON tasks (assigned_to, due_date);

-- 12. calculator_config (singleton, publicly readable — used by the
--     separate static marketing site, see apps/crm-api/calculator_config.php)
CREATE TABLE calculator_config (
  id INT PRIMARY KEY DEFAULT 1,
  self_consumption_pct DECIMAL(6,2) NOT NULL DEFAULT 20,
  income_growth_pct DECIMAL(6,2) NOT NULL DEFAULT 5,
  discount_rate_pct DECIMAL(6,2) NOT NULL DEFAULT 8,
  edu_inflation_pct DECIMAL(6,2) NOT NULL DEFAULT 9,
  edu_return_pct DECIMAL(6,2) NOT NULL DEFAULT 12,
  sip_return_pct DECIMAL(6,2) NOT NULL DEFAULT 12,
  retirement_inflation_pct DECIMAL(6,2) NOT NULL DEFAULT 6,
  pre_retirement_return_pct DECIMAL(6,2) NOT NULL DEFAULT 12,
  post_retirement_return_pct DECIMAL(6,2) NOT NULL DEFAULT 7,
  default_retirement_age INT NOT NULL DEFAULT 60,
  default_life_expectancy INT NOT NULL DEFAULT 85,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (id = 1)
) ENGINE=InnoDB;

-- 13. calls
CREATE TABLE calls (
  id CHAR(36) PRIMARY KEY,
  lead_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  source_channel VARCHAR(64),
  language_detected VARCHAR(64),
  direction ENUM('inbound','outbound') NOT NULL DEFAULT 'outbound',
  duration_seconds INT,
  intent_score ENUM('high','medium','low'),
  status ENUM('logged','completed','missed','voicemail') NOT NULL DEFAULT 'logged',
  recording_url VARCHAR(1024),
  notes TEXT,
  created_by CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX calls_phone_idx ON calls (phone);
CREATE INDEX calls_created_at_idx ON calls (created_at DESC);

-- 14. dialer_rules (singleton, admin-only)
CREATE TABLE dialer_rules (
  id INT PRIMARY KEY DEFAULT 1,
  delay_seconds INT NOT NULL DEFAULT 60,
  max_retries INT NOT NULL DEFAULT 3,
  post_call_whatsapp_template TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (id = 1)
) ENGINE=InnoDB;

-- 15. app_errors
CREATE TABLE app_errors (
  id CHAR(36) PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  url VARCHAR(1024),
  user_id CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 16. audit_log (written explicitly by apps/crm-api/lib/audit.php, not a
--     trigger — see schema-header note)
CREATE TABLE audit_log (
  id CHAR(36) PRIMARY KEY,
  table_name VARCHAR(64) NOT NULL,
  record_id CHAR(36) NOT NULL,
  action ENUM('insert','update','delete') NOT NULL,
  changed_by CHAR(36),
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  old_data JSON,
  new_data JSON,
  FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE INDEX audit_log_record_idx ON audit_log (table_name, record_id);
CREATE INDEX audit_log_changed_at_idx ON audit_log (changed_at DESC);

-- 17. renewal_reminders (dispatched by cron/renewal_reminders.php, not a
--     database function/pg_cron job — MySQL has no HTTP-calling scheduler)
CREATE TABLE renewal_reminders (
  id CHAR(36) PRIMARY KEY,
  policy_id CHAR(36) NOT NULL,
  client_id CHAR(36) NOT NULL,
  milestone_days INT NOT NULL,
  renewal_date DATE NOT NULL,
  scheduled_for DATE NOT NULL,
  status ENUM('pending','sent','skipped_no_credentials','failed') NOT NULL DEFAULT 'pending',
  channel VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
  sent_at DATETIME,
  error_detail TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (policy_id, milestone_days, renewal_date),
  CHECK (milestone_days IN (60, 30, 14)),
  FOREIGN KEY (policy_id) REFERENCES client_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX renewal_reminders_status_idx ON renewal_reminders (status);
CREATE INDEX renewal_reminders_client_idx ON renewal_reminders (client_id);

SET FOREIGN_KEY_CHECKS = 1;
