# Current Security Review Notes

Date: 2026-11-01

Supabase Security Advisor reported:
- `public.list_staff_display_names()` is SECURITY DEFINER and executable by `authenticated`.
- `public.review_role_promotion_request(uuid,text,text)` is SECURITY DEFINER and executable by `authenticated`.
- Leaked Password Protection is disabled.

These findings are not proof of exploitation. The staff-name RPC appears intentionally restricted to editor callers in its function body; verify its exact definition and authorization helper before changing grants. The promotion RPC must enforce admin authorization internally, independent of client-side UI and RLS.

Review function bodies, ACLs, search_path, owner and effective grants before modifying privileges. Enable leaked-password protection in Supabase Auth settings before general availability.

No independent penetration test has been performed.
