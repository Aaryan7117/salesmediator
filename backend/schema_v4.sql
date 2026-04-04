-- ============================================================
-- SalesGen Schema v4 — Explicit Criteria Config & KB Resources
-- Run this AFTER schema_v3.sql
-- ============================================================

-- Org-Configurable Qualification Criteria
CREATE TABLE IF NOT EXISTS qualification_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  required_fields JSONB DEFAULT '["name", "company", "role", "use_case"]'::jsonb,
  conditions JSONB DEFAULT '[{"field": "company_size", "op": ">=", "value": 50}, {"field": "timeline", "op": "<=", "value": "3 months"}]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qual_criteria_org_id ON qualification_criteria(org_id);


-- Structured Knowledge Base Resources for Unqualified leads
CREATE TABLE IF NOT EXISTS kb_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spec', 'video', 'doc', 'guide')),
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_resources_org_id ON kb_resources(org_id);
