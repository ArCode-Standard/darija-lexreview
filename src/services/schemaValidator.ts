import Ajv from 'ajv'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'

const LEXICON_SCHEMA_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/main/data/schema.json'
const CONTEXT_SCHEMA_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/main/data/context-schema.json'

export interface SchemaValidationReport {
  valid: boolean
  schemaSource: 'official_github' | 'unavailable'
  lexiconErrors: string[]
  examplesErrors: string[]
}

let cachedSchemasPromise: Promise<{
  lexiconSchema: Record<string, unknown>
  contextSchema: Record<string, unknown>
}> | null = null

async function loadOfficialSchemas(): Promise<{
  lexiconSchema: Record<string, unknown>
  contextSchema: Record<string, unknown>
}> {
  if (cachedSchemasPromise) return cachedSchemasPromise

  cachedSchemasPromise = (async () => {
    const [lexRes, ctxRes] = await Promise.all([
      fetch(LEXICON_SCHEMA_URL, { cache: 'no-store' }),
      fetch(CONTEXT_SCHEMA_URL, { cache: 'no-store' }),
    ])
    if (!lexRes.ok || !ctxRes.ok) {
      throw new Error('تعذر تحميل المخططين الرسميين من مستودع المعجم.')
    }
    const [lexiconSchema, contextSchema] = (await Promise.all([
      lexRes.json(),
      ctxRes.json(),
    ])) as [Record<string, unknown>, Record<string, unknown>]
    if (!lexiconSchema || !contextSchema || typeof lexiconSchema !== 'object' || typeof contextSchema !== 'object') {
      throw new Error('استجابة المخططات الرسمية ليست JSON Schema صالحاً.')
    }
    return { lexiconSchema, contextSchema }
  })().catch((error) => {
    cachedSchemasPromise = null
    throw error
  })

  return cachedSchemasPromise
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return []
  return errors.slice(0, 15).map((err) => {
    const path = err.instancePath || '/'
    const extra =
      err.keyword === 'additionalProperties' &&
      err.params &&
      typeof (err.params as Record<string, unknown>).additionalProperty === 'string'
        ? ` (${String((err.params as Record<string, unknown>).additionalProperty)})`
        : ''
    return `${path}: ${err.message ?? 'خطأ مخطط'}${extra}`
  })
}

function runAjvAgainstSchema(
  schema: Record<string, unknown>,
  payload: unknown,
): string[] {
  const schemaUri = String(schema.$schema ?? '')
  const ajvInstance = schemaUri.includes('2020-12')
    ? new Ajv2020({ allErrors: true, strict: false })
    : new Ajv({ allErrors: true, strict: false })

  addFormats(ajvInstance)

  const sanitizedSchema = { ...schema }
  if (
    schemaUri &&
    !schemaUri.includes('2020-12') &&
    !schemaUri.includes('draft-07')
  ) {
    delete sanitizedSchema.$schema
  }

  const validate = ajvInstance.compile(sanitizedSchema)
  const ok = validate(payload)
  return ok ? [] : formatAjvErrors(validate.errors)
}

export async function validateExportBundleWithOfficialSchemas(
  lexiconJson: unknown,
  examplesJson: unknown,
): Promise<SchemaValidationReport> {
  try {
    const { lexiconSchema, contextSchema } = await loadOfficialSchemas()
    const lexiconErrors = runAjvAgainstSchema(lexiconSchema, lexiconJson)
    const examplesErrors = runAjvAgainstSchema(contextSchema, examplesJson)

    return {
      valid: lexiconErrors.length === 0 && examplesErrors.length === 0,
      schemaSource: 'official_github',
      lexiconErrors,
      examplesErrors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذر تحميل المخططات الرسمية.'
    return {
      valid: false,
      schemaSource: 'unavailable',
      lexiconErrors: [message],
      examplesErrors: [message],
    }
  }
}
