-- ============================================================
-- SalesGen Schema v2 — Additional tables
-- Run this AFTER schema.sql
-- ============================================================

-- Widget customisation per org (bot name, colors, greeting)
CREATE TABLE IF NOT EXISTS widget_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  bot_name   TEXT DEFAULT 'AI Assistant',
  greeting   TEXT DEFAULT 'Hi! How can I help you today?',
  brand_color TEXT DEFAULT '#6366f1',
  position   TEXT DEFAULT 'right' CHECK (position IN ('left', 'right')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Intent score history (one row per chat turn, for timeline charts)
CREATE TABLE IF NOT EXISTS intent_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  score_before INTEGER NOT NULL,
  score_after  INTEGER NOT NULL,
  signals     JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Add slack_webhook and webhook_url columns to integrations table
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS slack_webhook TEXT;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_widget_config_org_id ON widget_config(org_id);
CREATE INDEX IF NOT EXISTS idx_intent_history_lead_id ON intent_history(lead_id);
