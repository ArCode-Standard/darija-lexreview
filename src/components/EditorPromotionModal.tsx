import { useEffect, useState } from 'react'
import { BadgeCheck, CheckCircle2, Send, ShieldCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ReviewerProfile } from '../types/lexicon'
import { MOROCCAN_REGIONS } from '../utils/validation'

const LOCAL_PROMOTION_REQUESTS_KEY = 'arcode_lexreview_promotion_requests_v1'

export interface StoredPromotionRequest {
  userId: string
  userEmail: string
  displayName: string
  dialectRegion: string
  specialty: string
  motivation: string
  submittedAt: string
}

export function getStoredPromotionRequest(userId?: string | null): StoredPromotionRequest | null {
  if (!userId || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_PROMOTION_REQUESTS_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, StoredPromotionRequest>
    return map[userId] ?? null
  } catch {
    return null
  }
}

function saveStoredPromotionRequest(record: StoredPromotionRequest) {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(LOCAL_PROMOTION_REQUESTS_KEY)
    const map: Record<string, StoredPromotionRequest> = raw ? JSON.parse(raw) : {}
    map[record.userId] = record
    localStorage.setItem(LOCAL_PROMOTION_REQUESTS_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage quota errors
  }
}

interface EditorPromotionModalProps {
  open: boolean
  onClose: () => void
  profile: ReviewerProfile | null
  userEmail: string | null
  acceptedCount?: number
  attestationsCount?: number
  onSubmitted?: () => void
}

export function EditorPromotionModal({
  open,
  onClose,
  profile,
  userEmail,
  acceptedCount = 0,
  attestationsCount = 0,
  onSubmitted,
}: EditorPromotionModalProps) {
  const [dialectRegion, setDialectRegion] = useState(profile?.dialect_region ?? '')
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '')
  const [motivation, setMotivation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingRequest, setExistingRequest] = useState<StoredPromotionRequest | null>(() =>
    getStoredPromotionRequest(profile?.id),
  )

  useEffect(() => {
    if (!open) return
    setDialectRegion(profile?.dialect_region ?? '')
    setSpecialty(profile?.specialty ?? '')
    setError(null)
    setExistingRequest(getStoredPromotionRequest(profile?.id))
  }, [open, profile])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !profile || !userEmail) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !userEmail) return

    const cleanMotivation = motivation.trim()
    const cleanRegion = dialectRegion.trim()
    const cleanSpecialty = specialty.trim()

    if (cleanMotivation.length < 20) {
      setError('يرجى كتابة نبذة مختصرة (20 حرفاً على الأقل) توضح خبرتك اللغوية أو دوافع الانضمام لهيئة التحرير.')
      return
    }

    setSubmitting(true)
    setError(null)

    const structuredReason = [
      `[طلب ترقية إلى محرر معتمد]`,
      `الاسم: ${profile.display_name || userEmail.split('@')[0]}`,
      `المنطقة اللهجية: ${cleanRegion || 'غير محددة'}`,
      `التخصص: ${cleanSpecialty || 'غير محدد'}`,
      `المساهمات المعتمدة: ${acceptedCount} · التصديقات: ${attestationsCount}`,
      `المسوغات: ${cleanMotivation}`,
    ].join(' | ')

    try {
      if (supabase) {
        // Update profile region/specialty if newly provided
        if (
          (cleanRegion && cleanRegion !== profile.dialect_region) ||
          (cleanSpecialty && cleanSpecialty !== profile.specialty)
        ) {
          await supabase
            .from('reviewer_profiles')
            .update({
              dialect_region: cleanRegion || profile.dialect_region || null,
              specialty: cleanSpecialty || profile.specialty || null,
            })
            .eq('id', profile.id)
        }

        // Submit to Admin governance queue so administrators see it in /members
        await supabase.from('member_moderation_reports').insert({
          reporter_id: profile.id,
          target_user_id: profile.id,
          recommended_action: 'promote',
          reason: structuredReason,
          status: 'open',
        })
      }

      const record: StoredPromotionRequest = {
        userId: profile.id,
        userEmail,
        displayName: profile.display_name || userEmail.split('@')[0],
        dialectRegion: cleanRegion,
        specialty: cleanSpecialty,
        motivation: cleanMotivation,
        submittedAt: new Date().toISOString(),
      }
      saveStoredPromotionRequest(record)
      setExistingRequest(record)
      onSubmitted?.()
    } catch {
      const record: StoredPromotionRequest = {
        userId: profile.id,
        userEmail,
        displayName: profile.display_name || userEmail.split('@')[0],
        dialectRegion: cleanRegion,
        specialty: cleanSpecialty,
        motivation: cleanMotivation,
        submittedAt: new Date().toISOString(),
      }
      saveStoredPromotionRequest(record)
      setExistingRequest(record)
      onSubmitted?.()
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 text-sm text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:bg-white dark:border-white/12 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-promotion-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0B0B10]">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-4 dark:border-white/10">
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
              EDITORIAL BOARD APPLICATION · الترشح لهيئة التحرير
            </p>
            <h2
              id="editor-promotion-modal-title"
              className="mt-1 font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white"
            >
              تقديم طلب ترقية إلى صفة «محرر معتمد»
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الترشح"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 cursor-pointer dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {existingRequest ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/70 p-4 dark:border-[#D9FF43]/35 dark:bg-[#D9FF43]/10">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-[#D9FF43]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>طلب الترقية الخاص بك مسجّل وقيد المراجعة الإدارية</span>
                </div>
                <p className="mt-2 text-xs leading-6 text-emerald-950/90 dark:text-zinc-200">
                  تم استلام طلب ترشحك بتاريخ{' '}
                  <span className="font-mono font-semibold">
                    {new Date(existingRequest.submittedAt).toLocaleDateString('ar-MA')}
                  </span>
                  . تراجع إدارة المنصة سجل مساهماتك وتصديقاتك الميدانية وتُشعرك عبر صندوق رسائل الأعضاء فور البتّ في الطلب.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-xs space-y-2 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400">المنطقة اللهجية:</span>
                  <strong className="text-zinc-900 dark:text-white">
                    {existingRequest.dialectRegion || 'غير محددة'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400">التخصص أو الاهتمام:</span>
                  <strong className="text-zinc-900 dark:text-white">
                    {existingRequest.specialty || 'غير محدد'}
                  </strong>
                </div>
                <div className="border-t border-zinc-200 pt-2 dark:border-white/10">
                  <span className="block text-zinc-500 dark:text-zinc-400">ملخص المسوغات المرسلة:</span>
                  <p className="mt-1 leading-6 text-zinc-800 dark:text-zinc-200">
                    {existingRequest.motivation}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMotivation(existingRequest.motivation)
                    setExistingRequest(null)
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                >
                  تحديث بيانات الطلب وإعادة الإرسال
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-xs leading-6 text-zinc-600 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>مسؤوليات المحرر المعتمد في Darija LexReview</span>
                </div>
                <p className="mt-1">
                  يتولى المحرر المعتمد مراجعة مقترحات المجتمع، تدقيق الشواهد السياقية والتأصيل اللغوي، واعتماد المداخل المستوفية لمعايير التوثيق.
                </p>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>المنطقة اللهجية المتقنة</span>
                  <input
                    list="promotion-moroccan-regions"
                    value={dialectRegion}
                    onChange={(e) => setDialectRegion(e.target.value)}
                    maxLength={80}
                    placeholder="مثال: فاس ومكناس، سوس، الشرق..."
                    className={inputClass}
                  />
                  <datalist id="promotion-moroccan-regions">
                    {MOROCCAN_REGIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </label>

                <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>التخصص أو الخلفية اللغوية</span>
                  <input
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    maxLength={120}
                    placeholder="مثال: اللسانيات، الترجمة، التراث الشعبي..."
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>مسوغات الترشح والخبرة في توثيق الدارجة *</span>
                <textarea
                  rows={4}
                  required
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  maxLength={800}
                  placeholder="اذكر بإيجاز خبرتك في اللهجات المغربية أو البحث اللساني أو المجالات الدلالية التي تودّ المساهمة في تحكيمها..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-sm leading-6 text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:bg-white dark:border-white/12 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>يُرفع الطلب مباشرةً إلى لوحة حوكمة المشرف العام</span>
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? 'جارٍ إرسال الطلب…' : 'إرسال طلب الترقية'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
