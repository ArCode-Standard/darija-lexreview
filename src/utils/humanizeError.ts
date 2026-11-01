/**
 * Translates raw backend, network, auth, or database constraint errors into
 * clear, respectful Arabic messages safe for contributor and editorial UIs.
 * Never exposes internal table names, SQL states, RLS policies, or stack traces.
 */
export function humanizeSystemError(
  err: unknown,
  fallbackMessage = 'تعذر إتمام العملية حالياً. يرجى المحاولة مرة أخرى بعد لحظات.'
): string {
  if (!err) return fallbackMessage;

  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : typeof (err as { message?: unknown })?.message === 'string'
          ? String((err as { message: string }).message)
          : '';

  const normalized = raw.trim().toLowerCase();
  if (!normalized) return fallbackMessage;

  // Already a clean Arabic domain message without technical identifiers
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  const leaksInternals =
    /supabase|postgrest|postgres|pgrst|rls|row-level|policy|schema\.json|context-schema|review_submissions|community_attestations|role_promotion_requests|supersedes_id|uuid|constraint|sql|jwt/i.test(
      raw
    );
  if (hasArabic && !leaksInternals && raw.length < 220) {
    return raw.trim();
  }

  // Rate limits
  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many') ||
    normalized.includes('exceeded') ||
    normalized.includes('429')
  ) {
    return 'وصلت إلى الحد المسموح به من العمليات المتتالية في الوقت الحالي. يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
  }

  // Authentication & credentials
  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid email or password')
  ) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التثبت من البيانات والمحاولة مرة أخرى.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المرسل إليك قبل تسجيل الدخول.';
  }

  if (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered')
  ) {
    return 'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة أو استعادة كلمة المرور.';
  }

  if (normalized.includes('password should be at least')) {
    return 'يرجى اختيار كلمة مرور قوية لا تقل عن 8 أحرف.';
  }

  if (
    normalized.includes('jwt expired') ||
    normalized.includes('session_not_found') ||
    normalized.includes('refresh_token') ||
    normalized.includes('not authenticated')
  ) {
    return 'انتهت صلاحية الجلسة الحالية. يرجى إعادة تسجيل الدخول للمتابعة.';
  }

  // OAuth provider availability
  if (
    normalized.includes('provider is not enabled') ||
    normalized.includes('unsupported provider')
  ) {
    return 'تسجيل الدخول السريع عبر هذه الخدمة غير متاح مؤقتاً. يمكنك الدخول بالبريد الإلكتروني وكلمة المرور.';
  }

  // Authorization / permissions / RLS
  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('only certified editors') ||
    normalized.includes('not authorized') ||
    normalized.includes('42501')
  ) {
    return 'لا تتوفر لديك الصلاحية الكافية لتنفيذ هذا الإجراء.';
  }

  // Immutability / finalized status transitions
  if (
    normalized.includes('immutable') ||
    normalized.includes('final; submit a follow-up') ||
    normalized.includes('only accepted submissions can be marked as merged')
  ) {
    return 'لا يمكن تعديل قرار حُسم نهائياً؛ يرجى تقديم مراجعة تكميلية جديدة عند الحاجة.';
  }

  // Duplicate / unique constraints
  if (
    normalized.includes('duplicate key') ||
    normalized.includes('unique constraint') ||
    normalized.includes('23505')
  ) {
    return 'يوجد سجل مطابق مسجل مسبقاً، لذا لم يتم تكرار الإرسال.';
  }

  // Network / offline
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('timeout')
  ) {
    return 'تعذر الاتصال بالخادم حالياً. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.';
  }

  return fallbackMessage;
}
