# جرد نقاط إدخال المحتوى في المنصة

## الغرض والحالة

هذا الجرد مبني على مراجعة الملفات الحالية في فرع main بتاريخ 2026-11-03. وهو أساس لخطة ربط محرك السلامة، وليس ادعاءً بأن جميع المسارات محمية حالياً. يجب إعادة فحص كل مسار API وRPC وMigration وسياسة RLS قبل تنفيذ التكامل.

## الأسطح التي تم تحديدها

| السطح | الحقول النصية / المحتوى | موضع الكتابة الحالي | المعالجة المطلوبة |
|---|---|---|---|
| الملف الشخصي | display_name, specialty, dialect_region, github_handle | AuthDialog.tsx، ContributorProfilePanel.tsx، useCommunityGovernanceAndMessages.ts، App.tsx | فحص الاسم والتخصص والنبذة إن أضيفت، والتحقق الخادمي من الصلاحية |
| التسجيل وبيانات Auth | name, dialect_region, specialty ضمن user metadata | AuthDialog.tsx عبر auth.signUp وauth.updateUser | لا تعتمد على user_metadata كمصدر صلاحيات؛ توحيد المصدر مع reviewer_profiles وفحص الحقول قبل العرض |
| المقترحات المعجمية | word_ar, arabizi, meaning, translations, usage_note, examples, reviewer_note, evidence | NewEntryProposalPanel.tsx، RapidReviewPanel.tsx، utils/draftSync.ts | فحص كل النصوص والشواهد والملاحظات والروابط قبل إدخال review_submissions |
| قرارات المحررين | editor_note، status | EditorModerationPanel.tsx | فحص الملاحظات؛ إبقاء القرار والصلاحية في الخادم مع سجل تدقيق |
| التقييمات المجتمعية | note، dialect_region | hooks/useCommunityAttestations.ts عبر community_attestations.upsert | فحص الملاحظات؛ عدم اعتبار التصويت حقيقة لغوية أو موافقة تدريبية |
| الرسائل والإعلانات | title, body, sender_label | hooks/useCommunityGovernanceAndMessages.ts عبر member_messages.insert | فحص النصوص؛ التمييز بين الإعلان والرسالة الخاصة؛ عدم إدخال الرسائل الخاصة في التدريب |
| بلاغات الإشراف | reason, admin_note, target_display_name | hooks/useCommunityGovernanceAndMessages.ts عبر member_moderation_reports.insert/update | السماح بالاقتباس الضروري كدليل مع عزل العرض، وفحص الملاحظة الإدارية |
| طلبات الترقية | requester_name, experience_summary, sample_links, admin_note | AuthDialog.tsx عبر role_promotion_requests.insert، وRoleGovernancePanel.tsx عبر RPC/update | فحص الخبرة والاسم والروابط؛ صلاحيات الاعتماد إدارية فقط |
| إدارة الأعضاء | status_reason، وأسماء العرض | useCommunityGovernanceAndMessages.ts وRoleGovernancePanel.tsx | فحص سبب الإجراء، وحفظ RBAC داخل RPC/RLS لا في العميل |

## المسارات الحالية ذات الأولوية

### P0 — مراجعة وإرسال المقترحات
- NewEntryProposalPanel.tsx: إدخال مباشر إلى review_submissions.
- RapidReviewPanel.tsx: إدخال مباشر إلى review_submissions.
- utils/draftSync.ts: إدخال دفعي مباشر إلى review_submissions.
- EditorModerationPanel.tsx: تحديث status وeditor_note مباشرة، مع الاعتماد على DB trigger لتوثيق القرار.

### P1 — تفاعلات المجتمع والهوية
- hooks/useCommunityAttestations.ts: upsert وdelete في community_attestations.
- AuthDialog.tsx وContributorProfilePanel.tsx: تحديث reviewer_profiles وبيانات Auth metadata.
- hooks/useCommunityGovernanceAndMessages.ts: member_messages وmember_moderation_reports وحقول إدارة الأعضاء.
- AuthDialog.tsx وRoleGovernancePanel.tsx: طلبات ترقية المحررين وقرارها.

## المعمارية المطلوبة لمنع تجاوز الفحص

استدعاء بوابة من React وحده لا يكفي؛ يمكن للعميل استدعاء Supabase REST مباشرة إذا بقيت صلاحيات الكتابة مفتوحة. لذلك يجب أن يعتمد التكامل الإنتاجي على:

1. خدمة خادمية موحدة Content Gateway تتحقق من جلسة المستخدم وJWT وصلاحيات الدور ومعدل الطلب.
2. تشغيل محرك الفحص على الخادم مع سياق موثوق مشتق من المسار، لا من حقول يرسلها العميل.
3. منع الكتابة المباشرة إلى حقول المحتوى المحمية عبر RLS/GRANT، وتوفير RPC أو Edge Function معتمدة للكتابة.
4. الحفاظ على عمليات القراءة وتحديثات الحالة غير النصية وفق صلاحياتها الحالية، دون توسيع الامتيازات.
5. إضافة سجل تدقيق يربط المحتوى وإصدار المحرك والسياسة والقرار والفاعل.
6. اختبار محاولة تجاوز البوابة عبر REST وRPC والمسارات القديمة، لا الاكتفاء باختبار واجهة React.
7. تطبيق الفحص على INSERT وUPDATE، وعلى كل عنصر في عمليات الإدخال الدفعي.

## التعامل مع الرسائل والبلاغات

- الرسائل الخاصة مستبعدة من مجموعات التدريب افتراضياً.
- لا تُستخدم الرسائل الخاصة كبيانات تدريب حتى مع وجود تصنيف آلي.
- البلاغات يجب أن تقبل اقتباساً ضرورياً لإثبات الإساءة، مع عزل النص المقتبس عن العرض العام.
- لا يُعاقب المبلّغ بسبب وجود اللفظ المسيء داخل الدليل.
- يلزم نشر سياسة واضحة للفحص والخصوصية والاحتفاظ قبل تفعيل أي فحص تشغيلي للرسائل الخاصة.

## ملاحظات وحدود الجرد

- لم يُثبت وجود نظام تعليقات عام مستقل في الملفات التي تمت مراجعتها؛ لا يُفترض وجوده ولا يُستبعد نهائياً قبل استكمال مسح كامل للمستودع وقاعدة البيانات.
- هذا الجرد لا يغطي بعد كل Edge Functions أو SQL RPC أو triggers أو policies. يجب فحص مجلد supabase/migrations وsupabase/functions بالكامل قبل أي Migration.
- لم تُجرَ أي تغييرات على Supabase أو RLS أو البيانات الحية ضمن هذا الفرع.
