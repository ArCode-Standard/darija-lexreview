# خريطة عمل الخوارزميات وسلامة المحتوى

**آخر تحديث:** 2026-11-03  
**المستودع:** ArCode-Standard/darija-lexreview  
**قاعدة العمل:** جميع التغييرات في فروع وطلبات مراجعة مستقلة. لا دمج ولا نشر دون موافقة صريحة.

## مسارات العمل

| المسار | GitHub | الحالة | النطاق |
|---|---|---|---|
| محرك الدارجة الموحد | [PR #23](https://github.com/ArCode-Standard/darija-lexreview/pull/23) | Draft — CI #280 ناجح | تطبيع، Arabizi، تشابه، تكرار، متغيرات، صرف، سياق، إشارات تحريرية |
| Benchmark والتقرير | [PR #24](https://github.com/ArCode-Standard/darija-lexreview/pull/24) | Draft — CI #17 ناجح | مجموعة اختبار أولية، Precision/Recall/F1، قياس الأداء، تقرير عربي |
| سلامة المحتوى والتعلم المحكوم | [PR #36](https://github.com/ArCode-Standard/darija-lexreview/pull/36) | Draft — CI #295 ناجح؛ CI #297 يعيد التحقق بعد تحديث الإصدار | محرك Content Safety 0.2.0، فحص payload، موافقات، dataset fingerprint، تقييم وإصدارات |
| بوابة الخادم والتعلم الدائم | [Issue #37](https://github.com/ArCode-Standard/darija-lexreview/issues/37) | مفتوح — المرحلة التالية | Edge Function، رموز فحص أحادية الاستخدام، RPC، triggers، persistence، اختبارات منع تجاوز REST |

## الفروع الخوارزمية السابقة

- [PR #20](https://github.com/ArCode-Standard/darija-lexreview/pull/20) و[PR #21](https://github.com/ArCode-Standard/darija-lexreview/pull/21) يحتويان أعمالاً متداخلة جرى تجميعها في PR #23.
- أضيف تعليق يوضح مسار التجميع المقترح. لم يتم إغلاقهما أو دمجهما.

## ما تم التحقق منه

- PR #23: TypeScript، اختبارات الوحدات، production build، إعادة بناء Supabase المعزولة، واختبارات pgTAP/RLS نجحت في CI #280.
- PR #24: TypeScript، 52 اختباراً بما فيها Benchmark، وproduction build نجحت في CI #17.
- PR #36: TypeScript واختبارات الوحدات وproduction build وpgTAP/RLS نجحت في CI #295. CI #297 يعيد الفحص بعد ترقية إصدار محرك السلامة إلى 0.2.0.

أرقام Benchmark موثقة على أنها نتائج هندسية أولية من fixtures صغيرة، وليست دقة لغوية عامة. كما أن قياسات الزمن تختلف بين تشغيل وآخر.

## حدود المرحلة الحالية

1. محرك الدارجة ومحرك السلامة الحاليان قواعد ومقاييس حتمية؛ لا يوجد نموذج تعلم آلي مدرّب أو artifact منشور.
2. لا توجد حتى الآن مجموعة بيانات مغربية موثقة ومراجعة بما يكفي لإثبات دقة نموذج أو إجراء Fine-tuning مسؤول.
3. محرك Content Safety لم يُربط بعد بمسارات الكتابة الفعلية. لا يجوز وصف المنصة بأنها محمية بالكامل قبل تنفيذ Issue #37 وإثبات منع تجاوز الفحص عبر PostgREST.
4. لا توجد Edge Functions جديدة أو migrations أو تغييرات RLS مطبقة على Supabase الإنتاجي.
5. لا تدخل الرسائل الخاصة في التدريب. أي إدخال مستقبلي يتطلب موافقة وترخيصاً ومراجعة بشرية وإزالة بيانات شخصية.
6. المخرجات الخوارزمية إشارات مساعدة؛ لا تقبل أو ترفض أو تدمج أو تنشر مفردة تلقائياً.

## ترتيب التنفيذ

1. مراجعة PR #23 و#24 و#36 دون دمج تلقائي.
2. تنفيذ Issue #37 في فرع مستقل: gateway + token/RPC + database enforcement + durable learning records.
3. اختبار كل سطح كتابة مع RLS وtriggers الحالية واختبارات direct REST bypass.
4. إعداد corpus وbenchmark بمراجعة مستقلة ومتحدثين أصليين وتراخيص واضحة.
5. مقارنة خط الأساس الحتمي بنموذج Darija/Arabizi بعد توافر بيانات كافية.
6. Shadow mode وقياس false positives/false negatives قبل أي enforcement.
7. انتظار موافقة صريحة قبل الدمج أو النشر.

