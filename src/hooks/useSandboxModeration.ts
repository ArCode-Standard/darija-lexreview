import { useCallback, useEffect, useState } from 'react'
import type {
  EvidenceItem,
  ProposedFields,
  SubmissionRecord,
  SubmissionStatus,
} from '../types/lexicon'

const SANDBOX_STORAGE_KEY = 'arcode_darija_lexreview_sandbox_queue_v2'

const INITIAL_SANDBOX_SUBMISSIONS: SubmissionRecord[] = [
  {
    id: 'sandbox-edit-001',
    entry_id: '1',
    proposed_data: {
      submission_kind: 'edit_entry',
      usage_note: 'تُستعمل بصيغة الجمع (بكم) للمفرد تعظيماً وللجمع في سياق الترحيب اليومي.',
      example_darija: 'السلام عليكم، تفضلوا الدار داركم.',
      example_arabizi: 'salam 3likoum, tfddlou ddar darkoum.',
      example_translation: 'السلام عليكم، تفضلوا البيت بيتكم.',
      example_french: 'Bonjour, entrez je vous en prie, faites comme chez vous.',
      register: 'neutral',
    },
    evidence: [
      {
        url: 'https://github.com/ArCode-Standard/moroccan-darija-dataset',
        note: 'شاهد تداولي شائع في عبارات الاستقبال المنزلية بالمغرب.',
      },
    ],
    reviewer_note: 'إثراء المدخل الأول بشاهد سياقي إضافي يبرز تراكيب الضيافة المغربية.',
    status: 'pending',
    editor_note: null,
    created_at: '2026-10-31T09:15:00.000Z',
    updated_at: '2026-10-31T09:15:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'sandbox-new-002',
    entry_id: 'NEW',
    proposed_data: {
      submission_kind: 'new_entry',
      word_ar: 'تبارك الله',
      arabizi: 'tbarkllah',
      category: 'عبارات المجاملة',
      msa_translation: 'تبارك الله؛ ما شاء الله (للاستحسان والتقدير)',
      french_translation: 'Dieu soit béni ; bravo, félicitations',
      entry_type: 'expression',
      register: 'neutral',
      regions: ['مشترك عام'],
      source_type: 'contributor',
      source_name: 'رصد ميداني — Darija LexReview',
      rights_confirmed: true,
      example_darija: 'تبارك الله عليك، الخدمة متقونة بزاف.',
      example_arabizi: 'tbarkllah 3lik, lkhdma mt9ouna bzzaf.',
      example_translation: 'ما شاء الله عليك، العمل متقن جداً.',
      example_french: 'Bravo à toi, le travail est très soigné.',
    },
    evidence: [
      {
        url: 'https://ar.wiktionary.org/wiki/%D8%AA%D8%A8%D8%A7%D8%B1%D9%83_%D8%A7%D9%84%D9%84%D9%87',
        note: 'تعبير استحسان وثناء متداول يومياً في عموم المغرب.',
      },
    ],
    reviewer_note: 'عبارة محورية في التخاطب المغربي اليومي للتعبير عن الإعجاب.',
    status: 'pending',
    editor_note: null,
    created_at: '2026-10-31T14:20:00.000Z',
    updated_at: '2026-10-31T14:20:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'sandbox-acc-003',
    entry_id: '2',
    proposed_data: {
      submission_kind: 'edit_entry',
      usage_note: 'ردّ تحية قياسي في السياقات الرسمية واليومية على السواء.',
      example_darija: 'وعليكم السلام، مرحبا بيكم عندنا.',
      example_arabizi: 'wa 3likoum ssalam, mrhba bikoum 3ndna.',
      example_translation: 'وعليكم السلام، مرحباً بكم عندنا.',
      example_french: 'Et sur vous la paix, soyez les bienvenus chez nous.',
      register: 'neutral',
    },
    evidence: [
      {
        url: 'https://github.com/ArCode-Standard/moroccan-darija-dataset',
        note: 'توثيق صيغة رد التحية المقترنة بالترحيب.',
      },
    ],
    reviewer_note: 'إضافة شاهد سياقي متمم للمدخل رقم 2.',
    status: 'accepted',
    editor_id: 'ed-salma',
    editor_display_name: 'د. سلمى العمراني',
    editor_note: 'شاهد سياقي سليم ومطابق لقواعد الضبط المعتمدة.',
    created_at: '2026-10-27T10:00:00.000Z',
    updated_at: '2026-10-27T12:24:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'sandbox-acc-004',
    entry_id: 'NEW',
    proposed_data: {
      submission_kind: 'new_entry',
      word_ar: 'على سلامتك',
      arabizi: '3la slamtk',
      category: 'عبارات المجاملة',
      msa_translation: 'الحمد لله على سلامتك (تقال للقادم من سفر أو المتعافي)',
      french_translation: 'Bon retour ; heureux de te voir sain et sauf',
      entry_type: 'expression',
      register: 'neutral',
      regions: ['مشترك عام'],
      source_type: 'contributor',
      source_name: 'رصد ميداني — Darija LexReview',
      rights_confirmed: true,
      example_darija: 'على سلامتك منين وصلتي على خير.',
      example_arabizi: '3la slamtk mnin wslti 3la khir.',
      example_translation: 'الحمد لله على سلامتك حين وصلت بخير.',
      example_french: 'Heureux que tu sois bien arrivé.',
    },
    evidence: [
      {
        url: 'https://github.com/ArCode-Standard/moroccan-darija-dataset',
        note: 'من أكثر عبارات المجاملة المغربية شيوعاً عند القدوم أو الشفاء.',
      },
    ],
    reviewer_note: 'عبارة مجاملة أساسية غير مدرجة بعد في الفئة.',
    status: 'accepted',
    editor_id: 'ed-youssef',
    editor_display_name: 'أ. يوسف الفاسي',
    editor_note: 'إضافة موفقة ومستوفية للحقول الخمسة والشاهد السياقي.',
    created_at: '2026-10-28T08:30:00.000Z',
    updated_at: '2026-10-28T12:18:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'sandbox-acc-005',
    entry_id: '3',
    proposed_data: {
      submission_kind: 'edit_entry',
      usage_note: 'تحية صباحية عامة في الحواضر والبوادي المغربية.',
    },
    evidence: [
      {
        url: 'https://github.com/ArCode-Standard/moroccan-darija-dataset',
        note: 'توضيح التوزيع التداولي للمدخل.',
      },
    ],
    reviewer_note: 'إضافة ملاحظة تداولية مختصرة.',
    status: 'accepted',
    editor_id: 'ed-salma',
    editor_display_name: 'د. سلمى العمراني',
    editor_note: 'تمت المراجعة والاعتماد.',
    created_at: '2026-10-29T11:00:00.000Z',
    updated_at: '2026-10-29T12:45:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'sandbox-chg-006',
    entry_id: '4',
    proposed_data: {
      submission_kind: 'edit_entry',
      arabizi: 'chnou / achnou',
    },
    evidence: [
      {
        url: 'https://github.com/ArCode-Standard/moroccan-darija-dataset',
        note: 'تعدد النطق بين شنو وأشنو.',
      },
    ],
    reviewer_note: 'توسيع الكتابة اللاتينية لتشمل المتغير الصوتي.',
    status: 'needs_changes',
    editor_id: 'ed-youssef',
    editor_display_name: 'أ. يوسف الفاسي',
    editor_note: 'يرجى إرفاق جملة شاهد تبرز صيغة «أشنو» مع كتابتها اللاتينية قبل الاعتماد.',
    created_at: '2026-10-29T15:10:00.000Z',
    updated_at: '2026-10-29T18:10:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'sandbox-rej-007',
    entry_id: 'NEW',
    proposed_data: {
      submission_kind: 'new_entry',
      word_ar: 'ازيك',
      arabizi: 'izzayak',
      category: 'تحيات',
      msa_translation: 'كيف حالك',
      french_translation: 'Comment vas-tu',
      entry_type: 'conversational',
      register: 'informal',
      source_type: 'web',
      rights_confirmed: true,
      example_darija: 'ازيك عامل ايه',
      example_arabizi: 'izzayak 3amil eh',
    },
    evidence: [
      {
        url: 'https://ar.wikipedia.org/wiki/%D9%84%D9%87%D8%AC%D8%A9_%D9%85%D8%B5%D8%B1%D9%8A%D8%A9',
        note: 'مثال للمقارنة اللهجية.',
      },
    ],
    reviewer_note: 'اختبار فحص التداول المغربي.',
    status: 'rejected',
    editor_id: 'ed-karim',
    editor_display_name: 'أ. كريم التازي',
    editor_note: 'مرفوض لعدم الانتماء إلى المتن الدارج المغربي (المفردة من العامية المصرية).',
    created_at: '2026-10-30T09:00:00.000Z',
    updated_at: '2026-10-30T09:54:00.000Z',
    is_sandbox: true,
  },
]

export function useSandboxModeration() {
  const [sandboxItems, setSandboxItems] = useState<SubmissionRecord[]>(() => {
    try {
      const raw = localStorage.getItem(SANDBOX_STORAGE_KEY)
      if (!raw) return INITIAL_SANDBOX_SUBMISSIONS
      const parsed = JSON.parse(raw) as SubmissionRecord[]
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SANDBOX_SUBMISSIONS
    } catch {
      return INITIAL_SANDBOX_SUBMISSIONS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxItems))
    } catch {
      // Ignore storage quota errors
    }
  }, [sandboxItems])

  const addSandboxSubmission = useCallback(
    (params: {
      entryId: string
      proposedData: ProposedFields
      evidence: EvidenceItem[]
      reviewerNote: string | null
    }) => {
      const now = new Date().toISOString()
      const item: SubmissionRecord = {
        id: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entry_id: params.entryId,
        proposed_data: params.proposedData,
        evidence: params.evidence,
        reviewer_note: params.reviewerNote,
        status: 'pending',
        editor_note: null,
        created_at: now,
        updated_at: now,
        is_sandbox: true,
      }
      setSandboxItems((prev) => [item, ...prev])
      return item
    },
    [],
  )

  const moderateSandboxSubmission = useCallback(
    (params: {
      id: string
      status: SubmissionStatus
      editorNote: string | null
      proposedData: ProposedFields
      editorId?: string
      editorDisplayName?: string
    }) => {
      const now = new Date().toISOString()
      setSandboxItems((prev) =>
        prev.map((item) =>
          item.id === params.id
            ? {
                ...item,
                status: params.status,
                editor_id: params.editorId ?? item.editor_id ?? 'ed-session',
                editor_display_name:
                  params.editorDisplayName ?? item.editor_display_name ?? 'المحرر الحالي (جلسة محاكاة)',
                editor_note: params.editorNote,
                proposed_data: params.proposedData,
                updated_at: now,
              }
            : item,
        ),
      )
    },
    [],
  )

  const bulkApproveSandboxSubmissions = useCallback(
    (params: {
      ids: string[]
      editorNote: string
      editorId?: string
      editorDisplayName?: string
    }) => {
      const idSet = new Set(params.ids)
      const now = new Date().toISOString()
      setSandboxItems((prev) =>
        prev.map((item) =>
          idSet.has(item.id)
            ? {
                ...item,
                status: 'accepted',
                editor_id: params.editorId ?? item.editor_id ?? 'ed-session',
                editor_display_name:
                  params.editorDisplayName ??
                  item.editor_display_name ??
                  'المحرر الحالي (جلسة محاكاة)',
                editor_note: params.editorNote,
                updated_at: now,
              }
            : item,
        ),
      )
    },
    [],
  )

  const resetSandboxQueue = useCallback(() => {
    setSandboxItems(INITIAL_SANDBOX_SUBMISSIONS)
  }, [])

  return {
    sandboxItems,
    addSandboxSubmission,
    moderateSandboxSubmission,
    bulkApproveSandboxSubmissions,
    resetSandboxQueue,
  }
}
