-- ==============================================================================
-- NEXA STORE - SEED DATA MIGRATION
-- Project Reference: mrinxsiostnzzjowutav
-- Populates initial categories, products, coupons, and store settings
-- ==============================================================================

-- 1. INSERT CATEGORIES
INSERT INTO public.categories (id, name, icon, description, display_order) VALUES
('ai', 'أدوات الذكاء الاصطناعي', 'fa-solid fa-wand-magic-sparkles', 'ChatGPT Plus · Claude 3.5 · Gemini · Perplexity', 1),
('creative', 'البرامج الإبداعية والتصميم', 'fa-solid fa-palette', 'Adobe CC · Canva Pro · CapCut Pro · Figma', 2),
('office', 'برامج المكتب والإنتاجية', 'fa-solid fa-border-all', 'Microsoft 365 · Notion · Zoom Pro · Coursera', 3),
('streaming', 'الترفيه والاشتراكات', 'fa-solid fa-play', 'YouTube Premium · Spotify · Prime Video', 4),
('gaming', 'الألعاب والبطاقات والحماية', 'fa-solid fa-gamepad', 'Discord Nitro · NordVPN · ProtonVPN', 5)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  icon = EXCLUDED.icon, 
  description = EXCLUDED.description, 
  display_order = EXCLUDED.display_order;

-- 2. INSERT COUPONS
INSERT INTO public.coupons (code, discount_type, discount_value, min_spend, is_active) VALUES
('NEXA20', 'fixed', 100.00, 200.00, true),
('VIP10', 'fixed', 100.00, 200.00, true),
('NEXA', 'fixed', 100.00, 200.00, true)
ON CONFLICT (code) DO NOTHING;

-- 3. INSERT STORE SETTINGS
INSERT INTO public.store_settings (key, value) VALUES
('payment_vodafone', '{"name": "فودافون كاش", "number": "01225106057", "instructions": "تحويل فوري عبر فودافون كاش مع إرفاق لقطة شاشة للإيصال"}'::jsonb),
('payment_instapay', '{"name": "InstaPay إنستاباي", "ipa": "01225106057", "instructions": "تحويل بنكي لحظي عبر تطبيق إنستاباي مع إرفاق لقطة شاشة للإيصال"}'::jsonb),
('support_contact', '{"phone": "01225106057", "whatsapp": "https://wa.me/201225106057", "email": "support@nexadigital.store"}'::jsonb),
('site_announcement', '{"active": true, "discount": "20%", "text": "خصم 20% على جميع الاشتراكات السنوية لفترة محدودة!"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. INSERT PRODUCTS
INSERT INTO public.products (id, name, category_id, duration, wholesale_egp, price_egp, price_usd, wholesale_usd, source_bot, is_featured, image, featured_image, rating, rating_count, description, specs, full_desc, activation_guide, warranty, is_active) VALUES
('ai-chatgpt-plus', 'ChatGPT Plus 1M', 'ai', '1 شهر', 700, 1400, 28.00, 12.88, '@snart_store_bot', true, 'logos/chatgpt-plus.webp', 'logos/chatgpt-plus.webp', 4.9, '2.3K', 'اشتراك شات جي بي تي بلس الرسمي يدعم GPT-4o وتوليد الصور عبر DALL-E بلا حدود.', '["وصول غير محدود لنموذج GPT-4o و GPT-4", "توليد وتعديل الصور فائقة الدقة بـ DALL-E 3", "تحليل ملفات البيانات والبرمجة المتقدمة", "تفعيل رسمي وضمان كامل طوال الشهر"]'::jsonb, 'اشتراك ChatGPT Plus الرسمي بحساب خاص مجهز، وصول غير محدود لكل المزايا المتقدمة.', '1. نرسل لك بيانات الدخول عبر واتساب والإيميل.\n2. سجل الدخول مباشرة على chatgpt.com واستمتع بكافة المزايا.', 'ضمان كامل طوال فترة الاشتراك واستبدال فوري عند أي خلل.', true),

('ai-perplexity-pro', 'Perplexity PRO 12M', 'ai', '1 سنة', 750, 1500, 30.00, 14.00, '@RichAIStoreBot', false, 'logos/perplexity.webp', 'logos/perplexity.webp', 4.9, '980', 'محرك البحث الذكي الشامل، يجمع بين كل نماذج الذكاء الاصطناعي في منصة واحدة.', '["أكثر من 300 بحث Pro يومياً", "اختيار النموذج (Claude 3.5 Sonnet, GPT-4o)", "رفع وتحليل ملفات PDF والمستندات بلا حدود", "تفعيل سنوي رسمي مع ضمان"]'::jsonb, 'محرك البحث الذكي الشامل لجميع نماذج الذكاء الاصطناعي مع وصول سنوي Pro.', '1. نرسل لك كود أو رابط تفعيل الاشتراك السنوي.\n2. قم بالربط بحسابك مباشرة.', 'ضمان رسمي لمدة سنة كاملة.', true),

('ai-gemini-18m', 'Google Gemini Advanced 18M', 'ai', '18 شهر', 25, 75, 1.50, 0.49, '@storeBatmanBot', false, 'logos/gemini.webp', 'logos/gemini.webp', 4.8, '1.5K', 'حساب جيميني أدفانسد العملاق بسعة نافذة سياق 1M توكنز و2 تيرابايت مساحة سحابية.', '["نموذج Gemini 1.5 Pro فائق السرعة", "نافذة سياق ضخمة لتحليل الكتب والأفلام", "مساحة Google One السحابية 2TB", "تسليم فوري وتفعيل مباشر"]'::jsonb, 'اشتراك Gemini Advanced لمدة 18 شهراً مع مساحة تخزين 2TB سحابية.', '1. نرسل لك بيانات الحساب الرسمي المجهز.\n2. ابدأ الاستخدام مباشرة على gemini.google.com.', 'ضمان طوال 18 شهر.', true),

('ai-gemini-3m', 'Google Gemini Advanced 3M', 'ai', '3 شهور', 40, 120, 2.40, 0.70, '@storeBatmanBot', false, 'logos/gemini.webp', 'logos/gemini.webp', 4.8, '620', 'باقة جيميني أدفانسد لمدة 3 شهور جاهزة للاستخدام الفوري.', '["Gemini Advanced 1.5 Pro", "سرعة استجابة فائقة", "دعم كامل للغة العربية والإنجليزية", "تسليم فوري"]'::jsonb, 'اشتراك Gemini Advanced لمدة 3 شهور.', '1. استلم الحساب فورا عبر واتساب.\n2. سجل دخولك على جوجل.', 'ضمان استبدال فوري طوال الـ 3 شهور.', true),

('ai-claude-pro', 'Claude 3.5 Sonnet Pro', 'ai', '1 شهر', 650, 1350, 27.00, 12.00, '@RichAIStoreBot', false, 'logos/claude.webp', 'logos/claude.webp', 4.9, '1.8K', 'أقوى نموذج ذكاء اصطناعي للبرمجة وكتابة المحتوى الأكاديمي والتحليل العميق.', '["وصول غير محدود لـ Claude 3.5 Sonnet", "ميزة Artifacts التفاعلية لتطوير التطبيقات", "أعلى دقة برمجية ولغوية في العالم", "حساب خاص مضمون 100%"]'::jsonb, 'اشتراك Claude Pro الرسمي لكافة المهام البرمجية والتطويرية.', '1. نرسل لك الحساب الخاص بك مفعل مسبقا.\n2. سجل الدخول على claude.ai مباشرة.', 'ضمان كامل طوال الشهر.', true),

('ai-midjourney-standard', 'Midjourney Standard Plan', 'ai', '1 شهر', 900, 1600, 32.00, 16.50, '@RichAIStoreBot', false, 'logos/midjourney.webp', 'logos/midjourney.webp', 4.9, '3.1K', 'المنصة رقم 1 عالمياً لتوليد الصور الخيالية والفنية بأعلى جودة واحترافية.', '["15 ساعة Fast GPU لتوليد الصور بسرعة", "توليد غير محدود في وضع Relax", "حقوق الاستخدام التجاري الكاملة", "وصول حصري لمعرض الأعضاء"]'::jsonb, 'اشتراك Midjourney Standard الرسمي عبر ديسكورد.', '1. تسليم فوري لحساب ديسكورد مجهز باشتراك مفعل.\n2. انضم وابدأ التوليد فورا.', 'ضمان طوال مدة الاشتراك.', true),

('cr-capcut-pro-1y', 'CapCut Pro 1 Year', 'creative', '1 سنة', 120, 360, 7.20, 2.30, '@RichAIStoreBot', true, 'logos/capcut-pro.webp', 'logos/capcut-pro.webp', 4.9, '5.4K', 'الاشتراك الأقوى لصناع المحتوى ومحرري الفيديو، تفعيل سنوي رسمي بكافة الميزات.', '["تصدير بدقة 4K 60FPS بدون علامة مائية", "جميع القوالب والتأثيرات الصوتية والذكاء الاصطناعي Pro", "توليد نصوص وترجمة تلقائية فائقة الدقة", "يعمل على الهاتف، الكمبيوتر والويب"]'::jsonb, 'اشتراك CapCut Pro السنوي لإنتاج مقاطع الفيديو باحترافية.', '1. نرسل لك بيانات الحساب المجهز.\n2. سجل الدخول في تطبيق CapCut على الهاتف أو الكمبيوتر.', 'ضمان استبدال فوري لمدة سنة كاملة.', true),

('cr-canva-pro-edu', 'Canva Pro Lifetime / 1Y', 'creative', '1 سنة', 30, 90, 1.80, 0.58, '@storeBatmanBot', false, 'logos/canva.webp', 'logos/canva.webp', 4.9, '12.8K', 'وصول كامل لجميع قوالب وتصاميم كانفا الاحترافية وإزالة الخلفيات بنقرة واحدة.', '["أكثر من 100 مليون صورة وقالب وفيديو Pro", "أدوات الذكاء الاصطناعي Magic Resize و BG Remover", "مساحة تخزين سحابية ضخمة 1TB", "تفعيل مباشر على إيميلك الشخصي"]'::jsonb, 'اشتراك كانفا برو الرسمي لتصميم السوشيال ميديا والعروض التقديمية.', '1. نرسل لك رابط دعوة مباشر للانضمام.\n2. اضغط على الرابط وسيتفعل اشتراكك فورا على إيميلك الشخصي.', 'ضمان رسمي كامل.', true),

('cr-adobe-all-apps', 'Adobe Creative Cloud All Apps 1M', 'creative', '1 شهر', 850, 1550, 31.00, 15.80, '@snart_store_bot', false, 'logos/adobe-cc.webp', 'logos/adobe-cc.webp', 4.9, '4.2K', 'الحزمة الإبداعية الكاملة تضم Photoshop, Illustrator, Premiere, After Effects والمزيد.', '["أكثر من 20 تطبيق إبداعي رسمي أصلي", "100GB مساحة سحابية و Adobe Fonts", "تحديثات مستمرة من السحابة مباشرة", "تفعيل على حسابك الشخصي أو حساب جاهز"]'::jsonb, 'الحزمة الكاملة لكافة برامج أدوبي الإبداعية الأصلية.', '1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\n2. حمل البرامج من Adobe Creative Cloud الرسمي.', 'ضمان رسمي كامل طوال الشهر.', true),

('cr-figma-pro', 'Figma Professional 1 Year', 'creative', '1 سنة', 150, 450, 9.00, 2.90, '@storeBatmanBot', false, 'logos/figma.webp', 'logos/figma.webp', 4.8, '1.1K', 'اشتراك فيجما للمصممين المحترفين وفرق العمل، مشاريع ومكتبات غير محدودة.', '["مشاريع وتصاميم غير محدودة", "مكتبات مكونات Team Libraries مشتركة", "تاريخ نسخ غير محدود للملفات", "تفعيل سنوي مضمون"]'::jsonb, 'اشتراك فيجما برو السنوي لتصميم واجهات المستخدم UI/UX.', '1. دعوة رسمية لحسابك الخاص.\n2. وصول غير محدود لكل خصائص Pro.', 'ضمان سنوي كامل.', true),

('of-microsoft-365', 'Microsoft 365 Family / Pro 1Y', 'office', '1 سنة', 90, 270, 5.40, 1.75, '@storeBatmanBot', true, 'logos/office-365.webp', 'logos/office-365.webp', 4.9, '8.9K', 'باقة أوفيس 365 الرسمية مع Word, Excel, PowerPoint و 1TB تخزين OneDrive سحابي.', '["Word, Excel, PowerPoint, Outlook", "1 تيرابايت مساحة تخزين ون درايف آمنة", "يعمل على 5 أجهزة (ويندوز، ماك، آيفون، أندرويد)", "تحديثات أمنية ورسمية مستمرة"]'::jsonb, 'حزمة ميكروسوفت أوفيس 365 الرسمية لمدة عام كامل مع 1TB OneDrive.', '1. نرسل لك كود تفعيل أو بيانات الحساب الرسمي.\n2. ادخل على setup.office.com وحمل التطبيقات.', 'ضمان رسمي لمدة سنة كاملة.', true),

('of-notion-plus', 'Notion Plus 1 Year', 'office', '1 سنة', 80, 240, 4.80, 1.55, '@storeBatmanBot', false, 'logos/notion.webp', 'logos/notion.webp', 4.9, '2.1K', 'منصة تنظيم العمل والملاحظات وإدارة المشاريع الأكثر إنتاجية عالمياً.', '["صفحات وبلوكات غير محدودة", "مزامنة سريعة ودعم رفع ملفات بحجم غير محدود", "Notion AI متقدم لتلخيص وتوليد النصوص", "تفعيل سنوي رسمي"]'::jsonb, 'اشتراك نوشن بلس السنوي لإدارة المشاريع وملاحظات العمل.', '1. دعوة مباشرة على إيميلك المسجل في نوشن.\n2. تفعيل تلقائي فوري.', 'ضمان رسمي لمدة عام كامل.', true),

('of-coursera-plus', 'Coursera Plus 1 Year', 'office', '1 سنة', 350, 750, 15.00, 6.80, '@RichAIStoreBot', false, 'logos/coursera.webp', 'logos/coursera.webp', 4.9, '3.5K', 'وصول غير محدود لأكثر من 7,000 كورس وشهادة احترافية معتمدة من كبرى الجامعات والشركات.', '["شهادات معتمدة من Google, IBM, Meta", "أكثر من 7,000 دورة تدريبية ومسار تخصصي", "تطبيق عملي ومشاريع حقيقية", "تفعيل سنوي رسمي على حسابك"]'::jsonb, 'اشتراك كورسيرا بلس السنوي لتعلم المهارات والشهادات المعتمدة.', '1. ترقية رسمية على حسابك الشخصي في كورسيرا.\n2. وصول لكل الكورسات والشهادات فورا.', 'ضمان رسمي لمدة عام.', true),

('st-youtube-premium', 'YouTube Premium 1 Year', 'streaming', '1 سنة', 180, 540, 10.80, 3.50, '@RichAIStoreBot', true, 'logos/youtube-premium.webp', 'logos/youtube-premium.webp', 4.9, '15.2K', 'مشاهدة يوتيوب بدون إعلانات نهائياً، مع تشغيل في الخلفية وتحميل وتطبيق YouTube Music.', '["تصفح وتشغيل الفيديوهات بدون أي إعلانات", "تشغيل الفيديوهات في الخلفية وعند قفل الشاشة", "تحميل الفيديوهات بجودة عالية للمشاهدة بدون إنترنت", "اشتراك YouTube Music مدمج مجاناً", "تفعيل رسمي عائلي على إيميلك الشخصي"]'::jsonb, 'اشتراك يوتيوب بريميوم السنوي الرسمي على حسابك الشخصي.', '1. نرسل لك رابط دعوة عائلية على إيميلك الشخصي في جيميل.\n2. اقبل الدعوة وسيتفعل يوتيوب بريميوم فوراً.', 'ضمان رسمي كامل طوال السنة.', true),

('st-spotify-premium', 'Spotify Premium 1 Year', 'streaming', '1 سنة', 120, 360, 7.20, 2.30, '@RichAIStoreBot', false, 'logos/spotify.webp', 'logos/spotify.webp', 4.8, '9.7K', 'استماع غير محدود للموسيقى والبودكاست بأعلى جودة صوتية وبدون إعلانات.', '["استماع بدون إعلانات مع تخطي غير محدود", "تحميل الأغاني والبودكاست للاستماع بدون إنترنت", "جودة صوت نقية فائقة Very High 320kbps", "تفعيل على حسابك الشخصي أو حساب مجهز"]'::jsonb, 'اشتراك سبوتيفاي بريميوم السنوي.', '1. نرسل لك رابط تفعيل على حسابك أو حساب مجهز.\n2. استمتع بكل المزايا فورا.', 'ضمان كامل طوال الـ 12 شهرا.', true),

('st-prime-video', 'Amazon Prime Video 6 Months', 'streaming', '6 شهور', 90, 270, 5.40, 1.75, '@storeBatmanBot', false, 'logos/primevideo.webp', 'logos/primevideo.webp', 4.7, '4.1K', 'مشاهدة أحدث الأفلام والمسلسلات الحصرية من أمازون برايم بدقة 4K UHD.', '["مكتبة أفلام ومسلسلات حصرية وأصلية", "جودة بث فائقة 4K HDR مع صوت محيطي", "دعم الترجمة والدبلجة العربية الكاملة", "حساب خاص أو شاشة خاصة مع PIN"]'::jsonb, 'اشتراك أمازون برايم فيديو لمدة 6 شهور بدقة 4K.', '1. نرسل لك بيانات الحساب والشاشة المخصصة لك مع PIN.\n2. شاهد أفلامك ومسلسلاتك المفضلة فوراً.', 'ضمان استبدال فوري طوال 6 شهور.', true),

('gm-discord-nitro', 'Discord Nitro 1 Year', 'gaming', '1 سنة', 450, 950, 19.00, 8.80, '@RichAIStoreBot', true, 'logos/discord-nitro.webp', 'logos/discord-nitro.webp', 4.9, '6.8K', 'الترقية الكاملة لديسكورد: إيموجيز مخصصة في كل السيرفرات وبث شاشة 4K وبوستات مجانية.', '["بث شاشة بدقة 4K 60FPS فائقة الوضوح", "استخدام الإيموجيز والستيكرز في أي سيرفر", "2 Server Boosts مجاناً شهرياً", "شارة Nitro المميزة وصورة متحركة GIF"]'::jsonb, 'اشتراك ديسكورد نيترو السنوي الكامل.', '1. نرسل لك رابط جيفت رسمي أو تفعيل مباشر.\n2. استمتع بمزايا نيترو فوراً على حسابك.', 'ضمان سنوي كامل.', true),

('gm-nordvpn-1y', 'NordVPN Ultimate 1 Year', 'gaming', '1 سنة', 120, 360, 7.20, 2.30, '@storeBatmanBot', false, 'logos/nordvpn.webp', 'logos/nordvpn.webp', 4.8, '5.3K', 'شبكة VPN الأسرع والأكثر أماناً في العالم لتأمين الاتصال وفتح المحتوى المحجوب.', '["أكثر من 5,500 سيرفر في 60 دولة", "تشفير عسكري من الجيل التالي وحماية من البرمجيات الخبيثة", "حماية Kill Switch وسياسة عدم الاحتفاظ بالسجلات No-Logs", "يعمل على 6 أجهزة في نفس الوقت"]'::jsonb, 'اشتراك نورد في بي إن السنوي لتأمين الخصوصية والاتصال.', '1. نرسل لك بيانات الحساب الرسمي المجهز.\n2. حمل تطبيق NordVPN وسجل دخولك فوراً.', 'ضمان سنوي كامل.', true)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  duration = EXCLUDED.duration,
  wholesale_egp = EXCLUDED.wholesale_egp,
  price_egp = EXCLUDED.price_egp,
  price_usd = EXCLUDED.price_usd,
  wholesale_usd = EXCLUDED.wholesale_usd,
  source_bot = EXCLUDED.source_bot,
  is_featured = EXCLUDED.is_featured,
  image = EXCLUDED.image,
  featured_image = EXCLUDED.featured_image,
  rating = EXCLUDED.rating,
  rating_count = EXCLUDED.rating_count,
  description = EXCLUDED.description,
  specs = EXCLUDED.specs,
  full_desc = EXCLUDED.full_desc,
  activation_guide = EXCLUDED.activation_guide,
  warranty = EXCLUDED.warranty,
  is_active = EXCLUDED.is_active;
