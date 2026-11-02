import type { LexicalEntry } from '../types/lexicon'

export interface PhoneticCueToken {
  symbol: string
  arabicSound: string
  exampleNote: string
}

export interface HomographSiblingHint {
  latin: string
  meaningAr: string
  categoryLabel?: string
}

export interface DarijaPhoneticAnalysis {
  phoneticCues: PhoneticCueToken[]
  homographNotice: {
    currentReading: string
    contrastReadings: HomographSiblingHint[]
  } | null
}

interface CuratedHomographReading {
  latinPattern: RegExp
  latinDisplay: string
  meaningAr: string
}

/**
 * Curated high-frequency Moroccan Darija homographs that share identical unvocalized
 * Arabic spelling (`قرعة`, `برد`, `عين`, `سوق`, `شعر`, `قراية`, `عمر`, `دم`, `فاس`).
 */
const CURATED_DARIJA_HOMOGRAPHS: Record<string, CuratedHomographReading[]> = {
  قرعة: [
    {
      latinPattern: /^9r3a/i,
      latinDisplay: '9r3a (بالقاف)',
      meaningAr: 'قنينة / زجاجة ماء أو عصير',
    },
    {
      latinPattern: /^gr3a/i,
      latinDisplay: 'gr3a (بالگاف المعقودة)',
      meaningAr: 'يقطين / كوسى (خضار القرع)',
    },
  ],
  برد: [
    {
      latinPattern: /^brd|^berd/i,
      latinDisplay: 'berd (بفتح فسكون)',
      meaningAr: 'برودة الطقس والهواء',
    },
    {
      latinPattern: /^mbrd|^bared/i,
      latinDisplay: 'bared',
      meaningAr: 'بارد الحرارة أو هادئ الطبع',
    },
  ],
  عين: [
    {
      latinPattern: /^3in|^3ayn/i,
      latinDisplay: '3in',
      meaningAr: 'عضو الإبصار أو نبع الماء حسب السياق',
    },
  ],
  سوق: [
    {
      latinPattern: /^sou9|^su9|^sw9/i,
      latinDisplay: 'sou9 (بالقاف)',
      meaningAr: 'مكان البيع والشراء أو شأن يخص المرء',
    },
    {
      latinPattern: /^sog|^soug/i,
      latinDisplay: 'soug (بالگاف)',
      meaningAr: 'قيادة السيارة أو المركبة',
    },
  ],
  قراية: [
    {
      latinPattern: /^9raya/i,
      latinDisplay: '9raya (بالقاف)',
      meaningAr: 'الدراسة والتعلّم والقراءة',
    },
  ],
  شعر: [
    {
      latinPattern: /^ch3r|^sh3r|^cha3r/i,
      latinDisplay: 'ch3er',
      meaningAr: 'شَعْر الرأس (بسكون العين بالدارجة) أو الشِّعْر الأدبي',
    },
  ],
  عمر: [
    {
      latinPattern: /^3mr|^3mer/i,
      latinDisplay: '3mer / 3emmer',
      meaningAr: 'العُمْر والسن، أو فعل التعمير والملء',
    },
  ],
  دم: [
    {
      latinPattern: /^dm|^dem/i,
      latinDisplay: 'dem',
      meaningAr: 'الدَّم',
    },
  ],
  فاس: [
    {
      latinPattern: /^fas/i,
      latinDisplay: 'fas',
      meaningAr: 'أداة الحفر (الفأس) أو مدينة فاس العريقة',
    },
  ],
}

/**
 * Extracts key Moroccan Arabizi phonetic cues present in `entry.latin` so contributors
 * never confuse `9` (ق) with `g` (گ), or `3` (ع) with `7` (ح).
 */
export function extractPhoneticCues(latin: string): PhoneticCueToken[] {
  const clean = (latin || '').toLowerCase()
  if (!clean) return []

  const cues: PhoneticCueToken[] = []

  if (clean.includes('gh')) {
    cues.push({ symbol: 'gh', arabicSound: 'غ', exampleNote: 'غين' })
  } else if (clean.includes('g')) {
    cues.push({ symbol: 'g', arabicSound: 'گ', exampleNote: 'گاف معقودة (مثل: گال)' })
  }

  if (clean.includes('9') || clean.includes('q')) {
    cues.push({
      symbol: clean.includes('9') ? '9' : 'q',
      arabicSound: 'ق',
      exampleNote: 'قاف خالصة',
    })
  }

  if (clean.includes('7')) {
    cues.push({ symbol: '7', arabicSound: 'ح', exampleNote: 'حاء' })
  }

  if (clean.includes('3')) {
    cues.push({ symbol: '3', arabicSound: 'ع', exampleNote: 'عين' })
  }

  if (clean.includes('kh') || clean.includes('5')) {
    cues.push({
      symbol: clean.includes('kh') ? 'kh' : '5',
      arabicSound: 'خ',
      exampleNote: 'خاء',
    })
  }

  if (clean.includes('ch') || clean.includes('sh')) {
    cues.push({
      symbol: clean.includes('ch') ? 'ch' : 'sh',
      arabicSound: 'ش',
      exampleNote: 'شين',
    })
  }

  return cues.slice(0, 4)
}

/**
 * Analyzes an entry against the full loaded corpus and curated Moroccan homographs
 * to warn reviewers when an unvocalized Arabic word has multiple pronunciations/meanings.
 */
export function analyzeDarijaPhoneticsAndHomographs(
  entry: Pick<LexicalEntry, 'word' | 'latin' | 'meaning' | 'category'>,
  allEntries: LexicalEntry[] = [],
): DarijaPhoneticAnalysis {
  const phoneticCues = extractPhoneticCues(entry.latin)
  const trimmedWord = (entry.word || '').trim()
  const normalizedLatin = (entry.latin || '').trim().toLowerCase()

  const contrastReadings: HomographSiblingHint[] = []

  // 1. Check live corpus siblings that share the exact Arabic spelling but differ in latin or meaning
  for (const candidate of allEntries) {
    if (candidate.word.trim() !== trimmedWord) continue
    const sameCategoryAndMeaning =
      candidate.category === entry.category &&
      candidate.meaning.trim() === entry.meaning.trim() &&
      candidate.latin.trim().toLowerCase() === normalizedLatin
    if (sameCategoryAndMeaning) continue

    if (
      !contrastReadings.some(
        (r) =>
          r.latin.toLowerCase() === candidate.latin.trim().toLowerCase() &&
          r.meaningAr === candidate.meaning.trim(),
      )
    ) {
      contrastReadings.push({
        latin: candidate.latin.trim(),
        meaningAr: candidate.meaning.trim(),
        categoryLabel: candidate.category,
      })
    }
  }

  // 2. Enrich with curated Moroccan Darija homograph pairs (e.g. قرعة: 9r3a vs gr3a)
  const curatedList = CURATED_DARIJA_HOMOGRAPHS[trimmedWord]
  if (curatedList && curatedList.length > 0) {
    for (const item of curatedList) {
      if (!item.latinPattern.test(normalizedLatin) && curatedList.length > 1) {
        if (!contrastReadings.some((r) => r.meaningAr === item.meaningAr)) {
          contrastReadings.push({
            latin: item.latinDisplay,
            meaningAr: item.meaningAr,
          })
        }
      } else if (curatedList.length === 1 && contrastReadings.length === 0) {
        contrastReadings.push({
          latin: item.latinDisplay,
          meaningAr: item.meaningAr,
        })
      }
    }
  }

  return {
    phoneticCues,
    homographNotice:
      contrastReadings.length > 0
        ? {
            currentReading: `${entry.latin} — ${entry.meaning}`,
            contrastReadings: contrastReadings.slice(0, 2),
          }
        : null,
  }
}
