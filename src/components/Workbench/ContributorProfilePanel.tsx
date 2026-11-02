import { useEffect, useMemo, useState } from 'react'
import { Activity, BadgeCheck, BookOpen, Github, Save, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ReviewerProfile, SubmissionRecord } from '../../types/lexicon'

interface ContributorProfilePanelProps {
  profile: ReviewerProfile | null
  userEmail: string | null
  onProfileSaved: () => void
}

const roleLabels = { reviewer: 'مساهم', editor: 'محرر', admin: 'مدير' } as const

export function ContributorProfilePanel({ profile, userEmail, onProfileSaved }: ContributorProfilePanelProps) {
  const [name, setName] = useState(profile?.display_name ?? '')
  const [region, setRegion] = useState(profile?.dialect_region ?? '')
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '')
  const [github, setGithub] = useState(profile?.github_handle ?? '')
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [attestationsCount, setAttestationsCount] = useState(0)
  const [loading, setLoading] = useState(Boolean(supabase && profile))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)

  useEffect(() => {
    setName(profile?.display_name ?? '')
    setRegion(profile?.dialect_region ?? '')
    setSpecialty(profile?.specialty ?? '')
    setGithub(profile?.github_handle ?? '')
  }, [profile])

  useEffect(() => {
    let active = true
    async function loadActivity() {
      if (!supabase || !profile) { setLoading(false); return }
      setLoading(true)
      const [submissionsResult, attestationsResult] = await Promise.all([
        supabase.from('review_submissions').select('id, entry_id, status, created_at, updated_at, editor_note, reviewer_note, proposed_data, evidence').eq('reviewer_id', profile.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('community_attestations').select('id', { count: 'exact', head: true }).eq('reviewer_id', profile.id),
      ])
      if (!active) return
      if (submissionsResult.error || attestationsResult.error) {
        setActivityError('تعذر تحميل سجل النشاط بالكامل. أعد تحميل الصفحة أو تحقق من صلاحيات الحساب.')
      } else {
        setActivityError(null)
        setSubmissions((submissionsResult.data ?? []) as SubmissionRecord[])
        setAttestationsCount(attestationsResult.count ?? 0)
      }
      setLoading(false)
    }
    void loadActivity()
    return () => { active = false }
  }, [profile])

  const counts = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter((item) => item.status === 'pending').length,
    accepted: submissions.filter((item) => ['accepted', 'merged'].includes(item.status)).length,
    needsChanges: submissions.filter((item) => item.status === 'needs_changes').length,
  }), [submissions])

  async function saveProfile() {
    if (!supabase || !profile) return
    setSaving(true); setError(null); setMessage(null)
    const result = await supabase.from('reviewer_profiles').update({
      display_name: name.trim() || null,
      dialect_region: region.trim() || null,
      specialty: specialty.trim() || null,
      github_handle: github.trim().replace(/^@/, '') || null,
    }).eq('id', profile.id)
    setSaving(false)
    if (result.error) { setError('تعذر حفظ الملف الشخصي. تحقق من الاتصال ثم أعد المحاولة.'); return }
    setMessage('تم حفظ بيانات الملف الشخصي.')
    onProfileSaved()
  }

  if (!profile) {
    return <section className="rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-[#1C1A18]"><UserRound className="mx-auto h-8 w-8 text-stone-400" /><h2 className="mt-3 text-lg font-bold">ملفك الشخصي</h2><p className="mt-2 text-sm text-stone-500">سجّل الدخول لعرض ملفك ومتابعة مساهماتك.</p></section>
  }

  return (
    <section className="space-y-6" aria-labelledby="profile-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">الحساب والمساهمات</p><h2 id="profile-title" className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-100">ملفي الشخصي</h2><p className="mt-1 text-sm text-stone-500">إدارة بياناتك ومتابعة مساهمتك في إثراء المعجم.</p></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#D6CEBE] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200"><BadgeCheck className="h-4 w-4 text-[#0F5C4E] dark:text-[#4FD1C5]" />{roleLabels[profile.role]}</span>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1C1A18]">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4 dark:border-stone-800"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#E8F1ED] text-[#0F5C4E] dark:bg-[#17352F] dark:text-[#7AD6C5]"><UserRound className="h-6 w-6" /></div><div className="min-w-0"><h3 className="font-semibold text-stone-900 dark:text-stone-100">{profile.display_name || 'مساهم جديد'}</h3><p className="truncate text-xs text-stone-500" dir="ltr">{userEmail}</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">الاسم المعروض<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="min-h-11 w-full rounded-lg border border-stone-200 bg-[#FBFAF7] px-3 text-sm font-normal outline-none focus:border-[#0F5C4E] focus:ring-2 focus:ring-[#0F5C4E]/15 dark:border-stone-700 dark:bg-[#141312]" /></label>
            <label className="space-y-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">المنطقة اللهجية<input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={80} placeholder="مثال: الرباط، فاس، الشمال..." className="min-h-11 w-full rounded-lg border border-stone-200 bg-[#FBFAF7] px-3 text-sm font-normal outline-none focus:border-[#0F5C4E] dark:border-stone-700 dark:bg-[#141312]" /></label>
            <label className="space-y-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">التخصص أو مجال الاهتمام<input value={specialty} onChange={(e) => setSpecialty(e.target.value)} maxLength={120} placeholder="مثال: المعجم، اللسانيات، الترجمة..." className="min-h-11 w-full rounded-lg border border-stone-200 bg-[#FBFAF7] px-3 text-sm font-normal outline-none focus:border-[#0F5C4E] dark:border-stone-700 dark:bg-[#141312]" /></label>
            <label className="space-y-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300"><span className="inline-flex items-center gap-1"><Github className="h-3.5 w-3.5" /> حساب GitHub</span><input value={github} onChange={(e) => setGithub(e.target.value)} maxLength={80} dir="ltr" placeholder="username" className="min-h-11 w-full rounded-lg border border-stone-200 bg-[#FBFAF7] px-3 text-sm font-normal outline-none focus:border-[#0F5C4E] dark:border-stone-700 dark:bg-[#141312]" /></label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={saveProfile} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F5C4E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B493E] disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</button>{message && <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{message}</span>}{error && <span role="alert" className="text-xs text-red-600">{error}</span>}</div>
          <p className="mt-3 text-[11px] leading-5 text-stone-400">يمكنك تعديل بياناتك التعريفية فقط. لا يمكن تغيير الدور أو الصلاحيات من هذه الصفحة.</p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1C1A18]"><div className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-[#0F5C4E] dark:text-[#4FD1C5]" />ملخص النشاط</div><div className="mt-4 grid grid-cols-2 gap-3">{[['آخر 100 مساهمة', counts.total], ['مقبولة / مدمجة', counts.accepted], ['قيد المراجعة', counts.pending], ['تحتاج تعديلاً', counts.needsChanges], ['تدقيقات المجتمع', attestationsCount]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#F6F4EF] p-3 dark:bg-[#141312]"><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">{loading ? '—' : value}</p></div>)}</div></div>{activityError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{activityError}</p>}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1C1A18]"><div className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-[#0F5C4E] dark:text-[#4FD1C5]" />مبادئ المساهمة</div><ul className="mt-3 space-y-2 text-xs leading-6 text-stone-600 dark:text-stone-300"><li>قدّم شواهد قابلة للتحقق كلما أمكن.</li><li>ميّز بين الاستعمال المحلي والاستعمال واسع الانتشار.</li><li>لا تعتبر إرسال الاقتراح اعتماداً نهائياً له.</li></ul></div>
        </aside>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#1C1A18]"><div className="border-b border-stone-100 px-5 py-4 dark:border-stone-800"><h3 className="font-semibold">سجل مساهماتي</h3><p className="mt-1 text-xs text-stone-500">آخر 100 اقتراح أرسلتها إلى المنصة.</p></div>{loading ? <p className="p-6 text-sm text-stone-500">جارٍ تحميل النشاط…</p> : activityError ? <p role="alert" className="p-6 text-sm text-red-700 dark:text-red-300">تعذر عرض السجل لأن تحميل البيانات لم يكتمل.</p> : submissions.length === 0 ? <p className="p-6 text-sm text-stone-500">لا توجد مساهمات مسجلة بعد.</p> : <div className="divide-y divide-stone-100 dark:divide-stone-800">{submissions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{String(item.proposed_data?.word_ar || item.entry_id)}</p><p className="mt-1 text-xs text-stone-500">{new Date(item.created_at).toLocaleDateString('ar-MA')} · {item.entry_id}</p></div><span className="rounded-full bg-[#F3EFE6] px-3 py-1 text-[11px] font-semibold text-stone-700 dark:bg-[#2A2622] dark:text-stone-200">{({pending:'قيد المراجعة',accepted:'مقبول',merged:'مدمج',rejected:'مرفوض',needs_changes:'يحتاج تعديلاً',withdrawn:'مسحوب',superseded:'استُبدل'} as Record<string,string>)[item.status] ?? item.status}</span></div>)}</div>}</div>
    </section>
  )
}
