import Ajv from 'ajv'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type { ErrorObject } from 'ajv'

const LEXICON_SCHEMA_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/main/data/schema.json'
const CONTEXT_SCHEMA_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/main/data/context-schema.json'

/**
 * Embedded canonical fallback schemas matching ArCode-Standard/moroccan-darija-dataset
 * (`additionalProperties: false`, required core keys, enums, and ISO date formats)
 * used if offline or GitHub raw endpoints are unreachable.
 */
const FALLBACK_LEXICON_SCHEMA: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['meta', 'categories', 'entries'],
  properties: {
    meta: {
      type: 'object',
      required: ['language', 'version', 'entries_count', 'categories_count'],
      properties: {
        language: { type: 'string', const: 'ary' },
        version: { type: 'string', minLength: 1 },
        entries_count: { type: 'integer', minimum: 0 },
        categories_count: { type: 'integer', minimum: 0 },
        license: { type: 'string' },
      },
      additionalProperties: true,
    },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'count'],
        additionalProperties: false,
        properties: {
          category: { type: 'string', minLength: 1 },
          count: { type: 'integer', minimum: 0 },
        },
      },
    },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'category', 'darija_ar', 'darija_latin', 'fusha_ar', 'fr'],
        additionalProperties: false,
        properties: {
          id: { type: 'integer', minimum: 1 },
          category: { type: 'string', minLength: 1 },
          darija_ar: { type: 'string', minLength: 1 },
          darija_latin: { type: 'string', minLength: 1 },
          fusha_ar: { type: 'string', minLength: 1 },
          fr: { type: 'string', minLength: 1 },
          entry_type: {
            type: 'string',
            enum: [
              'word',
              'expression',
              'sentence',
              'proverb',
              'question',
              'conversational',
              'unknown',
            ],
          },
          region: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
          register: {
            type: 'string',
            enum: [
              'neutral',
              'formal',
              'informal',
              'vulgar',
              'literary',
              'religious',
              'unknown',
            ],
          },
          provenance: {
            type: 'object',
            additionalProperties: false,
            properties: {
              source_type: {
                type: 'string',
                enum: [
                  'original',
                  'contributor',
                  'dictionary',
                  'corpus',
                  'web',
                  'other',
                  'unknown',
                ],
              },
              source_name: { type: 'string' },
              source_url: { type: 'string' },
              accessed_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              contributor_id: { type: 'string' },
              rights_holder: { type: 'string' },
              redistribution_permission: {
                type: 'string',
                enum: ['allowed', 'not_allowed', 'unknown', 'not_applicable'],
              },
              training_permission: {
                type: 'string',
                enum: ['allowed', 'not_allowed', 'unknown', 'not_applicable'],
              },
              commercial_permission: {
                type: 'string',
                enum: ['allowed', 'not_allowed', 'unknown', 'not_applicable'],
              },
              license: { type: 'string' },
              notes: { type: 'string' },
            },
          },
          review: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: {
                type: 'string',
                enum: [
                  'pending',
                  'in_review',
                  'reviewed',
                  'rejected',
                  'needs_correction',
                  'unknown',
                ],
              },
              reviewer_id: { type: 'string' },
              reviewed_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              notes: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

const FALLBACK_CONTEXT_SCHEMA: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['meta', 'examples'],
  properties: {
    meta: {
      type: 'object',
      required: ['lexicon_version', 'version', 'examples_count'],
      properties: {
        lexicon_version: { type: 'string', minLength: 1 },
        version: { type: 'string', minLength: 1 },
        examples_count: { type: 'integer', minimum: 0 },
      },
      additionalProperties: true,
    },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'entry_id',
          'meaning_ar',
          'meaning_fr',
          'example_darija_ar',
          'example_darija_latin',
          'register',
          'provenance',
          'review',
        ],
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^ctx-[0-9]{6}$' },
          entry_id: { type: 'integer', minimum: 1 },
          sense_id: { type: 'string' },
          meaning_ar: { type: 'string', minLength: 1 },
          meaning_fr: { type: 'string', minLength: 1 },
          example_darija_ar: { type: 'string', minLength: 1 },
          example_darija_latin: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
          example_fusha_ar: { type: 'string' },
          example_fr: { type: 'string' },
          region: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
          },
          register: {
            type: 'string',
            enum: [
              'neutral',
              'formal',
              'informal',
              'vulgar',
              'literary',
              'religious',
              'unknown',
            ],
          },
          provenance: {
            type: 'object',
            required: [
              'source_type',
              'redistribution_permission',
              'training_permission',
              'commercial_permission',
            ],
            additionalProperties: false,
            properties: {
              source_type: {
                type: 'string',
                enum: [
                  'original',
                  'contributor',
                  'dictionary',
                  'corpus',
                  'web',
                  'other',
                  'unknown',
                ],
              },
              source_name: { type: 'string' },
              source_url: { type: 'string' },
              accessed_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              rights_holder: { type: 'string' },
              license: { type: 'string' },
              notes: { type: 'string' },
              redistribution_permission: {
                type: 'string',
                enum: ['allowed', 'not_allowed', 'unknown', 'not_applicable'],
              },
              training_permission: {
                type: 'string',
                enum: ['allowed', 'not_allowed', 'unknown', 'not_applicable'],
              },
              commercial_permission: {
                type: 'string',
                enum: ['allowed', 'not_allowed', 'unknown', 'not_applicable'],
              },
            },
          },
          review: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: {
                type: 'string',
                enum: [
                  'pending',
                  'in_review',
                  'reviewed',
                  'rejected',
                  'needs_correction',
                  'unknown',
                ],
              },
              reviewer_id: { type: 'string' },
              reviewed_at: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              notes: { type: 'string' },
            },
          },
        },
      },
    },
  },
}

export interface SchemaValidationReport {
  valid: boolean
  schemaSource: 'official_github' | 'embedded_fallback'
  lexiconErrors: string[]
  examplesErrors: string[]
}

let cachedSchemasPromise: Promise<{
  source: 'official_github' | 'embedded_fallback'
  lexiconSchema: Record<string, unknown>
  contextSchema: Record<string, unknown>
}> | null = null

async function loadOfficialSchemas(): Promise<{
  source: 'official_github' | 'embedded_fallback'
  lexiconSchema: Record<string, unknown>
  contextSchema: Record<string, unknown>
}> {
  if (cachedSchemasPromise) return cachedSchemasPromise

  cachedSchemasPromise = (async () => {
    try {
      const [lexRes, ctxRes] = await Promise.all([
        fetch(LEXICON_SCHEMA_URL),
        fetch(CONTEXT_SCHEMA_URL),
      ])
      if (!lexRes.ok || !ctxRes.ok) {
        throw new Error('Remote schema fetch returned non-OK status')
      }
      const [lexiconSchema, contextSchema] = (await Promise.all([
        lexRes.json(),
        ctxRes.json(),
      ])) as [Record<string, unknown>, Record<string, unknown>]
      return {
        source: 'official_github' as const,
        lexiconSchema,
        contextSchema,
      }
    } catch {
      return {
        source: 'embedded_fallback' as const,
        lexiconSchema: FALLBACK_LEXICON_SCHEMA,
        contextSchema: FALLBACK_CONTEXT_SCHEMA,
      }
    }
  })()

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

  // Strip $schema if an unfamiliar draft URI is present so Ajv never throws on unknown meta-schema
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
  const { source, lexiconSchema, contextSchema } = await loadOfficialSchemas()
  const lexiconErrors = runAjvAgainstSchema(lexiconSchema, lexiconJson)
  const examplesErrors = runAjvAgainstSchema(contextSchema, examplesJson)

  return {
    valid: lexiconErrors.length === 0 && examplesErrors.length === 0,
    schemaSource: source,
    lexiconErrors,
    examplesErrors,
  }
}
