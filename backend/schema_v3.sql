-- ============================================================
-- SalesGen Schema v3 — Criteria Verification Migration
-- Run this AFTER schema_v2.sql
-- ============================================================

-- Alter the leads table to add qualification columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_qualified BOOLEAN DEFAULT NULL;

-- Keep intent_score and intent_state for backward compatibility with existing data, 
-- but they are no longer actively used by the new orchestrator logic.
