import { useMemo, useState } from 'react'
import { BookOpen, Search, ExternalLink, Send, ShieldCheck, Languages, X, Github, AlertTriangle } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Entry = { id: string; word: string; latin: string; meaning: string; french: string; category: string; example: string; translation: string; status: string }
const entries: Entry[] = [
  { id: 'demo-001', word: 'بزاف', latin: 'bzzaf', meaning: 'كثير؛ بدرجة كبيرة', french: 'Beaucoup, très', category: 'الكمية والدرجة', example: 'عندي بزاف ديال الخدمة اليوم.', translation: "J’ai beaucoup de travail aujourd’hui.", status: 'توضيحي' },
  { id: 'demo-002', word: 'واخا', latin: 'wakha', meaning: 'حسناً؛ رغم ذلك، حسب السياق', french: "D’accord ; même si", category: 'التواصل', example: 'واخا، غادي نجي معاك.', translation: "D’accord, je viendrai avec toi.", status: 'توضيحي' },
  { id: 'demo-003', word: 'دابا', latin: 'daba', meaning: 'الآن؛ في الوقت الحالي', french: 'Maintenant', category: 'الزمن', example: 'غادي نبدا دابا.', translation: 'Je vais commencer maintenant.', status: 'توضيحي' },
  { id: 'demo-004', word: 'شنو', latin: 'chno / shنو', meaning: 'ماذا؛ ما', french: 'Quoi ; que', category: 'الاستفهام', example: 'شنو بغيتي تقول؟', translation: 'Qu’est-ce que tu veux dire ?', status: 'توضيحي' },
  { id: 'demo-005', word: 'مزيان', latin: 'mzyan', meaning: 'جيد؛ حسن؛ مناسب', french: 'Bien ; bon', category: 'الصفات', example: 'هاد الحل مزيان.', translation: 'Cette solution est bonne.', status: 'توضيحي' },
]
const fields = [
  ['word_ar', 'الكتابة بالعربية'], ['arabizi', 'الكتابة بـ Arabizi'], ['meaning', 'المعنى المقترح'], ['french_translation', 'الترجمة الفرنسية'], ['msa_translation', 'المقابل بالفصحى'], ['usage_note', 'ملاحظة حول الاستعمال'], ['example_darija', 'مثال بالدارجة'], ['example_translation', 'ترجمة المثال'],
] as const

export default function App() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(entries[0])
  const [form, setForm] = useState<Record<string, string>>({})
  const [evidence, setEvidence] = useState('')
  const [note, setNote] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const filtered = useMemo(() => entries.filter(e => [e.word,e.latin,e.meaning,e.category].join(' ').toLowerCase().includes(query.toLowerCase())), [query])
  const update = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }))

  async function signIn() {
    if (!supabase) return
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false); setMessage(error ? error.message : 'تم تسجيل الدخول.')
  }
  async function submit() {
    if (!supabase) { setMessage('فعّل Supabase أولاً عبر إعداد ملف .env وتنفيذ supabase/schema.sql. لم يتم إرسال أي بيانات.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMessage('سجّل الدخول قبل إرسال المقترح.'); setShowLogin(true); return }
    if (!evidence.trim()) { setMessage('أضف رابط شاهد واحداً على الأقل أو اشرح سبب عدم توفر شاهد.'); return }
    setBusy(true); setMessage('')
    const { error } = await supabase.from('review_submissions').insert({
      entry_id: active.id, proposed_data: form, evidence: [{ url: evidence.trim(), note: note.trim() }],
      reviewer_note: note.trim() || null, status: 'pending',
    })
    setBusy(false)
    setMessage(error ? error.message : 'تم إرسال المقترح للمراجعة. لم يتغير المعجم الرسمي.')
    if (!error) { setForm({}); setEvidence(''); setNote('') }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">A</span><span><b>ArCode</b><small>STANDARD · LANGUAGE INITIATIVE</small></span></a><nav><a href="#workspace">مساحة المراجعة</a><a href="#method">منهجية التحقق</a><a href="https://github.com/ArCode-Standard/moroccan-darija-dataset" target="_blank" rel="noreferrer">المعجم الرسمي <ExternalLink size={13}/></a></nav><button className="login-button" onClick={() => setShowLogin(v=>!v)}>دخول المراجعين</button></header>
    <main>
      <section className="hero"><div className="eyebrow"><span/> مبادرة لغوية مفتوحة من ArCode Standard</div><h1>نراجع الدارجة المغربية،<br/><em>كلمةً بكلمة.</em></h1><p>منصة تعاونية لتدقيق المفردات والمعاني والكتابة والسياقات، اعتماداً على شواهد قابلة للتحقق ومراجعة بشرية.</p><div className="hero-actions"><a className="primary" href="#workspace">ابدأ المراجعة <span>←</span></a><a className="secondary" href="#method">كيف نتحقق؟</a></div><div className="hero-foot"><span><ShieldCheck size={15}/> المراجعة البشرية أساس الاعتماد</span><span><BookOpen size={15}/> مصدر البيانات: GitHub</span></div></section>
    {showLogin && <section className="login-panel"><div><b>دخول المراجعين</b><p>يلزم حساب Supabase لإرسال المساهمات.</p></div><input placeholder="البريد الإلكتروني" type="email" value={email} onChange={e=>setEmail(e.target.value)}/><input placeholder="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={signIn} disabled={!isSupabaseConfigured || busy}>{busy?'جارٍ...':'تسجيل الدخول'}</button><button className="quiet" onClick={()=>setShowLogin(false)}><X size={16}/></button></section>}
    <section className="stats"><div><b>921</b><span>مدخل في إصدار المعجم المشار إليه</span></div><div><b>38</b><span>فئة معجمية</span></div><div><b>146</b><span>مثال سياقي منفصل</span></div><div><b>Human</b><span>الاعتماد النهائي بشري</span></div></section>
    <section id="workspace" className="workspace"><div className="section-heading"><div><span className="kicker">WORKSPACE / 01</span><h2>مساحة المراجعة</h2><p>اختر مدخلاً، افحص تفاصيله، ثم أرسل اقتراحك مدعوماً بالشواهد.</p></div><div className="dataset-state"><span className="pulse"/> وضع العرض التوضيحي</div></div>
      <div className="demo-alert"><AlertTriangle size={17}/><span><b>بيانات تجريبية للواجهة.</b> لم يتم بعد ربط المنصة بملفات المعجم الفعلية؛ الكلمات الظاهرة هنا أمثلة توضيحية وليست قائمة مراجعة رسمية.</span></div>
      <div className="review-layout"><aside className="word-list"><div className="list-title"><b>قائمة الكلمات</b><span>{filtered.length} أمثلة</span></div><label className="searchbox"><Search size={17}/><input placeholder="ابحث عن كلمة أو معنى..." value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="entries">{filtered.map(entry=><button key={entry.id} className={active.id===entry.id?'entry active':'entry'} onClick={()=>{setActive(entry);setForm({})}}><span className="entry-word">{entry.word}</span><span className="entry-meta"><span>{entry.latin}</span><span className="pending">{entry.status}</span></span><span className="entry-meaning">{entry.meaning}</span></button>)}</div></aside>
      <article className="detail"><div className="detail-top"><div><span className="kicker">LEXICAL ENTRY · {active.id.toUpperCase()}</span><h3>{active.word}</h3><div className="latin">{active.latin}</div></div><span className="tag">{active.category}</span></div><div className="source-grid"><div><label>المعنى المسجل في المثال</label><p>{active.meaning}</p></div><div><label>المقابل الفرنسي</label><p>{active.french}</p></div><div className="example"><label>مثال سياقي</label><p>{active.example}</p><small>{active.translation}</small></div></div>
      <div className="form-heading"><div><span className="kicker">CONTRIBUTION FORM</span><h4>اقترح مراجعة أو تصحيحاً</h4></div><span className="tag neutral">لا يُنشر تلقائياً</span></div>
      <div className="fields">{fields.map(([key,label])=><label key={key}>{label}<input value={form[key]??''} onChange={e=>update(key,e.target.value)} placeholder="اتركه فارغاً إذا لم تقترح تعديلاً"/></label>)}</div>
      <div className="evidence-box"><div className="evidence-title"><ShieldCheck size={17}/><b>الشاهد ومصدر التحقق</b></div><p>أرفق رابطاً يبيّن استعمال الكلمة في سياق مغربي. وجود الكلمة في نتيجة بحث وحده لا يثبت معناها أو شيوعها.</p><input dir="ltr" placeholder="https://..." value={evidence} onChange={e=>setEvidence(e.target.value)}/><textarea placeholder="اشرح السياق، موثوقية المصدر، أو سبب اقتراحك..." value={note} onChange={e=>setNote(e.target.value)}/><div className="search-links"><a target="_blank" rel="noreferrer" href={'https://www.google.com/search?q='+encodeURIComponent('"'+active.word+'" الدارجة المغربية')}>بحث Google <ExternalLink size={12}/></a><a target="_blank" rel="noreferrer" href={'https://www.youtube.com/results?search_query='+encodeURIComponent(active.word+' الدارجة المغربية')}>بحث YouTube <ExternalLink size={12}/></a></div></div>
      <div className="submit-row"><button className="submit" onClick={submit} disabled={busy}><Send size={16}/>{busy?'جارٍ الإرسال...':'إرسال للمراجعة'}</button><span>تُحفظ المساهمات بحالة pending</span></div>{message&&<div className="message" role="status">{message}</div>}
      </article></div>
    </section>
    <section id="method" className="method"><div className="section-heading"><div><span className="kicker">REVIEW STANDARD / 02</span><h2>كيف نتحقق من الكلمة؟</h2><p>نفصل بين العثور على الكلمة وبين إثبات معناها واستعمالها.</p></div></div><div className="method-grid"><div><span>01</span><h3>العثور</h3><p>جمع شواهد أولية من مصادر مختلفة، دون اعتبار نتائج البحث حكماً لغوياً.</p></div><div><span>02</span><h3>فهم السياق</h3><p>قراءة الجملة والسياق لتحديد المعنى المقصود وتعدد الدلالات المحتملة.</p></div><div><span>03</span><h3>التحقق المغربي</h3><p>تقييم ما إذا كان الاستعمال دارجاً مغربياً فعلاً، لا مجرد تطابق كتابي عابر.</p></div><div><span>04</span><h3>اعتماد بشري</h3><p>مراجع مخوّل يقيّم المقترح قبل نقله إلى مستودع البيانات الرسمي.</p></div></div></section>
    <section className="bottom-note"><div><Languages size={21}/><div><b>المعجم الرسمي يظل مصدر الحقيقة</b><p>هذه المنصة لإدارة المراجعات والمقترحات، وليست بديلاً عن مستودع البيانات أو عن تدقيق حقوق المصادر.</p></div></div><a href="https://github.com/ArCode-Standard/darija-lexreview" target="_blank" rel="noreferrer"><Github size={16}/> مستودع التطبيق <ExternalLink size={13}/></a></section>
    </main><footer><span>© 2026 ArCode Standard</span><span>نبني النظام البيئي العربي للتقنية</span><span>Darija LexReview · MVP</span></footer>
  </div>
}
