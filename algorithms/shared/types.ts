export type Script = 'arabic' | 'latin' | 'mixed' | 'unknown'

export interface TextAnalysis {
  original: string
  normalized: string
  tokens: string[]
  script: Script
  characterCount: number
  tokenCount: number
}

export interface AlgorithmSignal {
  code: string
  severity: 'info' | 'warning' | 'review'
  message: string
  evidence?: string[]
}

export interface ScoredResult {
  score: number
  signals: AlgorithmSignal[]
}
