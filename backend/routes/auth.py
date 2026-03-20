"""
Auth routes: admin signup, rep join, and login.

POST /auth/signup  — admin creates org + their own account
POST /auth/join    — rep joins using an invite code
POST /auth/login   — returns JWT with org_id and role
"""

import logging
import re
import secrets
from fastapi import APIRouter, HTTPException, status

from models.schemas import AdminSignupRequest, RepJoinRequest, LoginRequest, AuthResponse
from supabase_client import get_supabase, get_auth_client

router = APIRouter()
logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    """Convert an org name into a URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    # Append a short random suffix to avoid collisions
    suffix = secrets.token_hex(3)
    return f"{slug}-{suffix}"


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def admin_signup(body: AdminSignupRequest):
    """
    Admin signup flow:
    1. Create auth user in Supabase Auth (auto-confirm enabled)
    2. Create org row
    3. Create users row linking auth user → org with role='admin'
    4. Sign in to get the JWT
    """
    sb = get_supabase()

    # 1. Create the auth user
    # We use the admin API (service role) to auto-confirm the user
    # so they don't need to click an email link during signup.
    try:
        auth_response = sb.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as exc:
        logger.error(f"Signup - create user failed: {exc}")
        detail = str(exc)
        if "already been registered" in detail.lower() or "already registered" in detail.lower():
            detail = "This email is already registered. Try logging in instead."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create account: {detail}",
        )

    auth_user = auth_response.user
    if auth_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup failed — the email may already be registered.",
        )

    user_id = str(auth_user.id)

    # 2. Create the organisation
    slug = _slugify(body.org_name)
    try:
        org_result = (
            sb.table("orgs")
            .insert({"name": body.org_name, "slug": slug})
            .execute()
        )
    except Exception as exc:
        logger.error(f"Signup - create org failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create organisation: {str(exc)}",
        )

    org_row = org_result.data[0]
    org_id = org_row["id"]

    # 3. Create the users profile row
    try:
        sb.table("users").insert({
            "id": user_id,
            "org_id": org_id,
            "role": "admin",
            "full_name": body.full_name,
        }).execute()
    except Exception as exc:
        logger.error(f"Signup - create user profile failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user profile: {str(exc)}",
        )

    # 4. Sign in to get a JWT (use a disposable client to avoid
    #    corrupting the singleton service-role client's auth state)
    try:
        auth_client = get_auth_client()
        sign_in = auth_client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        access_token = sign_in.session.access_token
    except Exception as exc:
        logger.error(f"Signup - sign in failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Account created but login failed: {str(exc)}",
        )

    return AuthResponse(
        access_token=access_token,
        user_id=user_id,
        org_id=org_id,
        org_slug=slug,
        role="admin",
        full_name=body.full_name,
    )


@router.post("/join", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def rep_join(body: RepJoinRequest):
    """
    Rep join flow:
    1. Validate invite code — must exist and not be used
    2. Create auth user (auto-confirmed via admin API)
    3. Create users row with the invite code's org_id and role='rep'
    4. Mark invite code as used
    5. Sign in to get JWT
    """
    sb = get_supabase()

    # 1. Validate the invite code
    invite_result = (
        sb.table("invite_codes")
        .select("*")
        .eq("code", body.invite_code)
        .eq("used", False)
        .execute()
    )

    if not invite_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already-used invite code.",
        )

    invite = invite_result.data[0]
    org_id = invite["org_id"]

    # 2. Create the auth user (auto-confirmed)
    try:
        auth_response = sb.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as exc:
        logger.error(f"Join - create user failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not create account: {str(exc)}",
        )

    auth_user = auth_response.user
    if auth_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup failed — the email may already be registered.",
        )

    user_id = str(auth_user.id)

    # 3. Create the users profile row
    try:
        sb.table("users").insert({
            "id": user_id,
            "org_id": org_id,
            "role": "rep",
            "full_name": body.full_name,
        }).execute()
    except Exception as exc:
        logger.error(f"Join - create user profile failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user profile: {str(exc)}",
        )

    # 4. Mark invite code as used
    try:
        sb.table("invite_codes").update({"used": True, "used_by": user_id}).eq("id", invite["id"]).execute()
    except Exception:
        pass  # Non-critical — the code was already consumed logically

    # 5. Sign in to get a JWT (disposable client)
    try:
        auth_client = get_auth_client()
        sign_in = auth_client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        access_token = sign_in.session.access_token
    except Exception as exc:
        logger.error(f"Join - sign in failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Account created but login failed: {str(exc)}",
        )

    # Fetch org slug
    org_result = sb.table("orgs").select("slug").eq("id", org_id).execute()
    org_slug = org_result.data[0]["slug"] if org_result.data else ""

    return AuthResponse(
        access_token=access_token,
        user_id=user_id,
        org_id=org_id,
        org_slug=org_slug,
        role="rep",
        full_name=body.full_name,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """
    Login flow:
    1. Sign in via Supabase Auth
    2. Look up the users profile row (org_id + role)
    3. Return JWT + metadata
    """
    sb = get_supabase()

    # 1. Authenticate (disposable client)
    try:
        auth_client = get_auth_client()
        sign_in = auth_client.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        access_token = sign_in.session.access_token
        user_id_from_signin = str(sign_in.user.id)
    except Exception as exc:
        logger.error(f"Login failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials: {str(exc)}",
        )

    user_id = user_id_from_signin

    # 2. Get profile
    profile_result = (
        sb.table("users")
        .select("org_id, role, full_name")
        .eq("id", user_id)
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Contact your admin.",
        )

    profile = profile_result.data[0]

    # Fetch org slug
    org_result = sb.table("orgs").select("slug").eq("id", profile["org_id"]).execute()
    org_slug = org_result.data[0]["slug"] if org_result.data else ""

    return AuthResponse(
        access_token=access_token,
        user_id=user_id,
        org_id=profile["org_id"],
        org_slug=org_slug,
        role=profile["role"],
        full_name=profile.get("full_name"),
    )
