import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Github,
  ShieldCheck,
  CloudUpload,
  UserPlus,
  Mail,
  ArrowLeft,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  LexicalEntry,
  LocalDraft,
  ReviewerProfile,
  RolePromotionRequest,
} from '../types/lexicon'
import { MOROCCAN_REGIONS, sanitizeExternalUrl } from '../utils/validation'
import { auditDraftForSync, syncLocalDraftsToAccount } from '../utils/draftSync'

interface AuthDialogProps {
  open: boolean
  onClose: () => void
  userEmail: string | null
  authProvider: string | null
  profile: ReviewerProfile | null
  recoveryMode: boolean
  draftsList: LocalDraft[]
  entries: LexicalEntry[]
  sandboxPromotionRequests: RolePromotionRequest[]
  onClearRecovery: () => void
  onAuthChanged: () => void
  onRemoveSyncedDrafts: (entryIds: string[]) => void
  onDraftsSyncedSuccess: () => void
  onSubmitSandboxPromotion: (params: {
    requesterId: string
    requesterName: string
    dialectRegion: string | null
    experienceSummary: string
    sampleLinks: string | null
  }) => void
  onJumpToAdminGovernance: (source: 'live' | 'sandbox') => void
}

type SignedOutTab = 'signin' | 'signup'
type SignedInTab = 'profile' | 'promotion'

export function AuthDialog({
  open,
  onClose,
  userEmail,
  authProvider,
  profile,
  recoveryMode,
  draftsList,
  entries,
  sandboxPromotionRequests,
  onClearRecovery,
  onAuthChanged,
  onRemoveSyncedDrafts,
  onDraftsSyncedSuccess,
  onSubmitSandboxPromotion,
  onJumpToAdminGovernance,
}: AuthDialogProps) {
  const [signedOutTab, setSignedOutTab] = useState<SignedOutTab>('signin')
  const [signedInTab, setSignedInTab] = useState<SignedInTab>('profile')

  // Sign-in / Sign-up / Recovery fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [dialectRegion, setDialectRegion] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [charterAccepted, setCharterAccepted] = useState(false)
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false)

  // Optional 6-digit OTP mode inside Sign-In
  const [useOtpLogin, setUseOtpLogin] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const [forgotPassword, setForgotPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Signed-in profile editable state
  const [editName, setEditName] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editSpecialty, setEditSpecialty] = useState('')
  const [editGithub, setEditGithub] = useState('')

  // Editor promotion request state
  const [myLiveRequests, setMyLiveRequests] = useState<RolePromotionRequest[]>([])
  const [myContributionsCount, setMyContributionsCount] = useState<{
    total: number
    accepted: number
  }>({ total: 0, accepted: 0 })
  const [promoExperience, setPromoExperience] = useState('')
  const [promoSampleLink, setPromoSampleLink] = useState('')
  const [livePromoUnavailable, setLivePromoUnavailable] = useState(false)

  const [busy, setBusy] = useState(false)
  const [syncingDrafts, setSyncingDrafts] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)

  const readyDraftsCount = useMemo(
    () => draftsList.filter((d) => auditDraftForSync(d, entries).ready).length,
    [draftsList, entries],
  )

  useEffect(() => {
    if (profile) {
      setEditName(profile.display_name ?? '')
      setEditRegion(profile.dialect_region ?? '')
      setEditSpecialty(profile.specialty ?? '')
      setEditGithub(profile.github_handle ?? '')
    }
  }, [profile])

  const loadMyPromotionContext = useCallback(async () => {
    if (!supabase || !profile?.id) return

    const [subsRes, promoRes] = await Promise.all([
      supabase
        .from('review_submissions')
        .select('id, status')
        .eq('reviewer_id', profile.id),
      supabase
        .from('role_promotion_requests')
        .select('*')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (!subsRes.error && subsRes.data) {
      const total = subsRes.data.length
      const accepted = subsRes.data.filter((s) => s.status === 'accepted').length
      setMyContributionsCount({ total, accepted })
    }

    if (promoRes.error) {
      setLivePromoUnavailable(true)
      setMyLiveRequests([])
    } else {
      setLivePromoUnavailable(false)
      setMyLiveRequests((promoRes.data ?? []) as RolePromotionRequest[])
    }
  }, [profile?.id])

  useEffect(() => {
    if (open && userEmail && profile?.id) {
      loadMyPromotionContext()
    }
  }, [open, userEmail, profile?.id, loadMyPromotionContext])

  // Listen for OAuth popup postMessage completion (iframe-safe OAuth flow)
  useEffect(() => {
    if (!open || !supabase) return

    const handlePopupMessage = async (event: MessageEvent) => {
      const origin = event.origin
      const isAllowedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.includes('localhost') ||
        origin.endsWith('.pages.dev')

      if (!isAllowedOrigin) return
      if (event.data?.type !== 'OAUTH_AUTH_SUCCESS') return

      const rawHash = typeof event.data.hash === 'string' ? event.data.hash : ''
      const rawSearch = typeof event.data.search === 'string' ? event.data.search : ''
      const hashParams = new URLSearchParams(rawHash)
      const searchParams = new URLSearchParams(rawSearch)

      const oauthError =
        hashParams.get('error_description') ||
        searchParams.get('error_description') ||
        hashParams.get('error') ||
        searchParams.get('error')

      if (oauthError) {
        setBusy(false)
        setFeedback({
          type: 'error',
          text: `تعذر إتمام الدخول عبر GitHub: ${oauthError}`,
        })
        return
      }

      setBusy(true)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const authCode = searchParams.get('code')

      try {
        if (accessToken && refreshToken && supabase) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
        } else if (authCode && supabase) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode)
          if (error) throw error
        }

        if (supabase) {
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            const meta = user.user_metadata ?? {}
            const ghHandle =
              typeof meta.user_name === 'string'
                ? meta.user_name
                : typeof meta.preferred_username === 'string'
                  ? meta.preferred_username
                  : null
            const fullName =
              typeof meta.full_name === 'string'
                ? meta.full_name
                : typeof meta.name === 'string'
                  ? meta.name
                  : ghHandle

            // Safe reviewer bootstrap (RLS enforces role = 'reviewer')
            await supabase.from('reviewer_profiles').insert({
              id: user.id,
              display_name: fullName,
              github_handle: ghHandle,
              role: 'reviewer',
            })
          }
        }

        setBusy(false)
        setFeedback({
          type: 'success',
          text: 'تم توثيق الهوية وتسجيل الدخول عبر GitHub بنجاح.',
        })
        onAuthChanged()
      } catch (err) {
        setBusy(false)
        const msg = err instanceof Error ? err.message : 'فشل التحقق من جلسة OAuth'
        setFeedback({
          type: 'error',
          text: `تعذر تثبيت الجلسة بعد مصادقة GitHub: ${msg}`,
        })
      }
    }

    window.addEventListener('message', handlePopupMessage)
    return () => window.removeEventListener('message', handlePopupMessage)
  }, [open, onAuthChanged])

  if (!open) return null

  const roleLabel =
    profile?.role === 'admin'
      ? 'مشرف عام (admin)'
      : profile?.role === 'editor'
        ? 'محرر معتمد (editor)'
        : 'مراجع مساهم (reviewer)'

  const mySandboxRequest = profile?.id
    ? sandboxPromotionRequests.find((r) => r.requester_id === profile.id)
    : undefined

  const latestPromotionRequest = myLiveRequests[0] ?? mySandboxRequest ?? null

  async function handleGitHubOAuth() {
    if (!supabase) return
    setBusy(true)
    setFeedback(null)

    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        scopes: 'read:user user:email',
      },
    })

    if (error || !data?.url) {
      setBusy(false)
      setFeedback({
        type: 'error',
        text: `تعذر بدء مصادقة GitHub: ${error?.message ?? 'تأكد من تفعيل مزود GitHub في إعدادات Supabase Auth.'}`,
      })
      return
    }

    // Open the OAuth provider's authorization URL directly in a centered popup
    const width = 600
    const height = 720
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))

    const popup = window.open(
      data.url,
      'darija_lexreview_github_oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    )

    if (!popup) {
      setBusy(false)
      setFeedback({
        type: 'error',
        text: 'منع المتصفح فتح نافذة مصادقة GitHub المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم المحاولة مجدداً.',
      })
      return
    }

    setBusy(false)
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (!email.trim() || !password) {
      setFeedback({ type: 'error', text: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (error) {
      setFeedback({ type: 'error', text: `تعذر تسجيل الدخول: ${error.message}` })
      return
    }
    setPassword('')
    setFeedback({ type: 'success', text: 'تم تسجيل الدخول بنجاح.' })
    onAuthChanged()
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (!email.trim()) {
      setFeedback({ type: 'error', text: 'أدخل بريدك الإلكتروني لإرسال رمز التحقق.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setBusy(false)
    if (error) {
      setFeedback({ type: 'error', text: `تعذر إرسال رمز الدخول: ${error.message}` })
      return
    }
    setOtpSent(true)
    setFeedback({
      type: 'success',
      text: 'أُرسل رمز التحقق إلى بريدك الإلكتروني. أدخل الرمز المكون من 6 أرقام أدناه.',
    })
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (!otpCode.trim()) {
      setFeedback({ type: 'error', text: 'أدخل رمز التحقق المرسل إلى بريدك.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setFeedback({ type: 'error', text: `رمز التحقق غير صحيح أو منتهي الصلاحية: ${error.message}` })
      return
    }
    setOtpCode('')
    setOtpSent(false)
    setFeedback({ type: 'success', text: 'تم تسجيل الدخول بنجاح.' })
    onAuthChanged()
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return

    if (!displayName.trim() || displayName.trim().length < 2) {
      setFeedback({
        type: 'error',
        text: 'يرجى إدخال الاسم الظاهر أو اللقب العلمي (حرفان على الأقل).',
      })
      return
    }
    if (!email.trim()) {
      setFeedback({ type: 'error', text: 'يرجى إدخال بريد إلكتروني صحيح.' })
      return
    }
    if (password.length < 8) {
      setFeedback({
        type: 'error',
        text: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
      })
      return
    }
    if (password !== signupConfirmPassword) {
      setFeedback({ type: 'error', text: 'كلمتا المرور غير متطابقتين.' })
      return
    }
    if (!charterAccepted) {
      setFeedback({
        type: 'error',
        text: 'يلزم الإقرار بميثاق ArCode للتوثيق المعجمي قبل إنشاء الحساب.',
      })
      return
    }

    setBusy(true)
    setFeedback(null)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name: displayName.trim(),
          dialect_region: dialectRegion || null,
          specialty: specialty.trim() || null,
        },
      },
    })

    if (error) {
      setBusy(false)
      setFeedback({ type: 'error', text: `تعذر إنشاء الحساب: ${error.message}` })
      return
    }

    // If session is immediately active, ensure reviewer_profiles row has metadata
    if (data.session && data.user) {
      await supabase.from('reviewer_profiles').upsert(
        {
          id: data.user.id,
          display_name: displayName.trim(),
          dialect_region: dialectRegion || null,
          specialty: specialty.trim() || null,
          role: 'reviewer',
        },
        { onConflict: 'id' },
      )
      setBusy(false)
      setPassword('')
      setSignupConfirmPassword('')
      setFeedback({
        type: 'success',
        text: 'تم إنشاء حسابك وتفعيله بصلاحية «مراجع مساهم» (reviewer).',
      })
      onAuthChanged()
      return
    }

    setBusy(false)
    setAwaitingEmailConfirmation(true)
    setPassword('')
    setSignupConfirmPassword('')
    setFeedback({
      type: 'success',
      text: 'تم إنشاء الحساب بنجاح بصلاحية «مراجع مساهم». تحقق من صندوق الوارد في بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول.',
    })
  }

  async function handleResendConfirmation() {
    if (!supabase || !email.trim()) return
    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setBusy(false)
    if (error) {
      setFeedback({ type: 'error', text: `تعذر إعادة إرسال التفعيل: ${error.message}` })
    } else {
      setFeedback({
        type: 'success',
        text: 'تمت إعادة إرسال رسالة تأكيد الحساب إلى بريدك الإلكتروني.',
      })
    }
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (!email.trim()) {
      setFeedback({ type: 'error', text: 'أدخل بريدك الإلكتروني أولاً لإرسال رابط الاستعادة.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const redirectOrigin = `${window.location.origin}/`

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectOrigin,
    })
    setBusy(false)
    if (error) {
      setFeedback({ type: 'error', text: `تعذر إرسال رابط الاستعادة: ${error.message}` })
    } else {
      setFeedback({
        type: 'success',
        text: 'إذا كان البريد مسجلاً، ستصلك رسالة تتضمن رابط إعادة تعيين كلمة المرور.',
      })
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (newPassword.length < 8) {
      setFeedback({ type: 'error', text: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'كلمتا المرور غير متطابقتين.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (error) {
      setFeedback({ type: 'error', text: `تعذر تحديث كلمة المرور: ${error.message}` })
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    onClearRecovery()
    await supabase.auth.signOut()
    onAuthChanged()
    setFeedback({
      type: 'success',
      text: 'تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    })
  }

  async function handleSaveProfileMetadata(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !profile?.id) return
    if (!editName.trim()) {
      setFeedback({ type: 'error', text: 'الاسم الظاهر مطلوب لتوثيق المراجعات.' })
      return
    }

    setBusy(true)
    setFeedback(null)

    const cleanHandle = editGithub.trim().replace(/^@/, '')
    const { error } = await supabase
      .from('reviewer_profiles')
      .update({
        display_name: editName.trim(),
        dialect_region: editRegion || null,
        specialty: editSpecialty.trim() || null,
        github_handle: cleanHandle || null,
      })
      .eq('id', profile.id)

    if (error) {
      // Fallback if optional columns aren't migrated yet
      const fallback = await supabase
        .from('reviewer_profiles')
        .update({ display_name: editName.trim() })
        .eq('id', profile.id)

      setBusy(false)
      if (fallback.error) {
        setFeedback({
          type: 'error',
          text: `تعذر حفظ الملف الشخصي: ${fallback.error.message}`,
        })
        return
      }
    } else {
      setBusy(false)
    }

    await supabase.auth.updateUser({
      data: {
        name: editName.trim(),
        dialect_region: editRegion || null,
        specialty: editSpecialty.trim() || null,
      },
    })

    setFeedback({ type: 'success', text: 'تم تحديث بيانات هويتك المعجمية بنجاح.' })
    onAuthChanged()
  }

  async function handleSubmitPromotionRequest(e: React.FormEvent) {
    e.preventDefault()
    const applicantName = (editName || profile?.display_name || userEmail || '').trim()
    if (!applicantName) {
      setFeedback({ type: 'error', text: 'يرجى تحديد اسمك الظاهر في الملف الشخصي أولاً.' })
      return
    }
    if (promoExperience.trim().length < 20) {
      setFeedback({
        type: 'error',
        text: 'يرجى كتابة نبذة واضحة عن خبرتك اللغوية أو المعجمية (20 حرفاً على الأقل).',
      })
      return
    }

    let safeLink: string | null = null
    if (promoSampleLink.trim()) {
      safeLink = sanitizeExternalUrl(promoSampleLink)
      if (!safeLink) {
        setFeedback({
          type: 'error',
          text: 'الرابط المرجعي غير صالح. يرجى إدخال رابط يبدأ بـ https:// (مثل حساب GitHub أو صفحة علمية).',
        })
        return
      }
    }

    if (supabase && profile?.id && !livePromoUnavailable) {
      setBusy(true)
      setFeedback(null)
      const { error } = await supabase.from('role_promotion_requests').insert({
        requester_id: profile.id,
        requester_name: applicantName,
        dialect_region: editRegion || profile.dialect_region || null,
        experience_summary: promoExperience.trim(),
        sample_links: safeLink,
        requested_role: 'editor',
        status: 'pending',
      })
      setBusy(false)

      if (!error) {
        setPromoExperience('')
        setPromoSampleLink('')
        await loadMyPromotionContext()
        setFeedback({
          type: 'success',
          text: 'أُرسل طلب الترقية إلى «محرر معتمد» بنجاح، وسيظهر للمشرف العام (admin) لمراجعته.',
        })
        return
      }

      // If table not migrated yet on remote DB, record in sandbox governance so workflow remains testable
      setLivePromoUnavailable(true)
    }

    onSubmitSandboxPromotion({
      requesterId: profile?.id ?? 'session-reviewer',
      requesterName: applicantName,
      dialectRegion: editRegion || profile?.dialect_region || null,
      experienceSummary: promoExperience.trim(),
      sampleLinks: safeLink,
    })
    setPromoExperience('')
    setPromoSampleLink('')
    setFeedback({
      type: 'success',
      text: 'سُجّل طلب الترقية في طابور حوكمة المحاكاة (لحين تفعيل جدول role_promotion_requests في Supabase). يمكنك معاينته في لوحة حوكمة الصلاحيات.',
    })
  }

  async function handleInlineSyncDrafts() {
    setSyncingDrafts(true)
    setFeedback(null)
    const res = await syncLocalDraftsToAccount(draftsList, entries)
    setSyncingDrafts(false)

    if (res.error && res.syncedEntryIds.length === 0) {
      setFeedback({ type: 'error', text: res.error })
      return
    }

    if (res.syncedEntryIds.length > 0) {
      onRemoveSyncedDrafts(res.syncedEntryIds)
      onDraftsSyncedSuccess()
    }

    setFeedback({
      type: 'success',
      text:
        res.skippedAudits.length > 0
          ? `تمت مزامنة ${res.syncedEntryIds.length} مسودات جاهزة مع حسابك، وبقيت ${res.skippedAudits.length} مسودات محلياً لاستكمال حقولها.`
          : `تمت مزامنة جميع مسوداتك المحلية (${res.syncedEntryIds.length}) مع حسابك بنجاح.`,
    })
  }

  async function handleSignOut() {
    if (!supabase) return
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
    setFeedback(null)
    onAuthChanged()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !recoveryMode) onClose()
      }}
    >
      <div className="my-auto w-full max-w-lg rounded-xl border border-[#E5DFD3] bg-[#FBF9F5] p-6 shadow-xl dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5DFD3] pb-4 dark:border-[#2E2B27]">
          <div>
            <h2
              id="auth-dialog-title"
              className="font-display text-lg font-bold text-stone-900 dark:text-stone-100"
            >
              {recoveryMode
                ? 'تعيين كلمة مرور جديدة'
                : userEmail
                  ? 'حساب المساهم وحوكمة الصلاحية'
                  : forgotPassword
                    ? 'استعادة كلمة المرور'
                    : signedOutTab === 'signup'
                      ? 'إنشاء حساب مراجع جديد'
                      : 'دخول المراجعين والمحررين'}
            </h2>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              {recoveryMode
                ? 'أدخل كلمة المرور الجديدة لتأمين حسابك في المنصة.'
                : userEmail
                  ? 'إدارة هويتك المعجمية، مزامنة مسوداتك، ومتابعة صلاحيتك التحريرية.'
                  : forgotPassword
                    ? 'سنرسل رابطاً آمناً لإعادة تعيين كلمة المرور إلى بريدك.'
                    : signedOutTab === 'signup'
                      ? 'يبدأ كل حساب جديد تلقائياً بصلاحية «مراجع مساهم» محمية بسياسات أمان الصفوف (RLS).'
                      : 'سجّل الدخول عبر GitHub أو البريد الإلكتروني لإرسال المقترحات وحفظ سجل مساهماتك.'}
            </p>
          </div>
          {!recoveryMode && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق النافذة"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 transition-colors cursor-pointer dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-5">
          {!isSupabaseConfigured && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                اتصال Supabase غير مهيأ حالياً. ما يزال بإمكانك حفظ مسوداتك محلياً وتصديرها بصيغة JSON.
              </span>
            </div>
          )}

          {/* 1. Password Recovery Mode */}
          {recoveryMode ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                  كلمة المرور الجديدة (8 أحرف على الأقل)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                />
              </div>
              <button
                type="submit"
                disabled={!isSupabaseConfigured || busy}
                className="w-full min-h-[42px] rounded-lg bg-[#0F5C4E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
              >
                {busy ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}
              </button>
            </form>
          ) : userEmail ? (
            /* 2. Signed-In Account, Draft Sync & Editor Promotion Flow */
            <div className="space-y-4">
              {/* Sub-navigation for signed-in users */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#141312]">
                <button
                  type="button"
                  onClick={() => {
                    setSignedInTab('profile')
                    setFeedback(null)
                  }}
                  className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    signedInTab === 'profile'
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                  }`}
                >
                  بطاقة الهوية والملف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignedInTab('promotion')
                    setFeedback(null)
                  }}
                  className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    signedInTab === 'promotion'
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                  }`}
                >
                  {profile?.role === 'admin'
                    ? 'إدارة الصلاحيات (Admin)'
                    : profile?.role === 'editor'
                      ? 'صلاحية المحرر المعتمد'
                      : 'طلب صلاحية محرر'}
                </button>
              </div>

              {/* Post-Auth Local Drafts Smart Sync Card inside Modal */}
              {draftsList.length > 0 && (
                <div className="rounded-lg border border-[#B8D4CE] bg-[#F2F8F6] p-3.5 text-xs dark:border-[#1E4D43] dark:bg-[#11221F]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        لديك {draftsList.length.toLocaleString('en-US')} مسودات محلية محفوظة في المتصفح
                      </p>
                      <p className="text-stone-600 dark:text-stone-300">
                        {readyDraftsCount > 0
                          ? `${readyDraftsCount} منها مكتملة وجاهزة للإرسال الفوري إلى حسابك.`
                          : 'استكمل حقولها الناقصة من قسم «مسوداتي وسجلي» لإرسالها.'}
                      </p>
                    </div>
                    {readyDraftsCount > 0 && (
                      <button
                        type="button"
                        disabled={syncingDrafts}
                        onClick={handleInlineSyncDrafts}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#0F5C4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#147A67]"
                      >
                        <CloudUpload className="h-3.5 w-3.5" />
                        <span>
                          {syncingDrafts
                            ? 'جارٍ المزامنة...'
                            : `مزامنة المسودات (${readyDraftsCount})`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {signedInTab === 'profile' ? (
                <form onSubmit={handleSaveProfileMetadata} className="space-y-3.5">
                  <dl className="divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3] bg-white px-4 dark:divide-[#2E2B27] dark:border-[#2E2B27] dark:bg-[#141312]">
                    <div className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <dt className="text-stone-500 dark:text-stone-400">البريد الإلكتروني</dt>
                      <dd dir="ltr" className="font-mono text-stone-900 dark:text-stone-100">
                        {userEmail}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <dt className="text-stone-500 dark:text-stone-400">طريقة توثيق الدخول</dt>
                      <dd className="font-medium text-stone-900 dark:text-stone-100">
                        {authProvider === 'github' ? 'حساب GitHub موثق' : 'البريد الإلكتروني'}
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <dt className="text-stone-500 dark:text-stone-400">الصلاحية التحريرية (RBAC)</dt>
                      <dd className="font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                        {roleLabel}
                      </dd>
                    </div>
                  </dl>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        الاسم الظاهر أو اللقب العلمي
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="مثال: د. أمينة الشاوي"
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        الرافد اللهجي / المنطقة
                      </label>
                      <select
                        value={editRegion}
                        onChange={(e) => setEditRegion(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      >
                        <option value="">غير محدد</option>
                        {MOROCCAN_REGIONS.map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        التخصص اللغوي أو التقني
                      </label>
                      <input
                        type="text"
                        value={editSpecialty}
                        onChange={(e) => setEditSpecialty(e.target.value)}
                        placeholder="لسانيات، ترجمة، NLP..."
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        معرّف GitHub (اختياري)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={editGithub}
                        onChange={(e) => setEditGithub(e.target.value)}
                        placeholder="username"
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-left font-mono text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={busy}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-[#F3EFE6] transition-colors cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>تسجيل الخروج</span>
                    </button>

                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[38px] rounded-lg bg-[#0F5C4E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
                    >
                      {busy ? 'جارٍ الحفظ...' : 'حفظ بيانات الهوية'}
                    </button>
                  </div>
                </form>
              ) : profile?.role === 'admin' ? (
                <div className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-4 dark:border-[#2E2B27] dark:bg-[#141312]">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-[#0F5C4E] dark:text-[#4FD1C5]" />
                    <div className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                      <p className="font-bold text-stone-900 dark:text-stone-100">
                        أنت تملك أعلى صلاحية إشرافية (admin)
                      </p>
                      <p className="mt-1">
                        يمكنك مراجعة طلبات الترقية المعلقة وترقية المراجعين الموثوقين إلى صلاحية{' '}
                        <span className="font-mono font-semibold">editor</span> مباشرة من لوحة حوكمة الصلاحيات دون الحاجة لكتابة أوامر SQL.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onJumpToAdminGovernance('live')
                    }}
                    className="w-full inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] cursor-pointer dark:bg-[#147A67]"
                  >
                    <span>فتح لوحة مراجعة طلبات الترقية والصلاحيات</span>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : profile?.role === 'editor' ? (
                <div className="space-y-3 rounded-lg border border-[#E5DFD3] bg-white p-4 text-xs leading-relaxed text-stone-700 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-300">
                  <div className="flex items-center gap-2 font-bold text-[#0F5C4E] dark:text-[#4FD1C5]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>حسابك معتمد بصلاحية محرر معجمي (editor)</span>
                  </div>
                  <p>
                    يحق لك تحكيم المقترحات الواردة في طابور المراجعة الحي، وتوقيع الدفعات الجماعية، وتصدير حزم التحديث الرسمية للمعجم.
                  </p>
                </div>
              ) : (
                /* Reviewer -> Editor Promotion Application Form */
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-xs dark:border-[#2E2B27] dark:bg-[#141312]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-stone-600 dark:text-stone-400">
                        سجل مساهماتك المسجلة في الحساب:
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                        {myContributionsCount.total} مقترحات ({myContributionsCount.accepted} معتمد)
                      </span>
                    </div>
                  </div>

                  {latestPromotionRequest && latestPromotionRequest.status === 'pending' ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-xs leading-relaxed text-amber-950 space-y-2 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                      <p className="font-bold">
                        طلب الترقية الخاص بك قيد مراجعة المشرف العام
                      </p>
                      <p>{latestPromotionRequest.experience_summary}</p>
                      <p className="font-mono text-[11px] tabular-nums opacity-80">
                        تاريخ الإرسال:{' '}
                        {new Date(latestPromotionRequest.created_at).toLocaleString('ar-MA')}
                      </p>
                      {latestPromotionRequest.is_sandbox && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            onJumpToAdminGovernance('sandbox')
                          }}
                          className="mt-1 inline-flex items-center gap-1.5 font-semibold underline cursor-pointer"
                        >
                          <span>معاينة الطلب في لوحة المشرف (وضع المحاكاة)</span>
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitPromotionRequest} className="space-y-3.5">
                      {latestPromotionRequest?.status === 'rejected' && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                          <strong>ملاحظة المشرف على الطلب السابق:</strong>{' '}
                          {latestPromotionRequest.admin_note || 'يرجى استيفاء مزيد من المساهمات الموثقة.'}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          نبذة عن خبرتك اللغوية أو المعجمية ومسوغات طلب صلاحية محرر
                        </label>
                        <textarea
                          rows={3}
                          value={promoExperience}
                          onChange={(e) => setPromoExperience(e.target.value)}
                          placeholder="اشرح خلفيتك في اللسانيات أو الترجمة أو توثيق الدارجة المغربية، ومجالات الفئات المعجمية التي تود المساهمة في تحكيمها..."
                          className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs leading-relaxed text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          رابط GitHub أو أعمال مرجعية سابقة (اختياري)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={promoSampleLink}
                          onChange={(e) => setPromoSampleLink(e.target.value)}
                          placeholder="https://github.com/username"
                          className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-left font-mono text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full min-h-[40px] rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
                      >
                        {busy ? 'جارٍ إرسال الطلب...' : 'تقديم طلب الترقية إلى محرر معتمد'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : forgotPassword ? (
            /* 3. Password Reset Form */
            <form onSubmit={handleSendReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                  البريد الإلكتروني المسجل
                </label>
                <input
                  type="email"
                  dir="ltr"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                />
              </div>
              <button
                type="submit"
                disabled={!isSupabaseConfigured || busy}
                className="w-full min-h-[42px] rounded-lg bg-[#0F5C4E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
              >
                {busy ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(false)
                  setFeedback(null)
                }}
                className="w-full py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer dark:text-stone-400 dark:hover:text-stone-200"
              >
                العودة إلى تسجيل الدخول
              </button>
            </form>
          ) : (
            /* 4. Signed-Out: Sign-In / Sign-Up + GitHub OAuth */
            <div className="space-y-4">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#141312]">
                <button
                  type="button"
                  onClick={() => {
                    setSignedOutTab('signin')
                    setFeedback(null)
                    setAwaitingEmailConfirmation(false)
                  }}
                  className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    signedOutTab === 'signin'
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignedOutTab('signup')
                    setFeedback(null)
                    setUseOtpLogin(false)
                  }}
                  className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    signedOutTab === 'signup'
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                  }`}
                >
                  إنشاء حساب مراجع
                </button>
              </div>

              {draftsList.length > 0 && (
                <div className="rounded-lg border border-[#B8D4CE] bg-[#F2F8F6] px-3.5 py-2.5 text-xs text-stone-700 dark:border-[#1E4D43] dark:bg-[#11221F] dark:text-stone-300">
                  لديك <strong>{draftsList.length} مسودات محفوظة محلياً</strong>؛ ستُتاح لك مزامنتها تلقائياً مع حسابك فور الدخول أو إنشاء الحساب.
                </div>
              )}

              {/* GitHub OAuth Primary Open-Source Entry */}
              <button
                type="button"
                disabled={!isSupabaseConfigured || busy}
                onClick={handleGitHubOAuth}
                className="w-full inline-flex min-h-[42px] items-center justify-center gap-2.5 rounded-lg border border-stone-800 bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer dark:border-stone-700 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
              >
                <Github className="h-4 w-4 shrink-0" />
                <span>
                  {signedOutTab === 'signup'
                    ? 'التسجيل وتوثيق الهوية عبر GitHub'
                    : 'المتابعة السريعة عبر GitHub'}
                </span>
              </button>

              <div className="relative flex items-center py-0.5">
                <div className="grow border-t border-[#E5DFD3] dark:border-[#2E2B27]" />
                <span className="mx-3 shrink-0 text-[11px] text-stone-500 dark:text-stone-400">
                  أو عبر البريد الإلكتروني
                </span>
                <div className="grow border-t border-[#E5DFD3] dark:border-[#2E2B27]" />
              </div>

              {signedOutTab === 'signin' ? (
                useOtpLogin ? (
                  /* 6-Digit Email OTP Passwordless Login */
                  <form
                    onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
                    className="space-y-3.5"
                  >
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        البريد الإلكتروني
                      </label>
                      <input
                        type="email"
                        dir="ltr"
                        disabled={otpSent}
                        placeholder="reviewer@example.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none disabled:opacity-60 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>

                    {otpSent && (
                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          رمز التحقق المكون من 6 أرقام
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-center font-mono text-base tracking-widest text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!isSupabaseConfigured || busy}
                      className="w-full min-h-[42px] rounded-lg bg-[#0F5C4E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
                    >
                      {busy
                        ? 'جارٍ التحقق...'
                        : otpSent
                          ? 'تأكيد الرمز والدخول'
                          : 'إرسال رمز تحقق إلى البريد'}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUseOtpLogin(false)
                          setOtpSent(false)
                          setOtpCode('')
                          setFeedback(null)
                        }}
                        className="text-stone-600 hover:text-stone-900 cursor-pointer dark:text-stone-400 dark:hover:text-stone-200"
                      >
                        الدخول بكلمة المرور بدلاً من الرمز
                      </button>
                      {otpSent && (
                        <button
                          type="button"
                          onClick={() => setOtpSent(false)}
                          className="text-[#0F5C4E] hover:underline cursor-pointer dark:text-[#4FD1C5]"
                        >
                          تعديل البريد
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  /* Standard Email + Password Sign-In */
                  <form onSubmit={handleSignIn} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        البريد الإلكتروني
                      </label>
                      <input
                        type="email"
                        dir="ltr"
                        autoComplete="email"
                        placeholder="reviewer@example.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          كلمة المرور
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotPassword(true)
                            setFeedback(null)
                          }}
                          className="text-xs text-[#0F5C4E] hover:underline cursor-pointer dark:text-[#4FD1C5]"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                      <input
                        type="password"
                        dir="ltr"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2.5 text-sm text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!isSupabaseConfigured || busy}
                      className="w-full min-h-[42px] rounded-lg bg-[#0F5C4E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
                    >
                      {busy ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
                    </button>

                    <div className="text-center pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setUseOtpLogin(true)
                          setFeedback(null)
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-[#0F5C4E] cursor-pointer dark:text-stone-400 dark:hover:text-[#4FD1C5]"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>الدخول برمز تحقق عبر البريد (بدون كلمة مرور)</span>
                      </button>
                    </div>
                  </form>
                )
              ) : (
                /* Self-Serve Reviewer Registration Form (Starts safely as reviewer via RLS) */
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        الاسم الظاهر أو اللقب العلمي *
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="مثال: يوسف التازي"
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        الرافد اللهجي (اختياري)
                      </label>
                      <select
                        value={dialectRegion}
                        onChange={(e) => setDialectRegion(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      >
                        <option value="">اختر المنطقة الجغرافية...</option>
                        {MOROCCAN_REGIONS.map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        البريد الإلكتروني *
                      </label>
                      <input
                        type="email"
                        required
                        dir="ltr"
                        autoComplete="email"
                        placeholder="name@example.org"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        التخصص أو الخلفية (اختياري)
                      </label>
                      <input
                        type="text"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        placeholder="لسانيات، ترجمة، برمجة..."
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        كلمة المرور (8 أحرف فأكثر) *
                      </label>
                      <input
                        type="password"
                        required
                        dir="ltr"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        تأكيد كلمة المرور *
                      </label>
                      <input
                        type="password"
                        required
                        dir="ltr"
                        autoComplete="new-password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#D6CEBE] bg-white px-3 py-2 text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 rounded-lg border border-[#E5DFD3] bg-white p-3 text-xs leading-relaxed text-stone-700 cursor-pointer dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={charterAccepted}
                      onChange={(e) => setCharterAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F5C4E]"
                    />
                    <span>
                      أقرّ بالالتزام بميثاق ArCode للتوثيق المعجمي (إرفاق شواهد حقيقية خالية من البيانات الشخصية)، وأتفهم أن الحساب يُنشأ بصلاحية{' '}
                      <strong className="font-semibold">مراجع مساهم (reviewer)</strong> قابلة للترقية لاحقاً إلى محرر.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={!isSupabaseConfigured || busy}
                    className="w-full inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#0F5C4E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#147A67]"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب مراجع مساهم'}</span>
                  </button>

                  {awaitingEmailConfirmation && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleResendConfirmation}
                      className="w-full py-1.5 text-xs font-semibold text-[#0F5C4E] hover:underline cursor-pointer dark:text-[#4FD1C5]"
                    >
                      لم تصلك الرسالة؟ إعادة إرسال رابط تفعيل البريد الإلكتروني
                    </button>
                  )}
                </form>
              )}
            </div>
          )}

          {feedback && (
            <div
              role="status"
              className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${
                feedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
