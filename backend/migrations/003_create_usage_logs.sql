-- Create usage_logs table for the Usage Monitor feature
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'unknown',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  endpoint TEXT NOT NULL DEFAULT 'chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries by org and time
CREATE INDEX IF NOT EXISTS idx_usage_logs_org_id ON usage_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_org_created ON usage_logs(org_id, created_at DESC);

-- Enable RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: org members can read their own usage logs
CREATE POLICY "Users can view their org usage logs"
  ON usage_logs FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM profiles WHERE id = auth.uid()
  ));

-- Policy: service role can insert (backend uses service key)
CREATE POLICY "Service role can insert usage logs"
  ON usage_logs FOR INSERT
  WITH CHECK (true);
