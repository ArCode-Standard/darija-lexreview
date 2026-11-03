import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserIdentity } from '@supabase/supabase-js'
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
  Eye,
  EyeOff,
  Link2,
  Unlink,
  KeyRound,
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
import { humanizeSystemError } from '../utils/humanizeError'
import { getGitHubLogin } from '../utils/githubIdentity'
import { TurnstileWidget } from './TurnstileWidget'
import { DarijaDotMatrixLogo } from './DarijaDotMatrixLogo'

interface AuthDialogProps {
  open: boolean
  mode?: 'modal' | 'page'
  onClose: () => void
  userEmail: string | null
  authProvider: string | null
  profile: ReviewerProfile | null
  recoveryMode: boolean
  draftsList: LocalDraft[]
  entries: LexicalEntry[]
  corpusVersion: string
  totalAttestationsCount: number
  onClearRecovery: () => void
  onAuthChanged: () => void
  onRemoveSyncedDrafts: (entryIds: string[]) => void
  onDraftsSyncedSuccess: () => void
  onJumpToAdminGovernance: () => void
}

type SignedOutTab = 'signin' | 'signup'
type SignedInTab = 'profile' | 'promotion'

function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.3 7.4l3.2 2.4c.9-2.4 3.1-4.1 5.5-4.1 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2.2 12 2.2 8.2 2.2 4.9 4.3 3.3 7.4z"
        opacity="0.01"
      />
    </svg>
  )
}

export function AuthDialog({
  open,
  mode = 'modal',
  onClose,
  userEmail,
  authProvider,
  profile,
  recoveryMode,
  draftsList,
  entries,
  corpusVersion,
  totalAttestationsCount,
  onClearRecovery,
  onAuthChanged,
  onRemoveSyncedDrafts,
  onDraftsSyncedSuccess,
  onJumpToAdminGovernance,
}: AuthDialogProps) {
  const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED === 'true'

const [signedOutTab, setSignedOutTab] = useState<SignedOutTab>('signin')
  const [signedInTab, setSignedInTab] = useState<SignedInTab>('profile')

  // Sign-in / Sign-up / Recovery fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [dialectRegion, setDialectRegion] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [charterAccepted, setCharterAccepted] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
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
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [linkingProvider, setLinkingProvider] = useState<'github' | 'google' | null>(null)

  // Editor promotion request state
  const [myLiveRequests, setMyLiveRequests] = useState<RolePromotionRequest[]>([])
  const [myContributionsCount, setMyContributionsCount] = useState<{
    total: number
    accepted: number
    merged: number
  }>({ total: 0, accepted: 0, merged: 0 })
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

  // Escape key closes modal cleanly
  useEffect(() => {
    if (!open || mode === 'page' || recoveryMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, mode, recoveryMode, onClose])

  const loadIdentities = useCallback(async () => {
    if (!supabase || !userEmail) return
    const res = await supabase.auth.getUserIdentities()
    if (!res.error && res.data?.identities) {
      setIdentities(res.data.identities)
    }
  }, [userEmail])

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
      const accepted = subsRes.data.filter(
        (s) => s.status === 'accepted' || s.status === 'merged',
      ).length
      const merged = subsRes.data.filter((s) => s.status === 'merged').length
      setMyContributionsCount({ total, accepted, merged })
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
    if (open && userEmail) {
      void loadIdentities()
      if (profile?.id) {
        void loadMyPromotionContext()
      }
    }
  }, [open, userEmail, profile?.id, loadIdentities, loadMyPromotionContext])

  useEffect(() => {
    const githubIdentity = identities.find((identity) => identity.provider === 'github')
    const linkedGithubHandle = getGitHubLogin(githubIdentity)
    if (!linkedGithubHandle || !profile?.id || !supabase) return

    setEditGithub(linkedGithubHandle)
    if (profile.github_handle === linkedGithubHandle) return

    let active = true
    void supabase
      .from('reviewer_profiles')
      .update({ github_handle: linkedGithubHandle })
      .eq('id', profile.id)
      .then(({ error: syncError }) => {
        if (!active) return
        if (syncError) {
          setFeedback({
            type: 'error',
            text: 'تم ربط GitHub، لكن تعذر حفظ المعرّف تلقائياً. أعد المحاولة لاحقاً.',
          })
          return
        }
        setFeedback({ type: 'success', text: 'تم جلب معرّف GitHub العام وحفظه تلقائياً.' })
        onAuthChanged()
      })

    return () => {
      active = false
    }
  }, [identities, profile?.id, profile?.github_handle, onAuthChanged])

  if (!open) return null

  const roleLabel =
    profile?.role === 'admin'
      ? 'مشرف عام'
      : profile?.role === 'editor'
        ? 'محرر معتمد'
        : 'مراجع مساهم'

  const latestPromotionRequest = myLiveRequests[0] ?? null

  const githubIdentity = identities.find((id) => id.provider === 'github')
  const googleIdentity = identities.find((id) => id.provider === 'google')
  const canUnlinkIdentity = identities.length > 1

  async function handleOAuthSignIn(provider: 'github' | 'google') {
    if (!supabase || busy || (provider === 'google' && !GOOGLE_AUTH_ENABLED)) return
    setBusy(true)
    setFeedback(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === 'github' ? 'read:user user:email' : undefined,
        },
      })
      if (error) throw error
    } catch (err) {
      setBusy(false)
      setFeedback({
        type: 'error',
        text: humanizeSystemError(
          err,
          `تعذر بدء تسجيل الدخول عبر ${provider === 'github' ? 'GitHub' : 'Google'}. تحقق من إعدادات تسجيل الدخول في المنصة ثم أعد المحاولة.`,
        ),
      })
    }
  }

  async function handleLinkProvider(provider: 'github' | 'google') {
    if (!supabase || linkingProvider || (provider === 'google' && !GOOGLE_AUTH_ENABLED)) return
    setLinkingProvider(provider)
    setFeedback(null)
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === 'github' ? 'read:user user:email' : undefined,
        },
      })
      if (error) throw error
    } catch (err) {
      setLinkingProvider(null)
      setFeedback({
        type: 'error',
        text: humanizeSystemError(
          err,
          `تعذر ربط حساب ${provider === 'github' ? 'GitHub' : 'Google'}. تأكد من تفعيل ربط الحسابات الخارجية في إعدادات المنصة.`,
        ),
      })
    }
  }

  async function handleUnlinkProvider(identity: UserIdentity) {
    if (!supabase || !canUnlinkIdentity || busy) return
    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setBusy(false)
    if (error) {
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر فك ارتباط الحساب حالياً.'),
      })
      return
    }
    await loadIdentities()
    onAuthChanged()
    setFeedback({
      type: 'success',
      text: `تم فك ارتباط حساب ${identity.provider === 'github' ? 'GitHub' : 'Google'} بنجاح.`,
    })
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
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.'),
      })
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
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر إرسال رمز الدخول إلى بريدك حالياً.'),
      })
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
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'رمز التحقق غير صحيح أو منتهي الصلاحية.'),
      })
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
    if (!turnstileToken) {
      setFeedback({ type: 'error', text: 'أكمل اختبار التحقق الأمني قبل إنشاء الحساب.' })
      return
    }

    setBusy(true)
    setFeedback(null)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        captchaToken: turnstileToken,
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
      setTurnstileToken(null)
      setTurnstileResetKey((key) => key + 1)
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر إنشاء الحساب حالياً. يرجى المحاولة مجدداً.'),
      })
      return
    }

    setTurnstileToken(null)
    setTurnstileResetKey((key) => key + 1)

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
        text: 'تم إنشاء حسابك وتفعيله بصلاحية «مراجع مساهم».',
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
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر إعادة إرسال رسالة التأكيد حالياً.'),
      })
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
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر إرسال رابط الاستعادة حالياً.'),
      })
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
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر تحديث كلمة المرور حالياً.'),
      })
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
      const fallback = await supabase
        .from('reviewer_profiles')
        .update({ display_name: editName.trim() })
        .eq('id', profile.id)

      setBusy(false)
      if (fallback.error) {
        setFeedback({
          type: 'error',
          text: humanizeSystemError(fallback.error, 'تعذر حفظ الملف الشخصي حالياً.'),
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

    if (!supabase || !profile?.id || livePromoUnavailable) {
      setFeedback({ type: 'error', text: 'خدمة طلبات الترقية غير متاحة حالياً. حاول مجدداً لاحقاً.' })
      return
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
          text: 'أُرسل طلب الترقية إلى «محرر معتمد» بنجاح، وسيراجعه المشرف العام للمنصة.',
        })
        return
      }

      setLivePromoUnavailable(true)
      setFeedback({ type: 'error', text: 'تعذر إرسال طلب الترقية إلى سجل المنصة الرسمي. حاول مجدداً لاحقاً.' })
      return
    }

      }

  async function handleInlineSyncDrafts() {
    setSyncingDrafts(true)
    setFeedback(null)
    const res = await syncLocalDraftsToAccount(draftsList, entries, corpusVersion)
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

  const inputBaseClass =
    'mt-1.5 w-full min-h-[42px] rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-xs sm:text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none transition-colors dark:border-white/12 dark:bg-[#060609] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]'

  const primaryPillBtnClass =
    'w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]'

  const isPage = mode === 'page'

  return (
    <div
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      aria-labelledby="auth-dialog-title"
      className={
        isPage
          ? 'py-2 sm:py-6 flex justify-center'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-md overflow-y-auto'
      }
      onClick={(e) => {
        if (!isPage && e.target === e.currentTarget && !recoveryMode) onClose()
      }}
    >
      <div className={`relative w-full max-w-[880px] overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-white/12 dark:bg-[#0B0B10] ${isPage ? '' : 'my-auto shadow-2xl'}`}>
        <div className={`grid grid-cols-1 ${isPage ? 'xl:grid-cols-12' : 'lg:grid-cols-12'}`}>
          {/* Architectural Identity Rail (Hidden on narrow viewports, monumental on wide desktop) */}
          <aside className={`relative hidden ${isPage ? 'xl:flex xl:col-span-5' : 'lg:flex lg:col-span-5'} flex-col justify-between overflow-hidden border-e border-zinc-200 bg-zinc-950 p-7 text-white dark:border-white/10 dark:bg-[#060609]`}>
            {/* Ambient Glow */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-[#D9FF43]/12 blur-[80px]" />
              <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#FF3B2F]/12 blur-[80px]" />
            </div>

            <div className="relative z-10">
              <div className="dark inline-block">
                <DarijaDotMatrixLogo variant="emblem" width={124} className="text-white" />
              </div>

              <p className="mt-4 font-mono text-[10px] tracking-[0.16em] uppercase text-[#D9FF43]">
                ARCODE IDENTITY · v{corpusVersion}
              </p>
              <h3 className="mt-2 font-display text-xl font-bold leading-snug text-white">
                طبقة توثيق موحّدة بهوية علمية وتقنية موثوقة.
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                سواء كنت باحثاً لسانياً أو مطوّر برمجيات أو ناطقاً بالدارجة، يتيح لك الحساب حفظ مساهماتك وربطها بهويتك على GitHub وGoogle.
              </p>

              <div className="mt-6 space-y-3.5 border-t border-white/10 pt-5 text-xs">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[11px] font-semibold text-[#D9FF43]">01</span>
                  <p className="text-zinc-300 leading-relaxed">
                    مزامنة فورية للمسودات المحفوظة في متصفحك دون ضياع أي تعديل.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[11px] font-semibold text-[#D9FF43]">02</span>
                  <p className="text-zinc-300 leading-relaxed">
                    ربط مباشر بحسابي <span dir="ltr" className="font-mono text-white">GitHub</span> و<span dir="ltr" className="font-mono text-white">Google</span> لإسناد المساهمات المعتمدة.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[11px] font-semibold text-[#D9FF43]">03</span>
                  <p className="text-zinc-300 leading-relaxed">
                    تدرّج شفاف في الصلاحيات من «مراجع مساهم» إلى «محرر معتمد».
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-8 border-t border-white/10 pt-4 flex items-center justify-between text-[11px] text-zinc-400">
              <span>حماية RLS + PKCE OAuth</span>
              <span className="font-mono text-zinc-300">CC BY-NC 4.0</span>
            </div>
          </aside>

          {/* Interactive Auth & Governance Column */}
          <div className={`${isPage ? 'xl:col-span-7' : 'lg:col-span-7'} min-w-0 p-5 sm:p-7 lg:p-8`}>
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-white/10">
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                  {recoveryMode
                    ? 'SECURITY RECOVERY'
                    : userEmail
                      ? 'CONTRIBUTOR ACCOUNT'
                      : 'AUTHENTICATION GATEWAY'}
                </p>
                <h2
                  id="auth-dialog-title"
                  className="mt-1 font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white"
                >
                  {recoveryMode
                    ? 'تعيين كلمة مرور جديدة'
                    : userEmail
                      ? 'حساب المساهم وحوكمة الصلاحية'
                      : forgotPassword
                        ? 'استعادة كلمة المرور'
                        : signedOutTab === 'signup'
                          ? 'إنشاء حساب مراجع جديد'
                          : 'تسجيل الدخول إلى المنصة'}
                </h2>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {recoveryMode
                    ? 'أدخل كلمة المرور الجديدة لتأمين حسابك في المنصة.'
                    : userEmail
                      ? 'إدارة هويتك المعجمية، ربط GitHub، ومتابعة صلاحيتك التحريرية.'
                      : forgotPassword
                        ? 'سنرسل رابطاً آمناً لإعادة تعيين كلمة المرور إلى بريدك الإلكتروني.'
                        : signedOutTab === 'signup'
                          ? 'يبدأ كل حساب جديد بصلاحية «مراجع مساهم» لحفظ المساهمات وتوثيقها باسمك.'
                          : 'ادخل عبر GitHub أو البريد الإلكتروني لمتابعة مساهماتك.'}
                </p>
              </div>
              {!recoveryMode && !isPage && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق النافذة"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:text-zinc-400 dark:hover:border-[#D9FF43] dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-5">
              {!isSupabaseConfigured && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    خدمة الحسابات السحابية غير متاحة حالياً. ما يزال بإمكانك حفظ مسوداتك محلياً وتنزيلها في أي وقت.
                  </span>
                </div>
              )}

              {/* 1. Password Recovery Mode */}
              {recoveryMode ? (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      كلمة المرور الجديدة (8 أحرف على الأقل)
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${inputBaseClass} text-left`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      تأكيد كلمة المرور الجديدة
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputBaseClass} text-left`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!isSupabaseConfigured || busy}
                    className={primaryPillBtnClass}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{busy ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}</span>
                  </button>
                </form>
              ) : userEmail ? (
                /* 2. Signed-In Account, Linked OAuth (GitHub & Google), Draft Sync & Editor Promotion */
                <div className="space-y-4">
                  {/* Sub-navigation for signed-in users */}
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#060609]">
                    <button
                      type="button"
                      onClick={() => {
                        setSignedInTab('profile')
                        setFeedback(null)
                      }}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        signedInTab === 'profile'
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      الهوية وربط الحسابات
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSignedInTab('promotion')
                        setFeedback(null)
                      }}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        signedInTab === 'promotion'
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      {profile?.role === 'admin'
                        ? 'إدارة الصلاحيات'
                        : profile?.role === 'editor'
                          ? 'صلاحية المحرر المعتمد'
                          : 'طلب صلاحية محرر'}
                    </button>
                  </div>

                  {/* Post-Auth Local Drafts Smart Sync Card */}
                  {draftsList.length > 0 && (
                    <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/70 p-3.5 text-xs dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/[0.06]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-zinc-950 dark:text-white">
                            لديك {draftsList.length.toLocaleString('en-US')} مسودات محلية محفوظة في المتصفح
                          </p>
                          <p className="text-zinc-600 dark:text-zinc-300">
                            {readyDraftsCount > 0
                              ? `${readyDraftsCount} منها مكتملة وجاهزة للإرسال الفوري إلى حسابك.`
                              : 'استكمل حقولها الناقصة من قسم «مساهماتي» لإرسالها.'}
                          </p>
                        </div>
                        {readyDraftsCount > 0 && (
                          <button
                            type="button"
                            disabled={syncingDrafts}
                            onClick={handleInlineSyncDrafts}
                            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
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
                    <form onSubmit={handleSaveProfileMetadata} className="space-y-4">
                      <dl className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 dark:divide-white/10 dark:border-white/10 dark:bg-[#060609]">
                        <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">البريد الإلكتروني</dt>
                          <dd dir="ltr" className="min-w-0 truncate font-mono text-zinc-950 dark:text-white">
                            {userEmail}
                          </dd>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <dt className="text-zinc-500 dark:text-zinc-400">مزود الجلسة الحالي</dt>
                          <dd className="font-medium text-zinc-950 dark:text-white">
                            {authProvider === 'github'
                              ? 'حساب GitHub موثق'
                              : authProvider === 'google'
                                ? 'حساب Google موثق'
                                : 'البريد الإلكتروني'}
                          </dd>
                        </div>
                        <div className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <dt className="text-zinc-500 dark:text-zinc-400">الصلاحية التحريرية</dt>
                          <dd className="font-semibold text-emerald-700 dark:text-[#D9FF43]">
                            {roleLabel}
                          </dd>
                        </div>
                      </dl>

                      {/* Linked Accounts: GitHub & Google */}
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 space-y-2.5 dark:border-white/10 dark:bg-[#060609]">
                        <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                          ربط الحسابات الخارجية (الدخول الموحّد بـ GitHub وGoogle)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* GitHub Card */}
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-[#0C0C10]">
                            <div className="flex items-center gap-2 min-w-0">
                              <Github className="h-4 w-4 shrink-0 text-zinc-900 dark:text-white" />
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-900 dark:text-white">GitHub</p>
                                <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {githubIdentity ? 'مرتبط وموثّق' : 'غير مرتبط بعد'}
                                </p>
                              </div>
                            </div>
                            {githubIdentity ? (
                              canUnlinkIdentity && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleUnlinkProvider(githubIdentity)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-red-600 cursor-pointer dark:text-zinc-400 dark:hover:text-[#FF3B2F]"
                                >
                                  <Unlink className="h-3 w-3" />
                                  <span>فك</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                disabled={!isSupabaseConfigured || Boolean(linkingProvider)}
                                onClick={() => handleLinkProvider('github')}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer dark:border-[#D9FF43]/50 dark:text-[#D9FF43] dark:hover:bg-[#D9FF43]/10"
                              >
                                <Link2 className="h-3 w-3" />
                                <span>{linkingProvider === 'github' ? '...' : 'ربط'}</span>
                              </button>
                            )}
                          </div>

                          {/* Google Card */}
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-[#0C0C10]">
                            <div className="flex items-center gap-2 min-w-0">
                              <GoogleMark />
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-900 dark:text-white">Google</p>
                                <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                                  {googleIdentity ? 'مرتبط وموثّق' : GOOGLE_AUTH_ENABLED ? 'غير مرتبط بعد' : 'غير مفعّل حالياً'}
                                </p>
                              </div>
                            </div>
                            {googleIdentity ? (
                              canUnlinkIdentity && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleUnlinkProvider(googleIdentity)}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-red-600 cursor-pointer dark:text-zinc-400 dark:hover:text-[#FF3B2F]"
                                >
                                  <Unlink className="h-3 w-3" />
                                  <span>فك</span>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                disabled={!isSupabaseConfigured || !GOOGLE_AUTH_ENABLED || Boolean(linkingProvider)}
                                onClick={() => handleLinkProvider('google')}
                                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer dark:border-[#D9FF43]/50 dark:text-[#D9FF43] dark:hover:bg-[#D9FF43]/10"
                              >
                                <Link2 className="h-3 w-3" />
                                <span>{linkingProvider === 'google' ? '...' : 'ربط'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contributor Impact Summary */}
                      <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-center text-xs dark:border-white/10 dark:bg-[#060609]">
                        <div>
                          <p className="font-mono text-base font-bold tabular-nums text-zinc-950 dark:text-white">
                            {totalAttestationsCount.toLocaleString('en-US')}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">مراجعة سريعة</p>
                        </div>
                        <div className="border-x border-zinc-200 dark:border-white/10">
                          <p className="font-mono text-base font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                            {myContributionsCount.accepted.toLocaleString('en-US')}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">مقترح معتمد</p>
                        </div>
                        <div>
                          <p className="font-mono text-base font-bold tabular-nums text-zinc-950 dark:text-white">
                            {myContributionsCount.merged.toLocaleString('en-US')}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">مدمج رسمياً</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            الاسم الظاهر أو اللقب العلمي
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="مثال: د. أمينة الشاوي"
                            className={inputBaseClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            الرافد اللهجي / المنطقة
                          </label>
                          <select
                            value={editRegion}
                            onChange={(e) => setEditRegion(e.target.value)}
                            className={inputBaseClass}
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
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            التخصص اللغوي أو التقني
                          </label>
                          <input
                            type="text"
                            value={editSpecialty}
                            onChange={(e) => setEditSpecialty(e.target.value)}
                            placeholder="لسانيات، ترجمة، NLP..."
                            className={inputBaseClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            معرّف GitHub (اختياري)
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={editGithub}
                            onChange={(e) => setEditGithub(e.target.value)}
                            readOnly={Boolean(getGitHubLogin(identities.find((identity) => identity.provider === 'github')))}
                            placeholder="username"
                            aria-describedby="auth-github-handle-help"
                            className={`${inputBaseClass} text-left font-mono`}
                          />
                          <p id="auth-github-handle-help" className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {getGitHubLogin(identities.find((identity) => identity.provider === 'github'))
                              ? 'تم جلب المعرّف من حساب GitHub المرتبط تلقائياً.'
                              : 'اربط حساب GitHub ليتم جلب المعرّف العام تلقائياً.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          disabled={busy}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#060609] dark:text-zinc-200 dark:hover:border-white/30"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>تسجيل الخروج</span>
                        </button>

                        <button
                          type="submit"
                          disabled={busy}
                          className="min-h-[40px] rounded-full bg-zinc-950 px-6 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                        >
                          {busy ? 'جارٍ الحفظ...' : 'حفظ بيانات الهوية'}
                        </button>
                      </div>
                    </form>
                  ) : profile?.role === 'admin' ? (
                    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#060609]">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                        <div className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                          <p className="font-bold text-zinc-950 dark:text-white">
                            أنت تملك صلاحية المشرف العام
                          </p>
                          <p className="mt-1">
                            يمكنك مراجعة طلبات الترقية المعلقة وترقية المراجعين الموثوقين إلى صلاحية «محرر معتمد» مباشرة من لوحة إدارة الصلاحيات.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onJumpToAdminGovernance()
                        }}
                        className={primaryPillBtnClass}
                      >
                        <span>فتح لوحة مراجعة طلبات الترقية والصلاحيات</span>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : profile?.role === 'editor' ? (
                    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-xs leading-relaxed text-zinc-700 dark:border-white/10 dark:bg-[#060609] dark:text-zinc-300">
                      <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-[#D9FF43]">
                        <ShieldCheck className="h-4 w-4" />
                        <span>حسابك معتمد بصلاحية محرر معجمي</span>
                      </div>
                      <p>
                        يحق لك تحكيم المقترحات الواردة في طابور المراجعة الحي، وتوقيع الدفعات الجماعية، وتصدير حزم التحديث الرسمية للمعجم.
                      </p>
                    </div>
                  ) : (
                    /* Reviewer -> Editor Promotion Application Form */
                    <div className="space-y-4">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs dark:border-white/10 dark:bg-[#060609]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400">
                            سجل أثرك المعجمي المسجل:
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                            {myContributionsCount.total} مقترحات · {myContributionsCount.accepted} معتمد · {totalAttestationsCount} مراجعة سريعة
                          </span>
                        </div>
                      </div>

                      {latestPromotionRequest && latestPromotionRequest.status === 'pending' ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs leading-relaxed text-amber-950 space-y-2 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                          <p className="font-bold">
                            طلب الترقية الخاص بك قيد مراجعة المشرف العام
                          </p>
                          <p>{latestPromotionRequest.experience_summary}</p>
                          <p className="font-mono text-[11px] tabular-nums opacity-80">
                            تاريخ الإرسال:{' '}
                            {new Date(latestPromotionRequest.created_at).toLocaleString('ar-MA')}
                          </p>

                        </div>
                      ) : (
                        <form onSubmit={handleSubmitPromotionRequest} className="space-y-3.5">
                          {latestPromotionRequest?.status === 'rejected' && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                              <strong>ملاحظة المشرف على الطلب السابق:</strong>{' '}
                              {latestPromotionRequest.admin_note || 'يرجى استيفاء مزيد من المساهمات الموثقة.'}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              نبذة عن خبرتك اللغوية أو المعجمية ومسوغات طلب صلاحية محرر
                            </label>
                            <textarea
                              rows={3}
                              value={promoExperience}
                              onChange={(e) => setPromoExperience(e.target.value)}
                              placeholder="اشرح خلفيتك في اللسانيات أو الترجمة أو توثيق الدارجة المغربية، ومجالات الفئات المعجمية التي تود المساهمة في تحكيمها..."
                              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/12 dark:bg-[#060609] dark:text-white dark:focus:border-[#D9FF43]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              رابط أعمال أو مراجع لغوية سابقة (اختياري)
                            </label>
                            <input
                              type="url"
                              dir="ltr"
                              value={promoSampleLink}
                              onChange={(e) => setPromoSampleLink(e.target.value)}
                              placeholder="https://github.com/username"
                              className={`${inputBaseClass} text-left font-mono`}
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={busy}
                            className={primaryPillBtnClass}
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
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      البريد الإلكتروني المسجل
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputBaseClass} text-left`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!isSupabaseConfigured || busy}
                    className={primaryPillBtnClass}
                  >
                    {busy ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPassword(false)
                      setFeedback(null)
                    }}
                    className="w-full py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                  >
                    العودة إلى تسجيل الدخول
                  </button>
                </form>
              ) : (
                /* 4. Signed-Out: Sign-In / Sign-Up + GitHub & Google OAuth */
                <div className="space-y-4">
                  {/* Mode Switcher */}
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#060609]">
                    <button
                      type="button"
                      onClick={() => {
                        setSignedOutTab('signin')
                        setFeedback(null)
                        setAwaitingEmailConfirmation(false)
                      }}
                      className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        signedOutTab === 'signin'
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
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
                      className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        signedOutTab === 'signup'
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      إنشاء حساب مراجع
                    </button>
                  </div>

                  {draftsList.length > 0 && (
                    <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-zinc-800 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/[0.06] dark:text-zinc-200">
                      لديك <strong>{draftsList.length} مسودات محفوظة محلياً</strong>؛ ستُتاح لك مزامنتها تلقائياً مع حسابك فور الدخول أو التسجيل.
                    </div>
                  )}

                  {/* Dual OAuth Quick-Entry Row: GitHub + Google */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!isSupabaseConfigured || busy}
                      onClick={() => handleOAuthSignIn('github')}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#121218] dark:text-white dark:hover:border-[#D9FF43]/60 dark:hover:bg-[#17171F]"
                    >
                      <Github className="h-4 w-4 shrink-0" />
                      <span>المتابعة عبر GitHub</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isSupabaseConfigured || !GOOGLE_AUTH_ENABLED || busy}
                      onClick={() => handleOAuthSignIn('google')}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-50 disabled:opacity-50 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#121218] dark:text-white dark:hover:border-[#D9FF43]/60 dark:hover:bg-[#17171F]"
                    >
                      <GoogleMark />
                      <span>{GOOGLE_AUTH_ENABLED ? 'المتابعة عبر Google' : 'Google — غير مفعّل حالياً'}</span>
                    </button>
                  </div>

                  <div className="relative flex items-center py-0.5">
                    <div className="grow border-t border-zinc-200 dark:border-white/10" />
                    <span className="mx-3 shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                      أو عبر البريد الإلكتروني
                    </span>
                    <div className="grow border-t border-zinc-200 dark:border-white/10" />
                  </div>

                  {signedOutTab === 'signin' ? (
                    useOtpLogin ? (
                      /* 6-Digit Email OTP Passwordless Login */
                      <form
                        onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
                        className="space-y-3.5"
                      >
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            البريد الإلكتروني
                          </label>
                          <input
                            type="email"
                            dir="ltr"
                            disabled={otpSent}
                            placeholder="reviewer@example.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`${inputBaseClass} text-left disabled:opacity-60`}
                          />
                        </div>

                        {otpSent && (
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
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
                              className={`${inputBaseClass} text-center font-mono text-base tracking-[0.3em]`}
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={!isSupabaseConfigured || busy}
                          className={primaryPillBtnClass}
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
                            className="text-zinc-600 hover:text-zinc-950 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                          >
                            الدخول بكلمة المرور بدلاً من الرمز
                          </button>
                          {otpSent && (
                            <button
                              type="button"
                              onClick={() => setOtpSent(false)}
                              className="text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
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
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            البريد الإلكتروني
                          </label>
                          <input
                            type="email"
                            dir="ltr"
                            autoComplete="email"
                            placeholder="reviewer@example.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`${inputBaseClass} text-left`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              كلمة المرور
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setForgotPassword(true)
                                setFeedback(null)
                              }}
                              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                            >
                              نسيت كلمة المرور؟
                            </button>
                          </div>
                          <div className="relative" dir="ltr">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              dir="ltr"
                              autoComplete="current-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`${inputBaseClass} text-left pl-3.5 pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                              className="absolute inset-y-0 right-3 mt-1.5 flex items-center text-zinc-400 hover:text-zinc-900 cursor-pointer dark:hover:text-white"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={!isSupabaseConfigured || busy}
                          className={primaryPillBtnClass}
                        >
                          <span>{busy ? 'جارٍ التحقق...' : 'تسجيل الدخول'}</span>
                          <ArrowLeft className="h-4 w-4" />
                        </button>

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setUseOtpLogin(true)
                              setFeedback(null)
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-emerald-700 cursor-pointer dark:text-zinc-400 dark:hover:text-[#D9FF43]"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>الدخول برمز تحقق عبر البريد (بدون كلمة مرور)</span>
                          </button>
                        </div>
                      </form>
                    )
                  ) : (
                    /* Self-Serve Reviewer Registration Form */
                    <form onSubmit={handleSignUp} className="space-y-3.5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            الاسم الظاهر أو اللقب العلمي *
                          </label>
                          <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="مثال: يوسف التازي"
                            className={inputBaseClass}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            الرافد اللهجي (اختياري)
                          </label>
                          <select
                            value={dialectRegion}
                            onChange={(e) => setDialectRegion(e.target.value)}
                            className={inputBaseClass}
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
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
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
                            className={`${inputBaseClass} text-left`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            التخصص أو الخلفية (اختياري)
                          </label>
                          <input
                            type="text"
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            placeholder="لسانيات، ترجمة، برمجة..."
                            className={inputBaseClass}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            كلمة المرور (8 أحرف فأكثر) *
                          </label>
                          <div className="relative" dir="ltr">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              dir="ltr"
                              autoComplete="new-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`${inputBaseClass} text-left pl-3.5 pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                              className="absolute inset-y-0 right-3 mt-1.5 flex items-center text-zinc-400 hover:text-zinc-900 cursor-pointer dark:hover:text-white"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            تأكيد كلمة المرور *
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            dir="ltr"
                            autoComplete="new-password"
                            value={signupConfirmPassword}
                            onChange={(e) => setSignupConfirmPassword(e.target.value)}
                            className={`${inputBaseClass} text-left`}
                          />
                        </div>
                      </div>

                      <TurnstileWidget
                        key={turnstileResetKey}
                        siteKey={(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''}
                        onToken={setTurnstileToken}
                      />

                      <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs leading-relaxed text-zinc-700 cursor-pointer dark:border-white/10 dark:bg-[#060609] dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={charterAccepted}
                          onChange={(e) => setCharterAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600 dark:accent-[#D9FF43]"
                        />
                        <span>
                          أقرّ بالالتزام بميثاق ArCode للتوثيق المعجمي (إرفاق شواهد حقيقية خالية من البيانات الشخصية)، وأتفهم أن الحساب يُنشأ بصلاحية{' '}
                          <strong className="font-semibold text-zinc-950 dark:text-white">مراجع مساهم</strong> قابلة للترقية لاحقاً إلى محرر معتمد.
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={!isSupabaseConfigured || busy || !turnstileToken}
                        className={primaryPillBtnClass}
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>{busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب مراجع مساهم'}</span>
                      </button>

                      {awaitingEmailConfirmation && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleResendConfirmation}
                          className="w-full py-1.5 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
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
                  className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
                    feedback.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/10 dark:text-zinc-100'
                  }`}
                >
                  {feedback.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-[#D9FF43]" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
