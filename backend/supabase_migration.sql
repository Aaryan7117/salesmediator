-- ============================================================
-- SalesGen — Qualification Pivot Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Add qualification columns to existing 'leads' table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'collecting',
ADD COLUMN IF NOT EXISTS qualification_checklist JSONB DEFAULT '{}';

-- 2. Create 'qualification_criteria' table (org-configurable criteria)
CREATE TABLE IF NOT EXISTS qualification_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    required_fields JSONB DEFAULT '["name", "company", "role", "use_case"]',
    conditions JSONB DEFAULT '[
        {"field": "company_size", "op": ">=", "value": 50},
        {"field": "timeline_months", "op": "<=", "value": 3}
    ]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id)
);

-- 3. Create 'kb_resources' table (structured product spec links & videos)
CREATE TABLE IF NOT EXISTS kb_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'doc',  -- 'spec', 'video', 'doc', 'guide'
    description TEXT DEFAULT '',
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by org
CREATE INDEX IF NOT EXISTS idx_kb_resources_org ON kb_resources(org_id);
CREATE INDEX IF NOT EXISTS idx_qualification_criteria_org ON qualification_criteria(org_id);

-- 4. Enable Row Level Security (RLS) 
ALTER TABLE qualification_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_resources ENABLE ROW LEVEL SECURITY;

-- RLS policies: service key can do everything (our backend uses service key)
CREATE POLICY "Service key full access" ON qualification_criteria
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service key full access" ON kb_resources
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. INSERT SAMPLE DATA (for your demo org)
-- Replace 'YOUR_ORG_ID' with your actual org UUID from the orgs table
-- You can find it by running: SELECT id, name, slug FROM orgs;
-- ============================================================

-- Uncomment and fill in after you get your org_id:

-- INSERT INTO kb_resources (org_id, title, url, type, description) VALUES
-- ('YOUR_ORG_ID', 'SalesGen Product Spec Sheet', 'https://salesgen.ai/docs/product-spec', 'spec', 'Complete technical specification of SalesGen AI sales agent including intent scoring, persona detection, and conversation pipeline.'),
-- ('YOUR_ORG_ID', 'Platform Demo Video', 'https://youtube.com/watch?v=demo123', 'video', 'Full walkthrough of SalesGen dashboard, live monitor, and widget customization.'),
-- ('YOUR_ORG_ID', 'Integration Guide', 'https://salesgen.ai/docs/integrations', 'doc', 'Step-by-step guide to integrate SalesGen with Slack, CRM, Calendly, and custom webhooks.'),
-- ('YOUR_ORG_ID', 'Quick Start Tutorial', 'https://youtube.com/watch?v=quickstart456', 'video', '5-minute setup guide: embed the widget, upload your knowledge base, go live.'),
-- ('YOUR_ORG_ID', 'API Reference', 'https://salesgen.ai/docs/api', 'spec', 'Full REST API documentation for leads, sessions, chat, and analytics endpoints.');

-- ============================================================
-- DONE! Verify by running:
-- SELECT * FROM qualification_criteria;
-- SELECT * FROM kb_resources;
-- SELECT qualification_status, qualification_checklist FROM leads LIMIT 5;
-- ============================================================
