import { useCallback, useEffect, useState } from 'react'
import type {
  EvidenceItem,
  ProposedFields,
  ReviewDecisionEvent,
  SubmissionRecord,
  SubmissionStatus,
} from '../types/lexicon'

const SANDBOX_STORAGE_KEY = 'arcode_darija_lexreview_sandbox_queue_v3'
const SANDBOX_EVENTS_STORAGE_KEY = 'arcode_darija_lexreview_sandbox_events_v1'

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
      rights_confirmed: true,
      rights_holder: 'contributor',
      license: 'CC BY-NC 4.0',
      redistribution_permission: 'allowed',
      training_permission: 'not_allowed',
      commercial_permission: 'not_allowed',
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
      rights_holder: 'contributor',
      license: 'CC BY-NC 4.0',
      redistribution_permission: 'allowed',
      training_permission: 'not_allowed',
      commercial_permission: 'not_allowed',
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
      rights_confirmed: true,
      rights_holder: 'contributor',
      license: 'CC BY-NC 4.0',
      redistribution_permission: 'allowed',
      training_permission: 'not_allowed',
      commercial_permission: 'not_allowed',
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
      rights_holder: 'contributor',
      license: 'CC BY-NC 4.0',
      redistribution_permission: 'allowed',
      training_permission: 'not_allowed',
      commercial_permission: 'not_allowed',
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
      rights_confirmed: true,
      rights_holder: 'contributor',
      license: 'CC BY-NC 4.0',
      redistribution_permission: 'allowed',
      training_permission: 'not_allowed',
      commercial_permission: 'not_allowed',
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

function buildSeedEvents(items: SubmissionRecord[]): ReviewDecisionEvent[] {
  const seeded: ReviewDecisionEvent[] = []
  for (const sub of items) {
    seeded.push({
      id: `ev-sub-${sub.id}`,
      submission_id: sub.id,
      actor_id: sub.reviewer_id ?? 'contributor-sandbox',
      actor_display_name: 'مراجع مساهم (محاكاة)',
      event_type: 'submitted',
      previous_status: null,
      new_status: 'pending',
      editor_note: null,
      occurred_at: sub.created_at,
    })
    if (sub.status !== 'pending') {
      seeded.push({
        id: `ev-dec-${sub.id}`,
        submission_id: sub.id,
        actor_id: sub.editor_id ?? 'ed-sandbox',
        actor_display_name: sub.editor_display_name ?? 'محرر معتمد',
        event_type: 'decision',
        previous_status: 'pending',
        new_status: sub.status,
        editor_note: sub.editor_note,
        occurred_at: sub.updated_at,
      })
    }
  }
  return seeded
}

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

  const [sandboxEvents, setSandboxEvents] = useState<ReviewDecisionEvent[]>(() => {
    try {
      const raw = localStorage.getItem(SANDBOX_EVENTS_STORAGE_KEY)
      if (!raw) return buildSeedEvents(INITIAL_SANDBOX_SUBMISSIONS)
      const parsed = JSON.parse(raw) as ReviewDecisionEvent[]
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : buildSeedEvents(INITIAL_SANDBOX_SUBMISSIONS)
    } catch {
      return buildSeedEvents(INITIAL_SANDBOX_SUBMISSIONS)
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxItems))
    } catch {
      // Ignore storage quota errors
    }
  }, [sandboxItems])

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_EVENTS_STORAGE_KEY, JSON.stringify(sandboxEvents))
    } catch {
      // Ignore storage quota errors
    }
  }, [sandboxEvents])

  const addSandboxSubmission = useCallback(
    (params: {
      entryId: string
      proposedData: ProposedFields
      evidence: EvidenceItem[]
      reviewerNote: string | null
      supersedesId?: string | null
    }) => {
      const now = new Date().toISOString()
      const item: SubmissionRecord = {
        id: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entry_id: params.entryId,
        supersedes_id: params.supersedesId ?? null,
        proposed_data: params.proposedData,
        evidence: params.evidence,
        reviewer_note: params.reviewerNote,
        status: 'pending',
        editor_note: null,
        created_at: now,
        updated_at: now,
        is_sandbox: true,
      }
      setSandboxItems((prev) => {
        const updatedPrev = params.supersedesId
          ? prev.map((existing) => {
              if (
                existing.id === params.supersedesId &&
                (existing.status === 'pending' ||
                  existing.status === 'needs_changes' ||
                  existing.status === 'rejected')
              ) {
                setSandboxEvents((evPrev) => [
                  ...evPrev,
                  {
                    id: `ev-sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    submission_id: existing.id,
                    actor_id: 'contributor-session',
                    actor_display_name: 'المراجع الحالي (جلسة محاكاة)',
                    event_type: 'superseded',
                    previous_status: existing.status,
                    new_status: 'superseded',
                    editor_note: `حُلّ محل هذا المقترح بالنسخة المنقحة (${item.id.slice(0, 12)})`,
                    occurred_at: now,
                  },
                ])
                return {
                  ...existing,
                  status: 'superseded' as const,
                  updated_at: now,
                }
              }
              return existing
            })
          : prev
        return [item, ...updatedPrev]
      })
      setSandboxEvents((prev) => [
        ...prev,
        {
          id: `ev-sub-${item.id}`,
          submission_id: item.id,
          actor_id: 'contributor-session',
          actor_display_name: 'المراجع الحالي (جلسة محاكاة)',
          event_type: 'submitted',
          previous_status: null,
          new_status: 'pending',
          editor_note: params.supersedesId
            ? `نسخة منقحة تحل محل المقترح (${params.supersedesId.slice(0, 12)})`
            : null,
          occurred_at: now,
        },
      ])
      return item
    },
    [],
  )

  const withdrawSandboxSubmission = useCallback((id: string) => {
    const now = new Date().toISOString()
    setSandboxItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (!target || target.status !== 'pending') return prev
      setSandboxEvents((evPrev) => [
        ...evPrev,
        {
          id: `ev-wdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          submission_id: id,
          actor_id: 'contributor-session',
          actor_display_name: 'المراجع الحالي (جلسة محاكاة)',
          event_type: 'withdrawn',
          previous_status: 'pending',
          new_status: 'withdrawn',
          editor_note: 'سحب المساهم مقترحه قبل صدور قرار تحكيمي.',
          occurred_at: now,
        },
      ])
      return prev.map((item) =>
        item.id === id && item.status === 'pending'
          ? {
              ...item,
              status: 'withdrawn',
              updated_at: now,
            }
          : item,
      )
    })
  }, [])

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
      setSandboxItems((prev) => {
        const current = prev.find((i) => i.id === params.id)
        if (current) {
          setSandboxEvents((evPrev) => [
            ...evPrev,
            {
              id: `ev-dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              submission_id: params.id,
              actor_id: params.editorId ?? current.editor_id ?? 'ed-session',
              actor_display_name:
                params.editorDisplayName ??
                current.editor_display_name ??
                'المحرر الحالي (جلسة محاكاة)',
              event_type: 'decision',
              previous_status: current.status,
              new_status: params.status,
              editor_note: params.editorNote,
              occurred_at: now,
            },
          ])
        }
        return prev.map((item) =>
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
        )
      })
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
      setSandboxItems((prev) => {
        const newDecisionEvents: ReviewDecisionEvent[] = prev
          .filter((item) => idSet.has(item.id))
          .map((item, idx) => ({
            id: `ev-bulk-${Date.now()}-${idx}`,
            submission_id: item.id,
            actor_id: params.editorId ?? item.editor_id ?? 'ed-session',
            actor_display_name:
              params.editorDisplayName ??
              item.editor_display_name ??
              'المحرر الحالي (جلسة محاكاة)',
            event_type: 'decision',
            previous_status: item.status,
            new_status: 'accepted',
            editor_note: params.editorNote,
            occurred_at: now,
          }))
        if (newDecisionEvents.length > 0) {
          setSandboxEvents((evPrev) => [...evPrev, ...newDecisionEvents])
        }
        return prev.map((item) =>
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
        )
      })
    },
    [],
  )

  const markSandboxSubmissionsMerged = useCallback(
    (params: {
      ids: string[]
      releaseVersion: string
      editorId?: string
      editorDisplayName?: string
    }) => {
      const idSet = new Set(params.ids)
      const now = new Date().toISOString()
      const cleanVersion = params.releaseVersion.trim() || '1.5.1'

      setSandboxItems((prev) => {
        const newDecisionEvents: ReviewDecisionEvent[] = prev
          .filter((item) => idSet.has(item.id) && item.status === 'accepted')
          .map((item, idx) => ({
            id: `ev-merge-${Date.now()}-${idx}`,
            submission_id: item.id,
            actor_id: params.editorId ?? item.editor_id ?? 'ed-session',
            actor_display_name:
              params.editorDisplayName ??
              item.editor_display_name ??
              'المحرر الحالي',
            event_type: 'decision',
            previous_status: 'accepted',
            new_status: 'merged',
            editor_note: `تم الدمج والأرشفة ضمن حزمة الإصدار v${cleanVersion.replace(/^v/i, '')}`,
            occurred_at: now,
          }))
        if (newDecisionEvents.length > 0) {
          setSandboxEvents((evPrev) => [...evPrev, ...newDecisionEvents])
        }
        return prev.map((item) =>
          idSet.has(item.id) && item.status === 'accepted'
            ? {
                ...item,
                status: 'merged',
                exported_in_version: cleanVersion.replace(/^v/i, ''),
                exported_at: now,
                updated_at: now,
              }
            : item,
        )
      })
    },
    [],
  )

  const resetSandboxQueue = useCallback(() => {
    setSandboxItems(INITIAL_SANDBOX_SUBMISSIONS)
    setSandboxEvents(buildSeedEvents(INITIAL_SANDBOX_SUBMISSIONS))
  }, [])

  return {
    sandboxItems,
    sandboxEvents,
    addSandboxSubmission,
    withdrawSandboxSubmission,
    moderateSandboxSubmission,
    bulkApproveSandboxSubmissions,
    markSandboxSubmissionsMerged,
    resetSandboxQueue,
  }
}
