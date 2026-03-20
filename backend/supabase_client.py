"""
Supabase admin client initialised with the service role key.
This client bypasses RLS — use it only on the backend, never expose the key.
"""

from supabase import create_client, Client

from config import settings


_supabase_client: Client | None = None


def get_supabase() -> Client:
    """
    Returns the singleton Supabase client.
    Initialised lazily on first call so the module can be imported
    even in environments where the env vars might not be set yet
    (e.g. during test collection).
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _supabase_client


def get_auth_client() -> Client:
    """
    Returns a FRESH, disposable Supabase client for sign-in operations.

    sign_in_with_password() sets a user session on the client, which
    corrupts the singleton service-role client's auth state.  By using
    a throwaway client for sign-in we keep the singleton untouched.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
    )
