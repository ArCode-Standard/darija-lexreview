import type { LexicalEntry } from '../types/lexicon'
import { formatAccessionCode } from '../services/dataset'
import type { AppPage } from './urlState'

interface PageSeoMeta {
  title: string
  description: string
}

const PAGE_META: Record<AppPage, PageSeoMeta> = {
  home: {
    title: 'Darija LexReview — مراجعة الدارجة المغربية | ArCode Standard',
    description:
      'Darija LexReview من ArCode Standard: مساحة موثوقة لمراجعة مفردات الدارجة المغربية وتوثيق شواهدها قبل اعتمادها.',
  },
  review: {
    title: 'المراجعة السريعة للمفردات | Darija LexReview',
    description:
      'دقّق مفردات الدارجة المغربية وشواهدها ببطاقات سريعة ومتتالية وساهم في ضبط الجودة المعجمية.',
  },
  lexicon: {
    title: 'تصفح المعجم والفئات الدلالية | Darija LexReview',
    description:
      'استكشف مفردات الدارجة المغربية مع النطق اللاتيني والمعاني العربية والفرنسية والشواهد السياقية.',
  },
  insights: {
    title: 'خارطة تغطية المعجم وفجوات الإثراء | Darija LexReview',
    description:
      'استعرض مؤشرات تغطية الشواهد السياقية، التوزيع اللهجي عبر جهات المغرب، وقائمة أولويات إثراء المعجم المفتوح.',
  },
  contributors: {
    title: 'لوحة شرف المساهمين والهيئة العلمية | Darija LexReview',
    description:
      'تعرّف على المساهمين المعتمدين والمحررين المشاركين في توثيق ومراجعة مفردات الدارجة المغربية عبر مختلف جهات المغرب.',
  },
  contribute: {
    title: 'إضافة مفردة أو شاهد جديد | Darija LexReview',
    description:
      'اقترح مفردة دارجة مغربية جديدة أو شاهداً سياقياً موثقاً لإثراء المعجم المفتوح.',
  },
  submissions: {
    title: 'مساهماتي ومسوداتي المحفوظة | Darija LexReview',
    description:
      'تابع حالة مقترحاتك المرسلة وراجع مسوداتك المحلية المحفوظة في متصفحك قبل إرسالها.',
  },
  messages: {
    title: 'صندوق الرسائل والتنبيهات | Darija LexReview',
    description:
      'راجع رسائل الترحيب، تحديثات الصلاحيات، الملاحظات التحريرية، وإعلانات منصة Darija LexReview.',
  },
  profile: {
    title: 'ملفي الشخصي وربط الحسابات | Darija LexReview',
    description:
      'أدر بيانات هويتك المعجمية وأوسمتك العلمية واربط حسابك بـ GitHub وGoogle وتابع سجل مساهماتك المعتمدة.',
  },
  editorial: {
    title: 'تحكيم المحررين وحوكمة الصلاحيات | Darija LexReview',
    description:
      'لوحة التحكيم التحريري لمراجعة مقترحات المجتمع، إدارة الأدوار، وتدقيق التعديلات المعجمية.',
  },
  members: {
    title: 'إدارة الأعضاء والرتب والحوكمة | Darija LexReview',
    description:
      'لوحة المسؤولين والمشرفين لإدارة رتب الأعضاء، الترقية، الإنذارات الرسمية، وضبط نزاهة المجتمع المعجمي.',
  },
  export: {
    title: 'تصدير حزم المعجم الرسمية | Darija LexReview',
    description:
      'توليد وتوقيع حزم التحديث الرسمية للمعجم المغربي المفتوح مع بصمات التحقق SHA-256.',
  },
  auth: {
    title: 'تسجيل الدخول وإنشاء حساب مراجع | Darija LexReview',
    description:
      'سجّل الدخول عبر GitHub أو Google أو البريد الإلكتروني لتوثيق مساهماتك ومزامنة مسوداتك في Darija LexReview.',
  },
}

function setMetaContent(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string,
) {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function syncDefinedTermJsonLd(entry: LexicalEntry | null, canonicalUrl: string) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const scriptId = 'dynamic-entry-definedterm-jsonld'
  const existing = document.getElementById(scriptId)

  if (!entry) {
    if (existing) existing.remove()
    return
  }

  const accessionCode = formatAccessionCode(entry.id, entry.numericId)
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': canonicalUrl,
    name: entry.word,
    alternateName: entry.latin ? [entry.latin] : undefined,
    termCode: accessionCode,
    description: `${entry.meaning}${entry.french ? ` — ${entry.french}` : ''}`,
    inLanguage: 'ary',
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Moroccan Darija Lexicon — ArCode Standard',
      url: `${window.location.origin}/lexicon`,
    },
  }

  let scriptEl = existing as HTMLScriptElement | null
  if (!scriptEl) {
    scriptEl = document.createElement('script')
    scriptEl.id = scriptId
    scriptEl.type = 'application/ld+json'
    document.head.appendChild(scriptEl)
  }
  scriptEl.textContent = JSON.stringify(payload)
}

export function syncPageSeo(params: {
  page: AppPage
  explorerSubView?: 'entries' | 'categories'
  activeEntry?: LexicalEntry | null
  hasExplicitEntryInPath?: boolean
}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  let { title, description } = PAGE_META[params.page] ?? PAGE_META.home
  const isDedicatedWordPage =
    params.page === 'lexicon' &&
    params.explorerSubView !== 'categories' &&
    Boolean(params.hasExplicitEntryInPath && params.activeEntry)

  if (params.page === 'lexicon') {
    if (params.explorerSubView === 'categories') {
      title = 'الفئات الدلالية للمعجم المغربي | Darija LexReview'
      description =
        'استعرض توزيع مفردات الدارجة المغربية عبر الفئات الدلالية والحقول المعجمية المختلفة.'
    } else if (isDedicatedWordPage && params.activeEntry) {
      const e = params.activeEntry
      const latinPart = e.latin ? ` (${e.latin})` : ''
      title = `${e.word}${latinPart} — معنى وشواهد في الدارجة المغربية | Darija LexReview`
      description = `معنى «${e.word}» في الدارجة المغربية: ${e.meaning}${e.french ? ` · بالفرنسية: ${e.french}` : ''}. استعرض الشواهد وساهم في تدقيق المفردة.`
    }
  }

  document.title = title
  setMetaContent('meta[name="description"]', 'name', 'description', description)
  setMetaContent('meta[property="og:title"]', 'property', 'og:title', title)
  setMetaContent('meta[property="og:description"]', 'property', 'og:description', description)
  setMetaContent('meta[name="twitter:title"]', 'name', 'twitter:title', title)
  setMetaContent('meta[name="twitter:description"]', 'name', 'twitter:description', description)

  const canonicalUrl = `${window.location.origin}${window.location.pathname}`
  setMetaContent('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)

  let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!canonicalLink) {
    canonicalLink = document.createElement('link')
    canonicalLink.setAttribute('rel', 'canonical')
    document.head.appendChild(canonicalLink)
  }
  canonicalLink.setAttribute('href', canonicalUrl)

  syncDefinedTermJsonLd(isDedicatedWordPage ? (params.activeEntry ?? null) : null, canonicalUrl)
}
