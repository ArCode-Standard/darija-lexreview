import { afterEach, describe, expect, it, vi } from 'vitest'
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules()})
describe('official JSON Schema export gate',()=>{
  it('accepts valid payloads and reports invalid field paths',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('context-schema')
      ? {$schema:'http://json-schema.org/draft-07/schema#',type:'object',required:['examples'],properties:{examples:{type:'array'}}}
      : {$schema:'http://json-schema.org/draft-07/schema#',type:'object',required:['entries'],properties:{entries:{type:'array'}}}})))
    const {validateExportBundleWithOfficialSchemas}=await import('../src/services/schemaValidator')
    const valid=await validateExportBundleWithOfficialSchemas({entries:[]},{examples:[]})
    expect(valid.valid).toBe(true);expect(valid.schemaSource).toBe('official_github')
    const invalid=await validateExportBundleWithOfficialSchemas({entries:'invalid'},{examples:[]})
    expect(invalid.valid).toBe(false);expect(invalid.lexiconErrors.join(' ')).toContain('/entries')
  })
  it('fails closed when official schemas are unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({})})))
    const {validateExportBundleWithOfficialSchemas}=await import('../src/services/schemaValidator')
    const report=await validateExportBundleWithOfficialSchemas({}, {})
    expect(report.valid).toBe(false);expect(report.schemaSource).toBe('unavailable')
  })
})
