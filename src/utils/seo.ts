import type { LexicalEntry, PublicContributorRecord } from '../types/lexicon'
import { formatAccessionCode } from '../services/dataset'
import { formatEtymologyLabel } from './etymology'
import type { ComputedThematicCollection } from './thematicCollections'
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
      'استكشف مفردات الدارجة المغربية مع النطق اللاتيني والتأصيل اللغوي والمعاني العربية والفرنسية والشواهد السياقية.',
  },
  collections: {
    title: 'المجموعات الموضوعاتية والمعاجم المصغّرة | Darija LexReview',
    description:
      'تصفح معاجم موضوعاتية منسّقة للدارجة المغربية: الأمثال الشعبية، المطبخ المغربي وأتاي، عبارات الترحيب، المعمار، والروافد الأمازيغية والأندلسية.',
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
  embed: {
    title: 'بطاقة مفردة مضمّنة | Darija LexReview',
    description:
      'بطاقة معجمية موثقة من المعجم المغربي المفتوح Darija LexReview قابلة للتضمين الأكاديمي والإعلامي.',
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

export function buildDefinedTermJsonLdPayload(
  entry: LexicalEntry,
  canonicalUrl: string,
  siteOrigin: string,
) {
  const accessionCode = formatAccessionCode(entry.id, entry.numericId)
  const exampleSnippet = entry.examples[0]?.darijaAr
    ? ` — مثال سياقي: «${entry.examples[0].darijaAr}»`
    : ''
  const etymologySnippet =
    entry.etymology && entry.etymology !== 'unspecified'
      ? ` — التأصيل: ${formatEtymologyLabel(entry.etymology)}`
      : ''

  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: entry.word,
    alternateName: entry.latin
      ? entry.latin
          .split('/')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    termCode: accessionCode,
    description: `معنى «${entry.word}» في الدارجة المغربية: ${entry.meaning}${entry.french ? ` (${entry.french})` : ''}${etymologySnippet}${exampleSnippet}`,
    inLanguage: 'ary',
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': `${siteOrigin}/lexicon`,
      name: 'Moroccan Darija Lexicon — ArCode Standard',
      url: `${siteOrigin}/lexicon`,
      inLanguage: ['ary', 'ar', 'fr'],
      license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    },
  }
}

function syncDynamicJsonLd(payload: Record<string, unknown> | null) {
  if (typeof document === 'undefined') return
  const scriptId = 'dynamic-entry-definedterm-jsonld'
  const existing = document.getElementById(scriptId)

  if (!payload) {
    if (existing) existing.remove()
    return
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
  entriesCount?: number
  activeContributor?: PublicContributorRecord | null
  activeCollection?: ComputedThematicCollection | null
}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  let { title, description } = PAGE_META[params.page] ?? PAGE_META.home
  const siteOrigin = window.location.origin
  let canonicalUrl = `${siteOrigin}${window.location.pathname}`

  const isDedicatedWordPage =
    params.page === 'lexicon' &&
    params.explorerSubView !== 'categories' &&
    Boolean(params.hasExplicitEntryInPath && params.activeEntry)

  let jsonLdPayload: Record<string, unknown> | null = null
  let ogType = 'website'

  if (params.page === 'lexicon') {
    if (params.explorerSubView === 'categories') {
      title = 'الفئات الدلالية للمعجم المغربي | Darija LexReview'
      description =
        'استعرض توزيع مفردات الدارجة المغربية عبر الفئات الدلالية والحقول المعجمية المختلفة.'
    } else if (isDedicatedWordPage && params.activeEntry) {
      const e = params.activeEntry
      const latinPart = e.latin ? ` (${e.latin})` : ''
      const exPart = e.examples[0]?.darijaAr ? ` مثال: «${e.examples[0].darijaAr}».` : ''
      title = `معنى «${e.word}»${latinPart} بالدارجة المغربية | Darija LexReview`
      description =
        `معنى كلمة «${e.word}» في الدارجة المغربية: ${e.meaning}${e.french ? ` · بالفرنسية: ${e.french}` : ''}.${exPart} استعرض التأصيل والشواهد.`.slice(
          0,
          165,
        )
      ogType = 'article'
      jsonLdPayload = buildDefinedTermJsonLdPayload(e, canonicalUrl, siteOrigin)
    } else {
      jsonLdPayload = {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': `${siteOrigin}/lexicon`,
        name: 'المعجم المغربي المفتوح — Moroccan Darija Lexicon',
        url: `${siteOrigin}/lexicon`,
        inLanguage: ['ary', 'ar', 'fr'],
        license: 'https://creativecommons.org/licenses/by-nc/4.0/',
        ...(params.entriesCount ? { numberOfItems: params.entriesCount } : {}),
      }
    }
  } else if (params.page === 'collections' && params.activeCollection) {
    const col = params.activeCollection
    title = `${col.title} | Darija LexReview`
    description = `${col.subtitle} — استعرض ${col.entries.length} مفردة وتعبير موثق في المعجم المغربي المفتوح.`.slice(
      0,
      165,
    )
    jsonLdPayload = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': canonicalUrl,
      url: canonicalUrl,
      name: col.title,
      description: col.editorialNote,
      inLanguage: ['ary', 'ar', 'fr'],
      numberOfItems: col.entries.length,
    }
  } else if (params.page === 'embed' && params.activeEntry) {
    const e = params.activeEntry
    title = `«${e.word}» — بطاقة معجمية مضمّنة | Darija LexReview`
    description = `معنى «${e.word}»: ${e.meaning}`.slice(0, 155)
    canonicalUrl = `${siteOrigin}/lexicon/${encodeURIComponent(e.id)}`
    jsonLdPayload = buildDefinedTermJsonLdPayload(e, canonicalUrl, siteOrigin)
  } else if (params.page === 'contributors' && params.activeContributor) {
    const c = params.activeContributor
    const wordsCount = c.documented_words_count ?? c.accepted_count
    const regionLabel = c.dialect_region ? ` (${c.dialect_region})` : ''
    title = `${c.display_name}${regionLabel} — ملف المساهم المعجمي | Darija LexReview`
    description = `البطاقة التعريفية للمساهم الموثق ${c.display_name} في معجم الدارجة المغربية: ساهم في توثيق ${wordsCount} مفردة ومراجعة الشواهد السياقية.`
    ogType = 'profile'
    jsonLdPayload = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': canonicalUrl,
      url: canonicalUrl,
      mainEntity: {
        '@type': 'Person',
        name: c.display_name,
        ...(c.specialty ? { knowsAbout: c.specialty } : {}),
        ...(c.github_handle ? { sameAs: [`https://github.com/${c.github_handle}`] } : {}),
      },
    }
  }

  document.title = title
  setMetaContent('meta[name="description"]', 'name', 'description', description)
  setMetaContent('meta[property="og:type"]', 'property', 'og:type', ogType)
  setMetaContent('meta[property="og:title"]', 'property', 'og:title', title)
  setMetaContent('meta[property="og:description"]', 'property', 'og:description', description)
  setMetaContent('meta[name="twitter:title"]', 'name', 'twitter:title', title)
  setMetaContent('meta[name="twitter:description"]', 'name', 'twitter:description', description)
  setMetaContent('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)

  let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!canonicalLink) {
    canonicalLink = document.createElement('link')
    canonicalLink.setAttribute('rel', 'canonical')
    document.head.appendChild(canonicalLink)
  }
  canonicalLink.setAttribute('href', canonicalUrl)

  syncDynamicJsonLd(jsonLdPayload)
}
