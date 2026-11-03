import { normalizeForComparison } from '../shared/normalize'

export interface ContextExample {
  id: string
  text: string
  translation?: string
  region?: string
  register?: string
}

export interface ContextAnalysis {
  exampleCount: number
  distinctRegions: string[]
  distinctRegisters: string[]
  missingTranslations: string[]
  repeatedTexts: string[]
  possibleSenseGroups: Array<{ key: string; exampleIds: string[] }>
}

/** Diagnostics only. Shared translations are candidate sense groups for human review. */
export function analyzeLexicalContexts(examples: ContextExample[]): ContextAnalysis {
  if (!Array.isArray(examples)) throw new TypeError('examples must be an array')
  const translations = new Map<string, string[]>()
  const textCounts = new Map<string, number>()
  const regions = new Set<string>()
  const registers = new Set<string>()
  const missingTranslations: string[] = []

  for (const example of examples) {
    if (!example.id.trim() || typeof example.text !== 'string') {
      throw new TypeError('Each context example requires an ID and text')
    }
    const translation = normalizeForComparison(example.translation ?? '')
    if (translation) translations.set(translation, [...(translations.get(translation) ?? []), example.id])
    else missingTranslations.push(example.id)

    const text = normalizeForComparison(example.text)
    if (text) textCounts.set(text, (textCounts.get(text) ?? 0) + 1)
    if (example.region?.trim()) regions.add(example.region.trim())
    if (example.register?.trim()) registers.add(example.register.trim())
  }

  return {
    exampleCount: examples.length,
    distinctRegions: [...regions].sort(),
    distinctRegisters: [...registers].sort(),
    missingTranslations: missingTranslations.sort(),
    repeatedTexts: [...textCounts].filter(([, count]) => count > 1).map(([text]) => text).sort(),
    possibleSenseGroups: [...translations]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, exampleIds]) => ({ key, exampleIds: [...new Set(exampleIds)].sort() }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  }
}
