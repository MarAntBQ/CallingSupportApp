CREATE TABLE IF NOT EXISTS contact_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lang CHAR(2) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  message TEXT NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  score DECIMAL(3,2) NULL,
  mailed TINYINT(1) NOT NULL DEFAULT 0,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  policy_version CHAR(10) NULL,
  PRIMARY KEY (id),
  KEY idx_contact_created_at (created_at),
  KEY idx_contact_ip_hash_created_at (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS consent TINYINT(1) NOT NULL DEFAULT 0 AFTER mailed;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS policy_version CHAR(10) NULL AFTER consent;
