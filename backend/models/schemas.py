"""
Pydantic request/response models for every API endpoint.
All validation, serialization, and documentation is handled here.
"""

from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def strip_html(value: str) -> str:
    """Remove HTML tags from a string to prevent XSS."""
    return re.sub(r"<[^>]*>", "", value)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class AdminSignupRequest(BaseModel):
    """Admin creates a new organisation and their own account."""
    org_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("org_name", "full_name", mode="before")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return strip_html(v.strip())


class RepJoinRequest(BaseModel):
    """Sales rep signs up using an invite code."""
    invite_code: str = Field(..., min_length=4, max_length=50)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("full_name", mode="before")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return strip_html(v.strip())


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    user_id: str
    org_id: str
    org_slug: str = ""
    role: str
    full_name: str | None = None


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------
class InviteCodeResponse(BaseModel):
    code: str
    org_id: str


class TeamMemberResponse(BaseModel):
    id: str
    full_name: str | None
    email: str | None = None
    role: str
    leads_count: int = 0
    created_at: datetime | None = None


# ---------------------------------------------------------------------------
# KB Documents
# ---------------------------------------------------------------------------
class KBDocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    chunk_count: int
    uploaded_at: datetime | None = None


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = None  # None on first message — server creates one

    @field_validator("message", mode="before")
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        return strip_html(v.strip())


class ResourceServed(BaseModel):
    title: str
    source_file: str
    relevance_score: int
    excerpt: str


class QualificationChecklist(BaseModel):
    """Structured fields extracted from conversation."""
    name: str | None = None
    company: str | None = None
    role: str | None = None
    use_case: str | None = None
    company_size: int | None = None
    timeline: str | None = None
    timeline_months: int | None = None


class KBResource(BaseModel):
    """Structured KB resource with URL and type."""
    title: str
    url: str
    type: str  # "spec" | "video" | "doc" | "guide"
    description: str


class ChatMessageResponse(BaseModel):
    reply: str
    session_id: str
    # Qualification fields (new)
    qualification_status: str = "collecting"  # "collecting" | "qualified" | "unqualified"
    qualification_checklist: QualificationChecklist | None = None
    drafted_email: str | None = None
    meeting_link: str | None = None
    kb_resources: list[KBResource] = []
    # Legacy fields (backward compat)
    intent_score: int = 0
    intent_state: str = "Exploring"
    persona: str | None = None
    resource: ResourceServed | None = None
    show_calendly: bool = False
    calendly_link: str | None = None


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------
class ConversationTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: str | None = None


class LeadResponse(BaseModel):
    id: str
    session_id: str
    persona: str | None = None
    intent_score: int = 0
    intent_state: str = "Exploring"
    signals: list[str] = []
    resources_served: list[dict] = []
    conversation: list[ConversationTurn] = []
    assigned_rep_id: str | None = None
    crm_filed: bool = False
    github_issue_url: str | None = None
    calendly_shown: bool = False
    qualification_status: str = "collecting"
    qualification_checklist: dict | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class LeadListItem(BaseModel):
    id: str
    session_id: str
    persona: str | None = None
    intent_score: int = 0
    intent_state: str = "Exploring"
    signals: list[str] = []
    qualification_status: str = "collecting"
    qualification_checklist: dict | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------
class IntegrationsResponse(BaseModel):
    frappe_url: str | None = None
    frappe_token_set: bool = False
    github_repo: str | None = None
    github_pat_set: bool = False
    calendly_link: str | None = None
    slack_webhook_set: bool = False
    webhook_url: str | None = None


class IntegrationsUpdateRequest(BaseModel):
    frappe_url: str | None = None
    frappe_token: str | None = None
    github_repo: str | None = None
    github_pat: str | None = None
    calendly_link: str | None = None
    slack_webhook: str | None = None
    webhook_url: str | None = None


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class AnalyticsResponse(BaseModel):
    total_leads: int = 0
    avg_intent_score: float = 0.0
    decision_ready_count: int = 0
    conversion_rate: float = 0.0  # calendly_shown / total as percentage


# ---------------------------------------------------------------------------
# Session (rep polling)
# ---------------------------------------------------------------------------
class SessionResponse(BaseModel):
    lead: LeadResponse | None = None


# ---------------------------------------------------------------------------
# Intent History (timeline charts)
# ---------------------------------------------------------------------------
class IntentHistoryItem(BaseModel):
    turn_number: int
    score_before: int
    score_after: int
    signals: list[str] = []
    created_at: datetime | None = None
