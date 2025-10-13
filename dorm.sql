CREATE TABLE IF NOT EXISTS tenant_debt_summary (
  tenant_id     BIGINT PRIMARY KEY,
  outstanding   DECIMAL(12,2) NOT NULL DEFAULT 0,
  last_due      DATE NULL,
  overdue_days  INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outstanding ON tenant_debt_summary (outstanding);
CREATE INDEX IF NOT EXISTS idx_overdue     ON tenant_debt_summary (overdue_days);
CREATE INDEX IF NOT EXISTS idx_last_due    ON tenant_debt_summary (last_due);
