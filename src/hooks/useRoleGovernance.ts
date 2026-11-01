import { useCallback, useEffect, useState } from 'react'
import type {
  PromotionRequestStatus,
  ReviewerProfile,
  RolePromotionRequest,
  UserRole,
} from '../types/lexicon'

const PROFILES_SANDBOX_KEY = 'arcode_darija_lexreview_sandbox_profiles_v1'
const PROMO_SANDBOX_KEY = 'arcode_darija_lexreview_sandbox_promotions_v1'

const INITIAL_SANDBOX_PROFILES: ReviewerProfile[] = [
  {
    id: 'usr-admin-01',
    display_name: 'د. عبد الإله بناني',
    dialect_region: 'فاس ومكناس',
    specialty: 'اللسانيات الحاسوبية والمعاجم',
    github_handle: 'abennani-nlp',
    role: 'admin',
    created_at: '2026-09-10T09:00:00.000Z',
  },
  {
    id: 'ed-salma',
    display_name: 'د. سلمى العمراني',
    dialect_region: 'الرباط وسلا',
    specialty: 'علم الدلالة والترجمة المعجمية',
    github_handle: 'salma-elamrani',
    role: 'editor',
    created_at: '2026-09-18T11:30:00.000Z',
  },
  {
    id: 'ed-youssef',
    display_name: 'أ. يوسف التازي',
    dialect_region: 'الدار البيضاء والوسط',
    specialty: 'معالجة اللغات الطبيعية (Darija NLP)',
    github_handle: 'ytazi-dev',
    role: 'editor',
    created_at: '2026-09-25T14:15:00.000Z',
  },
  {
    id: 'rev-amina-04',
    display_name: 'أمينة الشاوي',
    dialect_region: 'الشمال وجبالة',
    specialty: 'الترجمة التحريرية (عربي / فرنسي)',
    github_handle: 'amina-chaoui',
    role: 'reviewer',
    created_at: '2026-10-12T10:20:00.000Z',
  },
  {
    id: 'rev-hamza-05',
    display_name: 'حمزة أيت باها',
    dialect_region: 'سوس والجنوب',
    specialty: 'توثيق التراث الشفهي والتعابير الجهوية',
    github_handle: 'hamza-aitbaha',
    role: 'reviewer',
    created_at: '2026-10-19T16:45:00.000Z',
  },
]

const INITIAL_SANDBOX_PROMOTIONS: RolePromotionRequest[] = [
  {
    id: 'promo-sandbox-001',
    requester_id: 'rev-amina-04',
    requester_name: 'أمينة الشاوي',
    dialect_region: 'الشمال وجبالة',
    experience_summary:
      'مترجمة وباحثة في التنوع اللهجي بشمال المغرب، ساهمت في تدقيق المقابلات الفرنسية والفصحى لأكثر من 35 مدخلاً معجمياً مع توثيق شواهد سياقية مضبوطة بـ Arabizi.',
    sample_links: 'https://github.com/ArCode-Standard/moroccan-darija-dataset',
    requested_role: 'editor',
    status: 'pending',
    reviewed_by: null,
    reviewed_by_name: null,
    admin_note: null,
    created_at: '2026-10-30T13:10:00.000Z',
    updated_at: '2026-10-30T13:10:00.000Z',
    is_sandbox: true,
  },
  {
    id: 'promo-sandbox-002',
    requester_id: 'rev-hamza-05',
    requester_name: 'حمزة أيت باها',
    dialect_region: 'سوس والجنوب',
    experience_summary:
      'مهتم برصد الأمثال والتعابير المتداولة في جهة سوس ماسة ومقارنتها بالاستعمال المشترك العام وفق معايير الضبط الصوتي للدارجة.',
    sample_links: 'https://github.com/ArCode-Standard',
    requested_role: 'editor',
    status: 'pending',
    reviewed_by: null,
    reviewed_by_name: null,
    admin_note: null,
    created_at: '2026-10-31T17:40:00.000Z',
    updated_at: '2026-10-31T17:40:00.000Z',
    is_sandbox: true,
  },
]

export function useRoleGovernance() {
  const [sandboxProfiles, setSandboxProfiles] = useState<ReviewerProfile[]>(() => {
    try {
      const raw = localStorage.getItem(PROFILES_SANDBOX_KEY)
      if (!raw) return INITIAL_SANDBOX_PROFILES
      const parsed = JSON.parse(raw) as ReviewerProfile[]
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SANDBOX_PROFILES
    } catch {
      return INITIAL_SANDBOX_PROFILES
    }
  })

  const [sandboxPromotionRequests, setSandboxPromotionRequests] = useState<RolePromotionRequest[]>(
    () => {
      try {
        const raw = localStorage.getItem(PROMO_SANDBOX_KEY)
        if (!raw) return INITIAL_SANDBOX_PROMOTIONS
        const parsed = JSON.parse(raw) as RolePromotionRequest[]
        return Array.isArray(parsed) ? parsed : INITIAL_SANDBOX_PROMOTIONS
      } catch {
        return INITIAL_SANDBOX_PROMOTIONS
      }
    },
  )

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_SANDBOX_KEY, JSON.stringify(sandboxProfiles))
    } catch {
      // Ignore quota errors
    }
  }, [sandboxProfiles])

  useEffect(() => {
    try {
      localStorage.setItem(PROMO_SANDBOX_KEY, JSON.stringify(sandboxPromotionRequests))
    } catch {
      // Ignore quota errors
    }
  }, [sandboxPromotionRequests])

  const submitSandboxPromotionRequest = useCallback(
    (params: {
      requesterId: string
      requesterName: string
      dialectRegion: string | null
      experienceSummary: string
      sampleLinks: string | null
    }) => {
      const now = new Date().toISOString()
      const newReq: RolePromotionRequest = {
        id: `promo-sandbox-${Date.now()}`,
        requester_id: params.requesterId,
        requester_name: params.requesterName.trim(),
        dialect_region: params.dialectRegion,
        experience_summary: params.experienceSummary.trim(),
        sample_links: params.sampleLinks?.trim() || null,
        requested_role: 'editor',
        status: 'pending',
        reviewed_by: null,
        reviewed_by_name: null,
        admin_note: null,
        created_at: now,
        updated_at: now,
        is_sandbox: true,
      }

      setSandboxProfiles((prev) => {
        if (prev.some((p) => p.id === params.requesterId)) return prev
        return [
          ...prev,
          {
            id: params.requesterId,
            display_name: params.requesterName.trim(),
            dialect_region: params.dialectRegion,
            role: 'reviewer',
            created_at: now,
          },
        ]
      })

      setSandboxPromotionRequests((prev) => [
        newReq,
        ...prev.filter((r) => !(r.requester_id === params.requesterId && r.status === 'pending')),
      ])
      return newReq
    },
    [],
  )

  const reviewSandboxPromotionRequest = useCallback(
    (params: {
      requestId: string
      decision: Exclude<PromotionRequestStatus, 'pending'>
      adminNote: string | null
      adminId?: string
      adminName?: string
    }) => {
      const now = new Date().toISOString()
      let targetRequesterId: string | null = null

      setSandboxPromotionRequests((prev) =>
        prev.map((req) => {
          if (req.id !== params.requestId) return req
          targetRequesterId = req.requester_id
          return {
            ...req,
            status: params.decision,
            reviewed_by: params.adminId ?? 'usr-admin-01',
            reviewed_by_name: params.adminName ?? 'المشرف العام (محاكاة)',
            admin_note: params.adminNote?.trim() || null,
            updated_at: now,
          }
        }),
      )

      if (params.decision === 'approved') {
        setSandboxProfiles((prev) =>
          prev.map((prof) => {
            const matchedReq = sandboxPromotionRequests.find((r) => r.id === params.requestId)
            const reqUserId = targetRequesterId ?? matchedReq?.requester_id
            if (prof.id === reqUserId && prof.role === 'reviewer') {
              return { ...prof, role: 'editor' }
            }
            return prof
          }),
        )
      }
    },
    [sandboxPromotionRequests],
  )

  const updateSandboxMemberRole = useCallback((userId: string, nextRole: UserRole) => {
    setSandboxProfiles((prev) =>
      prev.map((prof) => (prof.id === userId ? { ...prof, role: nextRole } : prof)),
    )
  }, [])

  const resetSandboxGovernance = useCallback(() => {
    setSandboxProfiles(INITIAL_SANDBOX_PROFILES)
    setSandboxPromotionRequests(INITIAL_SANDBOX_PROMOTIONS)
  }, [])

  return {
    sandboxProfiles,
    sandboxPromotionRequests,
    submitSandboxPromotionRequest,
    reviewSandboxPromotionRequest,
    updateSandboxMemberRole,
    resetSandboxGovernance,
  }
}
