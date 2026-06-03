-- Run once on production PostgreSQL if user_reports is missing (Coolify → Database → Execute)
CREATE TABLE IF NOT EXISTS user_reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reported_user_id INTEGER NOT NULL REFERENCES users(id),
    conversation_id INTEGER REFERENCES conversations(id),
    reason VARCHAR(64) NOT NULL,
    details TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'in_review',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_reports_reporter_id ON user_reports (reporter_id);
CREATE INDEX IF NOT EXISTS ix_user_reports_reported_user_id ON user_reports (reported_user_id);
CREATE INDEX IF NOT EXISTS ix_user_reports_status ON user_reports (status);
