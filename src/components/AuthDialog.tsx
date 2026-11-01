import { useState } from 'react'
import { X, AlertCircle, CheckCircle2, LogOut } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { ReviewerProfile } from '../types/lexicon'

interface AuthDialogProps {
  open: boolean
  onClose: () => void
  userEmail: string | null
  profile: ReviewerProfile | null
  recoveryMode: boolean
  onClearRecovery: () => void
  onAuthChanged: () => void
}

export function AuthDialog({
  open,
  onClose,
  userEmail,
  profile,
  recoveryMode,
  onClearRecovery,
  onAuthChanged,
}: AuthDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotPassword, setForgotPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null,
  )

  if (!open) return null

  const roleLabel =
    profile?.role === 'admin'
      ? 'مشرف عام'
      : profile?.role === 'editor'
        ? 'محرر معتمد'
        : 'مراجع مساهم'

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

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    if (!email.trim()) {
      setFeedback({ type: 'error', text: 'أدخل بريدك الإلكتروني أولاً لإرسال رابط الاستعادة.' })
      return
    }
    setBusy(true)
    setFeedback(null)
    const redirectOrigin =
      typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/`
        : 'https://darija-lexreview.pages.dev/'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !recoveryMode) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#E5DFD3] bg-[#FBF9F5] p-6 shadow-xl dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5DFD3] pb-4 dark:border-[#2E2B27]">
          <div>
            <h2
              id="auth-dialog-title"
              className="font-display text-lg font-bold text-stone-900 dark:text-stone-100"
            >
              {recoveryMode
                ? 'تعيين كلمة مرور جديدة'
                : userEmail
                  ? 'حساب المراجع'
                  : forgotPassword
                    ? 'استعادة كلمة المرور'
                    : 'دخول المراجعين'}
            </h2>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              {recoveryMode
                ? 'أدخل كلمة المرور الجديدة لتأمين حسابك في المنصة.'
                : userEmail
                  ? 'أنت مسجل الدخول لإرسال المقترحات ومتابعة حالتها.'
                  : forgotPassword
                    ? 'سنرسل رابطاً آمناً لإعادة تعيين كلمة المرور إلى بريدك.'
                    : 'يلزم حساب مراجع مفعل في Supabase لإرسال المقترحات إلى سجل التحكيم.'}
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
            <div className="space-y-4">
              <dl className="divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3] bg-white px-4 dark:divide-[#2E2B27] dark:border-[#2E2B27] dark:bg-[#141312]">
                <div className="py-3 flex items-center justify-between gap-2 text-xs">
                  <dt className="text-stone-500 dark:text-stone-400">البريد الإلكتروني</dt>
                  <dd dir="ltr" className="font-mono text-stone-900 dark:text-stone-100">
                    {userEmail}
                  </dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-2 text-xs">
                  <dt className="text-stone-500 dark:text-stone-400">الصلاحية التحريرية</dt>
                  <dd className="font-medium text-stone-900 dark:text-stone-100">{roleLabel}</dd>
                </div>
              </dl>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={busy}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-white px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-[#F3EFE6] transition-colors cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200 dark:hover:bg-[#262320]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>تسجيل الخروج</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] rounded-lg bg-[#0F5C4E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] transition-colors cursor-pointer dark:bg-[#147A67]"
                >
                  العودة إلى المراجعة
                </button>
              </div>
            </div>
          ) : forgotPassword ? (
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
            <form onSubmit={handleSignIn} className="space-y-4">
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
            </form>
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
