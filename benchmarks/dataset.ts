/**
 * Provisional Moroccan Darija benchmark fixtures.
 * These are hand-curated engineering examples, NOT a representative corpus.
 * Region tags describe intended review coverage, not exclusive geographic usage.
 * Gold equivalence labels are provisional and require validation by native speakers
 * from the tagged regions before linguistic claims are made.
 */
export interface GoldForm {
  id: string
  form: string
  script: 'arabic' | 'arabizi'
  senseId: string
  regionTags: string[]
  expectedArabic?: string
}
export const GOLD_FORMS: GoldForm[] = [
  {id:'what-ar-1',form:'شنو',script:'arabic',senseId:'what',regionTags:['center','north','east']},
  {id:'what-ar-2',form:'اشنو',script:'arabic',senseId:'what',regionTags:['center','north']},
  {id:'what-lat-1',form:'chno',script:'arabizi',senseId:'what',regionTags:['center','north'] ,expectedArabic:'شنو'},
  {id:'what-lat-2',form:'chnou',script:'arabizi',senseId:'what',regionTags:['center','south'],expectedArabic:'شنو'},
  {id:'why-ar-1',form:'علاش',script:'arabic',senseId:'why',regionTags:['center','north','south']},
  {id:'why-lat-1',form:'3lach',script:'arabizi',senseId:'why',regionTags:['center','north'],expectedArabic:'علاش'},
  {id:'how-ar-1',form:'كيفاش',script:'arabic',senseId:'how',regionTags:['center','north','south']},
  {id:'how-lat-1',form:'kifach',script:'arabizi',senseId:'how',regionTags:['center','south'],expectedArabic:'كيفاش'},
  {id:'now-ar-1',form:'دابا',script:'arabic',senseId:'now',regionTags:['center','north']},
  {id:'now-ar-2',form:'دروك',script:'arabic',senseId:'now',regionTags:['east','north']},
  {id:'now-lat-1',form:'daba',script:'arabizi',senseId:'now',regionTags:['center','north'],expectedArabic:'دابا'},
  {id:'want-ar-1',form:'بغيت',script:'arabic',senseId:'want_past_first',regionTags:['center','north','south']},
  {id:'want-lat-1',form:'bghit',script:'arabizi',senseId:'want_past_first',regionTags:['center','south'],expectedArabic:'بغيت'},
  {id:'want-ar-2',form:'باغي',script:'arabic',senseId:'want_desire',regionTags:['center','north','south']},
  {id:'want-lat-2',form:'baghi',script:'arabizi',senseId:'want_desire',regionTags:['center','south'],expectedArabic:'باغي'},
  {id:'good-ar-1',form:'زوين',script:'arabic',senseId:'good_beautiful',regionTags:['center','north']},
  {id:'good-ar-2',form:'مزيان',script:'arabic',senseId:'good_well',regionTags:['center','north','south']},
  {id:'good-lat-1',form:'zwin',script:'arabizi',senseId:'good_beautiful',regionTags:['center','north'],expectedArabic:'زوين'},
  {id:'house-ar-1',form:'دار',script:'arabic',senseId:'house',regionTags:['center','north','south']},
  {id:'house-lat-1',form:'dar',script:'arabizi',senseId:'house',regionTags:['center','south'],expectedArabic:'دار'},
  {id:'a-lot-ar-1',form:'بزاف',script:'arabic',senseId:'a_lot',regionTags:['center','north','south']},
  {id:'a-lot-lat-1',form:'bzaf',script:'arabizi',senseId:'a_lot',regionTags:['center','north'],expectedArabic:'بزاف'},
  {id:'what-doing-ar-1',form:'كتدير',script:'arabic',senseId:'what_are_you_doing',regionTags:['center','north']},
  {id:'what-doing-lat-1',form:'katdir',script:'arabizi',senseId:'what_are_you_doing',regionTags:['center','north'],expectedArabic:'كتدير'},
  {id:'come-ar-1',form:'آجي',script:'arabic',senseId:'come_imperative',regionTags:['center','north','south']},
  {id:'come-lat-1',form:'aji',script:'arabizi',senseId:'come_imperative',regionTags:['center','south'],expectedArabic:'آجي'},
  {id:'child-ar-1',form:'درّي',script:'arabic',senseId:'child_boy',regionTags:['center','north']},
  {id:'child-lat-1',form:'drri',script:'arabizi',senseId:'child_boy',regionTags:['center','north'],expectedArabic:'درّي'},
  {id:'girl-ar-1',form:'بنت',script:'arabic',senseId:'girl_daughter',regionTags:['center','north','south']},
  {id:'girl-lat-1',form:'bent',script:'arabizi',senseId:'girl_daughter',regionTags:['center','south'],expectedArabic:'بنت'},
  {id:'today-ar-1',form:'اليوم',script:'arabic',senseId:'today',regionTags:['center','north','south']},
  {id:'today-lat-1',form:'lyom',script:'arabizi',senseId:'today',regionTags:['center','south'],expectedArabic:'اليوم'},
]
export const GOLD_ARABIZI = GOLD_FORMS.filter((x): x is GoldForm & {expectedArabic:string} => Boolean(x.expectedArabic))

/** Explicit orthographic-only cases; do not infer these from shared lexical meaning. */
export const NORMALIZATION_GOLD_PAIRS: Array<{left:string;right:string;equivalent:boolean}> = [
  {left:'أشنو',right:'اشنو',equivalent:true},
  {left:'آش',right:'اش',equivalent:true},
  {left:'دَابَا',right:'دابا',equivalent:true},
  {left:'دابا',right:'دروك',equivalent:false},
  {left:'شنو',right:'علاش',equivalent:false},
]
