/* ===================================================================
   Activkeyz - PRODUCT DATABASE & LOCALSTORAGE SYNC
   Canonical Catalog of 23 Authorized Products + Canonical Slug Resolver
   Strictly limited to the owner-approved catalog allowlist.
   =================================================================== */

// 0. Set of strictly approved authorized product IDs
const AUTHORIZED_PRODUCT_IDS = [
  'ai-gemini-18m',
  'ai-chatgpt-plus',
  'ai-perplexity-pro',
  'ai-gemini-3m',
  'cr-capcut-pro-1y',
  'cr-adobe-all-apps',
  'cr-figma-pro',
  'of-microsoft-365',
  'of-notion-plus',
  'of-zoom-pro-1m',
  'of-coursera-plus',
  'of-linkedin-learning',
  'st-youtube-premium-1y',
  'st-youtube-premium-6m',
  'st-spotify-1y',
  'st-apple-music-3m',
  'st-prime-video-6m',
  'gm-discord-nitro-1y',
  'gm-discord-nitro-1m',
  'gm-nordvpn-1y',
  'gm-protonvpn-1y',
  'ai-elevenlabs-starter',
  'ai-runway-gen3'
];
const AUTHORIZED_PRODUCT_SET = new Set(AUTHORIZED_PRODUCT_IDS);

// 1. Canonical Product Slugs & Legacy ID Aliases Map (Authorized Only)
const CANONICAL_PRODUCT_SLUG_MAP = {
  // AI Tools
  'chatgpt': 'ai-chatgpt-plus',
  'chatgpt-plus': 'ai-chatgpt-plus',
  'ai-chatgpt': 'ai-chatgpt-plus',
  'gemini': 'ai-gemini-18m',
  'gemini-advanced': 'ai-gemini-18m',
  'gemini-3m': 'ai-gemini-3m',
  'perplexity': 'ai-perplexity-pro',
  'elevenlabs': 'ai-elevenlabs-starter',
  'ai-elevenlabs-3m': 'ai-elevenlabs-starter',
  'ai-elevenlabs-1m': 'ai-elevenlabs-starter',
  'runway': 'ai-runway-gen3',
  'ai-runway-pro-12m': 'ai-runway-gen3',

  // Creative Suite
  'capcut': 'cr-capcut-pro-1y',
  'capcut-pro': 'cr-capcut-pro-1y',
  'creative-capcut-6m': 'cr-capcut-pro-1y',
  'creative-capcut-1m': 'cr-capcut-pro-1y',
  'creative-capcut-7d': 'cr-capcut-pro-1y',
  'adobe': 'cr-adobe-all-apps',
  'adobe-cc': 'cr-adobe-all-apps',
  'creative-suite-full': 'cr-adobe-all-apps',
  'creative-adobe-express-1y': 'cr-adobe-all-apps',
  'figma': 'cr-figma-pro',
  'creative-figma-pro-1y': 'cr-figma-pro',

  // Office & Productivity
  'office': 'of-microsoft-365',
  'office-365': 'of-microsoft-365',
  'office-tools-full': 'of-microsoft-365',
  'microsoft-365': 'of-microsoft-365',
  'notion': 'of-notion-plus',
  'notion-plus': 'of-notion-plus',
  'office-notion-biz-1y': 'of-notion-plus',
  'office-notion-plus-1y': 'of-notion-plus',
  'zoom': 'of-zoom-pro-1m',
  'zoom-pro': 'of-zoom-pro-1m',
  'office-zoom-pro-1m': 'of-zoom-pro-1m',
  'coursera': 'of-coursera-plus',
  'coursera-plus': 'of-coursera-plus',
  'office-coursera-1y': 'of-coursera-plus',
  'linkedin': 'of-linkedin-learning',
  'linkedin-learning': 'of-linkedin-learning',
  'office-linkedin-career-3m': 'of-linkedin-learning',

  // Streaming & Media
  'youtube': 'st-youtube-premium-1y',
  'youtube-prem': 'st-youtube-premium-1y',
  'youtube-premium': 'st-youtube-premium-1y',
  'streaming-yt-3m': 'st-youtube-premium-1y',
  'streaming-yt-1m': 'st-youtube-premium-6m',
  'spotify': 'st-spotify-1y',
  'spotify-premium': 'st-spotify-1y',
  'streaming-spotify-3m': 'st-spotify-1y',
  'apple-music': 'st-apple-music-3m',
  'streaming-apple-music-5m': 'st-apple-music-3m',
  'prime-video': 'st-prime-video-6m',
  'amazon-prime': 'st-prime-video-6m',
  'streaming-amazon-prime-6m': 'st-prime-video-6m',

  // Gaming & Security
  'discord': 'gm-discord-nitro-1y',
  'discord-nitro': 'gm-discord-nitro-1y',
  'gaming-pass-main': 'gm-discord-nitro-1y',
  'nordvpn': 'gm-nordvpn-1y',
  'gaming-nordvpn-3m': 'gm-nordvpn-1y',
  'protonvpn': 'gm-protonvpn-1y',
  'gaming-protonvpn-1m': 'gm-protonvpn-1y'
};

function resolveCanonicalProductId(rawId) {
  if (!rawId || typeof rawId !== 'string') return '';
  const trimmed = rawId.trim().toLowerCase();
  const mapped = CANONICAL_PRODUCT_SLUG_MAP[trimmed] || rawId.trim();
  return AUTHORIZED_PRODUCT_SET.has(mapped) ? mapped : '';
}
window.NexaResolveCanonicalProductId = resolveCanonicalProductId;

// 2. Raw Live Seed from Production Database (Authorized Products Only)
const RAW_SUPABASE_CATALOG = [
  {
    "id": "ai-gemini-18m",
    "name": "Google Gemini Advanced 18M",
    "category_id": "ai",
    "duration": "18 شهر",
    "price_egp": 120.00,
    "price_usd": 1.50,
    "is_featured": true,
    "image": "logos/gemini.webp",
    "featured_image": "logos/gemini.webp",
    "rating": 4.80,
    "rating_count": "1.5K",
    "description": "حساب جيميني أدفانسد العملاق بسعة نافذة سياق 1M توكنز و2 تيرابايت مساحة سحابية.",
    "specs": [
      "نموذج Gemini 1.5 Pro فائق السرعة",
      "نافذة سياق ضخمة لتحليل الكتب والأفلام",
      "مساحة Google One السحابية 2TB",
      "تسليم فوري وتفعيل مباشر"
    ],
    "full_desc": "اشتراك Gemini Advanced لمدة 18 شهراً مع مساحة تخزين 2TB سحابية.",
    "activation_guide": "1. نرسل لك بيانات الحساب الرسمي المجهز.\\n2. ابدأ الاستخدام مباشرة على gemini.google.com.",
    "delivery_instructions": "بيانات الحساب تصلك فور تأكيد الدفع.",
    "warranty": "ضمان طوال 18 شهر.",
    "is_active": true,
    "is_archived": false,
    "display_order": 1,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-10T00:05:28.379247+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "ai-chatgpt-plus",
    "name": "ChatGPT Plus 1M",
    "category_id": "ai",
    "duration": "1 شهر",
    "price_egp": 1400.00,
    "price_usd": 18.00,
    "is_featured": false,
    "image": "logos/chatgpt-plus.webp",
    "featured_image": "logos/chatgpt-plus.webp",
    "rating": 4.90,
    "rating_count": "2.3K",
    "description": "اشتراك شات جي بي تي بلس الرسمي يدعم GPT-4o وتوليد الصور عبر DALL-E بلا حدود.",
    "specs": [
      "وصول غير محدود لنموذج GPT-4o و GPT-4",
      "توليد وتعديل الصور فائقة الدقة بـ DALL-E 3",
      "تحليل ملفات البيانات والبرمجة المتقدمة",
      "تفعيل رسمي وضمان كامل طوال الشهر"
    ],
    "full_desc": "اشتراك ChatGPT Plus الرسمي بحساب خاص مجهز، وصول غير محدود لكل المزايا المتقدمة.",
    "activation_guide": "1. نرسل لك بيانات الدخول عبر واتساب والإيميل.\\n2. سجل الدخول مباشرة على chatgpt.com واستمتع بكافة المزايا.",
    "delivery_instructions": "تسليم فوري ومباشر إلى بريدك الإلكتروني والواتساب المسجل بالطلب.",
    "warranty": "ضمان طوال مدة الاشتراك.",
    "is_active": true,
    "is_archived": false,
    "display_order": 1,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-10T00:07:17.29448+00:00",
    "stock_type": "limited",
    "quantity_available": 21,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "ai-perplexity-pro",
    "name": "Perplexity PRO 12M",
    "category_id": "ai",
    "duration": "1 سنة",
    "price_egp": 1500.00,
    "price_usd": 30.00,
    "is_featured": false,
    "image": "logos/perplexity.webp",
    "featured_image": "logos/perplexity.webp",
    "rating": 4.90,
    "rating_count": "980",
    "description": "محرك البحث الذكي الشامل، يجمع بين كل نماذج الذكاء الاصطناعي في منصة واحدة.",
    "specs": [
      "أكثر من 300 بحث Pro يومياً",
      "اختيار النموذج (Claude 3.5 Sonnet, GPT-4o)",
      "رفع وتحليل ملفات PDF والمستندات بلا حدود",
      "تفعيل سنوي رسمي مع ضمان"
    ],
    "full_desc": "محرك البحث الذكي الشامل لجميع نماذج الذكاء الاصطناعي مع وصول سنوي Pro.",
    "activation_guide": "1. نرسل لك كود أو رابط تفعيل الاشتراك السنوي.\\n2. قم بالربط بحسابك مباشرة.",
    "delivery_instructions": "يتم إرسال رابط التفعيل الفوري مع الشرح المرئي.",
    "warranty": "ضمان رسمي لمدة سنة كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 2,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "ai-gemini-3m",
    "name": "Google Gemini Advanced 3M",
    "category_id": "ai",
    "duration": "3 شهور",
    "price_egp": 120.00,
    "price_usd": 2.40,
    "is_featured": false,
    "image": "logos/gemini.webp",
    "featured_image": "logos/gemini.webp",
    "rating": 4.80,
    "rating_count": "620",
    "description": "باقة جيميني أدفانسد لمدة 3 شهور جاهزة للاستخدام الفوري.",
    "specs": [
      "Gemini Advanced 1.5 Pro",
      "سرعة استجابة فائقة",
      "دعم كامل للغة العربية والإنجليزية",
      "تسليم فوري"
    ],
    "full_desc": "اشتراك Gemini Advanced لمدة 3 شهور.",
    "activation_guide": "1. استلم الحساب فورا عبر واتساب.\\n2. سجل دخولك على جوجل.",
    "delivery_instructions": "تسليم فوري عبر الواتساب والإيميل.",
    "warranty": "ضمان استبدال فوري طوال الـ 3 شهور.",
    "is_active": true,
    "is_archived": false,
    "display_order": 4,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "cr-capcut-pro-1y",
    "name": "CapCut Pro 1 Year",
    "category_id": "creative",
    "duration": "1 سنة",
    "price_egp": 360.00,
    "price_usd": 7.20,
    "is_featured": true,
    "image": "logos/capcut-pro.webp",
    "featured_image": "logos/capcut-pro.webp",
    "rating": 4.90,
    "rating_count": "5.4K",
    "description": "الاشتراك الأقوى لصناع المحتوى ومحرري الفيديو، تفعيل سنوي رسمي بكافة الميزات.",
    "specs": [
      "تصدير بدقة 4K 60FPS بدون علامة مائية",
      "جميع القوالب والتأثيرات الصوتية والذكاء الاصطناعي Pro",
      "توليد نصوص وترجمة تلقائية فائقة الدقة",
      "يعمل على الهاتف، الكمبيوتر والويب"
    ],
    "full_desc": "اشتراك CapCut Pro السنوي لإنتاج مقاطع الفيديو باحترافية.",
    "activation_guide": "1. نرسل لك بيانات الحساب المجهز.\\n2. سجل الدخول في تطبيق CapCut على الهاتف أو الكمبيوتر.",
    "delivery_instructions": "تصلك بيانات الحساب فورا عبر واتساب والإيميل.",
    "warranty": "ضمان استبدال فوري لمدة سنة كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 7,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "cr-adobe-all-apps",
    "name": "Adobe Creative Cloud All Apps 1M",
    "category_id": "creative",
    "duration": "1 شهر",
    "price_egp": 1550.00,
    "price_usd": 31.00,
    "is_featured": false,
    "image": "logos/adobe-cc.webp",
    "featured_image": "logos/adobe-cc.webp",
    "rating": 4.90,
    "rating_count": "4.2K",
    "description": "الحزمة الإبداعية الكاملة تضم Photoshop, Illustrator, Premiere, After Effects والمزيد.",
    "specs": [
      "أكثر من 20 تطبيق إبداعي رسمي أصلي",
      "100GB مساحة سحابية و Adobe Fonts",
      "تحديثات مستمرة من السحابة مباشرة",
      "تفعيل على حسابك الشخصي أو حساب جاهز"
    ],
    "full_desc": "الحزمة الكاملة لكافة برامج أدوبي الإبداعية الأصلية.",
    "activation_guide": "1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\\n2. حمل البرامج من Adobe Creative Cloud الرسمي.",
    "delivery_instructions": "تفعيل مباشر على بريدك أو تسليم فوري لحساب جاهز.",
    "warranty": "ضمان رسمي كامل طوال الشهر.",
    "is_active": true,
    "is_archived": false,
    "display_order": 9,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "cr-figma-pro",
    "name": "Figma Professional 1 Year",
    "category_id": "creative",
    "duration": "1 سنة",
    "price_egp": 450.00,
    "price_usd": 9.00,
    "is_featured": false,
    "image": "logos/figma.webp",
    "featured_image": "logos/figma.webp",
    "rating": 4.80,
    "rating_count": "1.1K",
    "description": "اشتراك فيجما للمصممين المحترفين وفرق العمل، مشاريع ومكتبات غير محدودة.",
    "specs": [
      "مشاريع وتصاميم غير محدودة",
      "مكتبات مكونات Team Libraries مشتركة",
      "تاريخ نسخ غير محدود للملفات",
      "تفعيل سنوي مضمون"
    ],
    "full_desc": "اشتراك فيجما برو السنوي لتصميم واجهات المستخدم UI/UX.",
    "activation_guide": "1. دعوة رسمية لحسابك الخاص.\\n2. وصول غير محدود لكل خصائص Pro.",
    "delivery_instructions": "دعوة رسمية إلى بريدك المسجل في فيجما.",
    "warranty": "ضمان سنوي كامل.",
    "is_active": true,
    "is_archived": false,
    "display_order": 10,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "of-microsoft-365",
    "name": "Microsoft 365 Family / Pro 1Y",
    "category_id": "office",
    "duration": "1 سنة",
    "price_egp": 270.00,
    "price_usd": 5.40,
    "is_featured": true,
    "image": "logos/office-365.webp",
    "featured_image": "logos/office-365.webp",
    "rating": 4.90,
    "rating_count": "8.9K",
    "description": "باقة أوفيس 365 الرسمية مع Word, Excel, PowerPoint و 1TB تخزين OneDrive سحابي.",
    "specs": [
      "Word, Excel, PowerPoint, Outlook",
      "1 تيرابايت مساحة تخزين ون درايف آمنة",
      "يعمل على 5 أجهزة (ويندوز، ماك، آيفون، أندرويد)",
      "تحديثات أمنية ورسمية مستمرة"
    ],
    "full_desc": "حزمة ميكروسوفت أوفيس 365 الرسمية لمدة عام كامل مع 1TB OneDrive.",
    "activation_guide": "1. نرسل لك كود تفعيل أو بيانات الحساب الرسمي.\\n2. ادخل على setup.office.com وحمل التطبيقات.",
    "delivery_instructions": "تصلك بيانات الحساب أو كود التفعيل عبر الواتساب.",
    "warranty": "ضمان رسمي لمدة سنة كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 11,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "of-notion-plus",
    "name": "Notion Plus 1 Year",
    "category_id": "office",
    "duration": "1 سنة",
    "price_egp": 240.00,
    "price_usd": 4.80,
    "is_featured": false,
    "image": "logos/notion.webp",
    "featured_image": "logos/notion.webp",
    "rating": 4.90,
    "rating_count": "2.1K",
    "description": "منصة تنظيم العمل والملاحظات وإدارة المشاريع الأكثر إنتاجية عالمياً.",
    "specs": [
      "صفحات وبلوكات غير محدودة",
      "مزامنة سريعة ودعم رفع ملفات بحجم غير محدود",
      "Notion AI متقدم لتلخيص وتوليد النصوص",
      "تفعيل سنوي رسمي"
    ],
    "full_desc": "اشتراك نوشن بلس السنوي لإدارة المشاريع وملاحظات العمل.",
    "activation_guide": "1. دعوة مباشرة على إيميلك المسجل في نوشن.\\n2. تفعيل تلقائي فوري.",
    "delivery_instructions": "دعوة سريعة إلى إيميلك المسجل في نوشن.",
    "warranty": "ضمان رسمي لمدة عام كامل.",
    "is_active": true,
    "is_archived": false,
    "display_order": 12,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "of-zoom-pro-1m",
    "name": "Zoom Pro 1 Month",
    "category_id": "office",
    "duration": "1 شهر",
    "price_egp": 270.00,
    "price_usd": 5.40,
    "is_featured": false,
    "image": "logos/zoom.webp",
    "featured_image": "logos/zoom.webp",
    "rating": 4.70,
    "rating_count": "750",
    "description": "اشتراك زووم برو للاجتماعات غير المحدودة حتى 30 ساعة وبسعة 100 مشارك.",
    "specs": [
      "اجتماعات حتى 30 ساعة متواصلة",
      "سعة حتى 100 مشارك",
      "تسجيل سحابي على سيرفرات زووم 5GB",
      "بث مباشر عبر YouTube و Facebook"
    ],
    "full_desc": "اشتراك زووم برو الشهري للاجتماعات والمحاضرات بدون انقطاع.",
    "activation_guide": "1. تفعيل على إيميلك الشخصي أو تسليم حساب مجهز.\\n2. ابدأ اجتماعاتك بلا حدود.",
    "delivery_instructions": "تفعيل فوري على حسابك أو حساب جديد مجهز.",
    "warranty": "ضمان كامل طوال الشهر.",
    "is_active": true,
    "is_archived": false,
    "display_order": 13,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "of-coursera-plus",
    "name": "Coursera Plus 1 Year",
    "category_id": "office",
    "duration": "1 سنة",
    "price_egp": 750.00,
    "price_usd": 15.00,
    "is_featured": false,
    "image": "logos/coursera.webp",
    "featured_image": "logos/coursera.webp",
    "rating": 4.90,
    "rating_count": "1.4K",
    "description": "وصول غير محدود لأكثر من 7,000 دورة تدريبية وشهادة مهنية معتمدة من كبرى الجامعات.",
    "specs": [
      "وصول لكافة كورسات Google و Meta و IBM",
      "شهادات إتمام رسمية معتمدة لكل كورس",
      "مشاريع عملية موجهة Guided Projects",
      "تفعيل على حسابك الشخصي"
    ],
    "full_desc": "اشتراك كورسيرا بلس السنوي لتعلم وتطوير المهارات مع شهادات موثقة.",
    "activation_guide": "1. دعوة رسمية لحسابك في كورسيرا.\\n2. ابدأ التعلم والحصول على الشهادات فورا.",
    "delivery_instructions": "دعوة فورية على حسابك بـ Coursera.",
    "warranty": "ضمان رسمي لمدة عام كامل.",
    "is_active": true,
    "is_archived": false,
    "display_order": 14,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "of-linkedin-learning",
    "name": "LinkedIn Learning 1 Year",
    "category_id": "office",
    "duration": "1 سنة",
    "price_egp": 540.00,
    "price_usd": 10.80,
    "is_featured": false,
    "image": "logos/linkedin-learning.webp",
    "featured_image": "logos/linkedin-learning.webp",
    "rating": 4.80,
    "rating_count": "920",
    "description": "أكبر مكتبة دورات تدريبية للأعمال والتقنية مع إضافة الشارات مباشرة لملفك الشخصي.",
    "specs": [
      "أكثر من 20,000 دورة تدريبية احترافية",
      "إضافة الشهادات تلقائيا لملفك في لينكد إن",
      "تمارين تدريبية وملفات قابلة للتحميل",
      "تفعيل سنوي مضمون"
    ],
    "full_desc": "اشتراك لينكد إن ليرنينج السنوي لاكتساب مهارات القيادة والبرمجة والتسويق.",
    "activation_guide": "1. تفعيل على إيميلك الشخصي في لينكد إن.\\n2. تصفح وحمل الدورات من التطبيق أو الويب.",
    "delivery_instructions": "تفعيل رسمي على حساب لينكد إن.",
    "warranty": "ضمان لمدة سنة كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 15,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "st-youtube-premium-1y",
    "name": "YouTube Premium 1 Year",
    "category_id": "streaming",
    "duration": "1 سنة",
    "price_egp": 360.00,
    "price_usd": 7.20,
    "is_featured": true,
    "image": "logos/youtube-premium.webp",
    "featured_image": "logos/youtube-premium.webp",
    "rating": 4.90,
    "rating_count": "18.5K",
    "description": "تصفح يوتيوب بدون أي إعلانات، مع تشغيل بالخلفية وتطبيق YouTube Music كامل.",
    "specs": [
      "مشاهدة خالية تماماً من الإعلانات",
      "تشغيل الفيديوهات في الخلفية وعند قفل الشاشة",
      "تحميل الفيديوهات لمشاهدتها بدون إنترنت",
      "اشتراك كامل في YouTube Music"
    ],
    "full_desc": "اشتراك يوتيوب بريميوم السنوي الأصلي بدون إعلانات نهائياً.",
    "activation_guide": "1. نرسل لك رابط دعوة عائلية رسمية على إيميلك.\\n2. اقبل الدعوة وسيتفعل فورا على قناتك وحسابك الشخصي.",
    "delivery_instructions": "رابط دعوة عائلية رسمية على بريدك الإلكتروني.",
    "warranty": "ضمان كامل طوال مدة السنة واستبدال فوري عند الحاجة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 16,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "st-youtube-premium-6m",
    "name": "YouTube Premium 6 Months",
    "category_id": "streaming",
    "duration": "6 شهور",
    "price_egp": 225.00,
    "price_usd": 4.50,
    "is_featured": false,
    "image": "logos/youtube-premium.webp",
    "featured_image": "logos/youtube-premium.webp",
    "rating": 4.90,
    "rating_count": "6.3K",
    "description": "يوتيوب بريميوم لمدة 6 شهور بدون إعلانات مع يوتيوب ميوزك.",
    "specs": [
      "بدون إعلانات تماماً",
      "تشغيل بالخلفية بدون توقف",
      "يوتيوب ميوزك الرسمي",
      "تفعيل على إيميلك الخاص"
    ],
    "full_desc": "اشتراك يوتيوب بريميوم لمدة 6 شهور بدون إعلانات.",
    "activation_guide": "1. رابط دعوة رسمي لحسابك.\\n2. تفعيل فوري بدون طلب كلمة المرور.",
    "delivery_instructions": "رابط دعوة سريع إلى حسابك الشخصي.",
    "warranty": "ضمان 6 شهور كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 17,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "st-spotify-1y",
    "name": "Spotify Premium 1 Year",
    "category_id": "streaming",
    "duration": "1 سنة",
    "price_egp": 420.00,
    "price_usd": 8.40,
    "is_featured": false,
    "image": "logos/spotify.webp",
    "featured_image": "logos/spotify.webp",
    "rating": 4.90,
    "rating_count": "9.7K",
    "description": "استمع لملايين الأغاني والبودكاست بأعلى جودة صوتية وبدون أي فواصل إعلانية.",
    "specs": [
      "استماع بدون إعلانات وتخطي لا نهائي للأغاني",
      "تحميل الأغاني للاستماع أوفلاين",
      "أعلى جودة صوتية 320kbps Very High",
      "تفعيل على حسابك الشخصي أو حساب جديد"
    ],
    "full_desc": "اشتراك سبوتيفاي بريميوم السنوي لتجربة موسيقية فائقة النقاء.",
    "activation_guide": "1. رابط انضمام فوري أو حساب مجهز.\\n2. تمتع بقوائمك المفضلة بدون انقطاع.",
    "delivery_instructions": "رابط انضمام أو حساب جاهز عبر الواتساب.",
    "warranty": "ضمان رسمي سنة كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 18,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "st-apple-music-3m",
    "name": "Apple Music 3 Months",
    "category_id": "streaming",
    "duration": "3 شهور",
    "price_egp": 150.00,
    "price_usd": 3.00,
    "is_featured": false,
    "image": "logos/apple-music.webp",
    "featured_image": "logos/apple-music.webp",
    "rating": 4.80,
    "rating_count": "2.8K",
    "description": "بث صوتي فائق الدقة بدون فقدان Lossless Audio مع دعم الصوت المكاني Spatial Audio.",
    "specs": [
      "أكثر من 100 مليون أغنية بدون إعلانات",
      "صوت عالي الدقة Lossless و Dolby Atmos",
      "كلمات الأغاني متزامنة بالوقت الحقيقي",
      "يعمل على آيفون، أندرويد، ويندوز وماك"
    ],
    "full_desc": "اشتراك أبل ميوزك 3 شهور بأعلى نقاء صوتي في العالم.",
    "activation_guide": "1. كود أو دعوة رسمية لحساب Apple ID الخاص بك.\\n2. تفعيل مباشر.",
    "delivery_instructions": "كود أو رابط دعوة رسمي فوري.",
    "warranty": "ضمان 3 شهور كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 19,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "st-prime-video-6m",
    "name": "Amazon Prime Video 6 Months",
    "category_id": "streaming",
    "duration": "6 شهور",
    "price_egp": 180.00,
    "price_usd": 3.60,
    "is_featured": false,
    "image": "logos/prime-video.webp",
    "featured_image": "logos/prime-video.webp",
    "rating": 4.70,
    "rating_count": "3.4K",
    "description": "أضخم مكتبة أفلام ومسلسلات أصلية بدقة 4K HDR مع ترجمة ودبلجة عربية احترافية.",
    "specs": [
      "مشاهدة بدقة 4K UHD و HDR10",
      "أعمال أمازون الأصلية الحصرية The Boys, LOTR",
      "تحميل المشاهدة أوفلاين على الأجهزة الذكية",
      "حساب خاص مجهز بملف شخصي خاص"
    ],
    "full_desc": "اشتراك أمازون برايم فيديو 6 شهور لأفضل الأفلام العالمية والمسلسلات الحصرية.",
    "activation_guide": "1. نرسل لك إيميل وباسورد الحساب الرسمي.\\n2. اختر ملفك واستمتع بالمشاهدة.",
    "delivery_instructions": "إرسال بيانات الحساب الخاص فورا.",
    "warranty": "ضمان طوال 6 شهور.",
    "is_active": true,
    "is_archived": false,
    "display_order": 20,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "gm-discord-nitro-1y",
    "name": "Discord Nitro 1 Year",
    "category_id": "gaming",
    "duration": "1 سنة",
    "price_egp": 1050.00,
    "price_usd": 21.00,
    "is_featured": true,
    "image": "logos/discord-nitro.webp",
    "featured_image": "logos/discord-nitro.webp",
    "rating": 4.90,
    "rating_count": "14.2K",
    "description": "ترقية ديسكورد نيترو الكاملة مع 2 سيرفر بوست واستخدام الإيموجيات في كل مكان.",
    "specs": [
      "2 سيرفر بوست Server Boosts مجاناً شهرياً",
      "مشاركة شاشة بدقة 4K 60FPS فائقة السلاسة",
      "استخدام الإيموجيات والستيكرات المتحركة في أي سيرفر",
      "رفع ملفات ضخمة بحجم يصل إلى 500MB"
    ],
    "full_desc": "اشتراك ديسكورد نيترو الكامل السنوي لمحترفي الألعاب ومطوري السيرفرات.",
    "activation_guide": "1. نرسل لك رابط هدية Nitro Gift رسمي أو كود تفعيل فوري.\\n2. اضغط على الرابط وسيتفعل فورا على حسابك في ديسكورد.",
    "delivery_instructions": "رابط هدية Nitro Gift رسمي يفتح على حسابك فوراً.",
    "warranty": "ضمان رسمي كامل لمدة سنة واستبدال فوري.",
    "is_active": true,
    "is_archived": false,
    "display_order": 21,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "gm-discord-nitro-1m",
    "name": "Discord Nitro 1 Month",
    "category_id": "gaming",
    "duration": "1 شهر",
    "price_egp": 135.00,
    "price_usd": 2.70,
    "is_featured": false,
    "image": "logos/discord-nitro.webp",
    "featured_image": "logos/discord-nitro.webp",
    "rating": 4.90,
    "rating_count": "8.7K",
    "description": "ديسكورد نيترو الكامل لمدة شهر مع بوستين وشاشة 4K.",
    "specs": [
      "2 سيرفر بوست مجاناً",
      "بث شاشة 4K 60FPS",
      "شارة Nitro الحصرية للملف الشخصي",
      "إيموجيات في كل مكان"
    ],
    "full_desc": "اشتراك ديسكورد نيترو الشهري.",
    "activation_guide": "1. رابط تفعيل مباشر على حسابك.\\n2. تفعيل في ثوان معدودة.",
    "delivery_instructions": "رابط تفعيل فوري سريع.",
    "warranty": "ضمان كامل طوال الشهر.",
    "is_active": true,
    "is_archived": false,
    "display_order": 22,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "gm-nordvpn-1y",
    "name": "NordVPN 1 Year",
    "category_id": "gaming",
    "duration": "1 سنة",
    "price_egp": 240.00,
    "price_usd": 4.80,
    "is_featured": false,
    "image": "logos/nordvpn.webp",
    "featured_image": "logos/nordvpn.webp",
    "rating": 4.90,
    "rating_count": "5.6K",
    "description": "أسرع وأقوى شبكة VPN في العالم لحماية خصوصيتك وفتح المواقع المحجوبة وتقليل البنج.",
    "specs": [
      "أكثر من 6000 سيرفر فائق السرعة في 111 دولة",
      "تشفير عسكري من الدرجة الأولى وحظر الإعلانات",
      "حماية من التهديدات Threat Protection",
      "يعمل على 6 أجهزة في نفس الوقت"
    ],
    "full_desc": "اشتراك NordVPN السنوي لتأمين اتصالك وفتح المحتوى العالمي بدون قيود.",
    "activation_guide": "1. حساب رسمي مفعل باشتراك سنوي مدفوع.\\n2. سجل الدخول في تطبيق NordVPN على أي جهاز.",
    "delivery_instructions": "بيانات الحساب الرسمي ترسل فورا.",
    "warranty": "ضمان استبدال فوري لمدة سنة كاملة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 23,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "gm-protonvpn-1y",
    "name": "ProtonVPN Plus 1 Year",
    "category_id": "gaming",
    "duration": "1 سنة",
    "price_egp": 285.00,
    "price_usd": 5.70,
    "is_featured": false,
    "image": "logos/protonvpn.webp",
    "featured_image": "logos/protonvpn.webp",
    "rating": 4.80,
    "rating_count": "2.3K",
    "description": "شبكة VPN سويسرية فائقة الأمان مع سياسة صارمة لعدم حفظ السجلات وسرعات تصل لـ 10Gbps.",
    "specs": [
      "سيرفرات سويسرية فائقة الخصوصية Secure Core",
      "سرعات خارقة تصل إلى 10Gbps مع ميزة VPN Accelerator",
      "حماية NetShield ضد الإعلانات والبرمجيات الخبيثة",
      "يدعم التورنت والستريمنج P2P"
    ],
    "full_desc": "اشتراك بروتون في بي إن بلس السنوي لحرية وخصوصية مطلقة على الإنترنت.",
    "activation_guide": "1. حساب مجهز باشتراك رسمي مدفوع.\\n2. اتصل فورا بأقوى السيرفرات السويسرية.",
    "delivery_instructions": "تسليم بيانات الحساب السويسري المجهز.",
    "warranty": "ضمان رسمي كامل لمدة سنة.",
    "is_active": true,
    "is_archived": false,
    "display_order": 24,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "ai-elevenlabs-starter",
    "name": "ElevenLabs Starter 1M",
    "category_id": "ai",
    "duration": "1 شهر",
    "price_egp": 360.00,
    "price_usd": 7.20,
    "is_featured": false,
    "image": "Robot_head_floating_above_platform_2K_20261008041722.jpg",
    "featured_image": "Robot_head_floating_above_platform_2K_20261008041722.jpg",
    "rating": 4.90,
    "rating_count": "1.9K",
    "description": "أقوى تقنية تحويل النص إلى صوت بشري واقعي واستنساخ الأصوات بدقة استثنائية.",
    "specs": [
      "30,000 حرف شهرياً من الصوت البشري فائق الواقعية",
      "إنشاء واستنساخ حتى 10 أصوات مخصصة",
      "ترجمة صوتية احترافية مع الحفاظ على نبرة الصوت الأصلي",
      "حقوق الاستخدام التجاري الكاملة"
    ],
    "full_desc": "اشتراك ElevenLabs الرسمي لتوليد الدوبلاج والتعليق الصوتي الاحترافي.",
    "activation_guide": "1. حساب رسمي مجهز بباقة Starter.\\n2. ادخل وابدأ توليد أصوات احترافية ومقاطع بودكاست.",
    "delivery_instructions": "إرسال بيانات الحساب المجهز مباشرة.",
    "warranty": "ضمان كامل طوال الشهر.",
    "is_active": true,
    "is_archived": false,
    "display_order": 27,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  },
  {
    "id": "ai-runway-gen3",
    "name": "Runway Gen-3 Alpha 1M",
    "category_id": "ai",
    "duration": "1 شهر",
    "price_egp": 1050.00,
    "price_usd": 21.00,
    "is_featured": false,
    "image": "Enhancing_image_without_text_2K_20261008033420.jpg",
    "featured_image": "Enhancing_image_without_text_2K_20261008033420.jpg",
    "rating": 4.90,
    "rating_count": "1.4K",
    "description": "المنصة السينمائية الرائدة عالمياً لتوليد وتحريك مقاطع الفيديو الواقعية بالذكاء الاصطناعي.",
    "specs": [
      "625 كريدت شهرياً لتوليد فيديوهات فائقة الجودة",
      "وصول لأقوى نموذج Gen-3 Alpha Cinematic",
      "إزالة العلامة المائية ودقة تصدير 4K سينمائية",
      "أدوات تحكم بحركة الكاميرا Motion Brush"
    ],
    "full_desc": "اشتراك Runway Gen-3 الرسمي لإنتاج المشاهد السينمائية والإعلانية.",
    "activation_guide": "1. حساب رسمي مفعل وجاهز للاستخدام الفوري.\\n2. انطلق في توليد الفيديو مباشرة.",
    "delivery_instructions": "تسليم بيانات الحساب السريع.",
    "warranty": "ضمان كامل طوال مدة الاشتراك.",
    "is_active": true,
    "is_archived": false,
    "display_order": 28,
    "created_at": "2026-10-09T21:16:27.450174+00:00",
    "updated_at": "2026-10-09T21:16:27.450174+00:00",
    "stock_type": "unlimited",
    "quantity_available": 100,
    "low_stock_threshold": 5,
    "is_paused": false,
    "stock_status": "in_stock"
  }
];

const DEFAULT_PRODUCTS = RAW_SUPABASE_CATALOG.map(p => {
  const cat = p.category_id || p.category || 'ai';
  const catName = cat === 'ai' ? 'أدوات الذكاء الاصطناعي' :
                  cat === 'creative' ? 'البرامج الإبداعية والتصميم' :
                  cat === 'office' ? 'برامج المكتب والإنتاجية' :
                  cat === 'streaming' ? 'الترفيه والاشتراكات' : 'الألعاب والبطاقات والحماية';

  let img = p.image || p.featured_image;
  if (!img || img.includes('Robot_head') || img.includes('CARD') || img.includes('Enhancing') || img.includes('Removing') || img.includes('Image_enhancement')) {
    if (p.id === 'ai-elevenlabs-starter') img = 'logos/elevenlabs.webp';
    else if (p.id === 'ai-runway-gen3') img = 'logos/runway-pro.webp';
    else img = 'logos/Activkeyzmainlogo.png';
  }

  return {
    id: p.id,
    name: p.name,
    category: cat,
    catName: catName,
    duration: p.duration,
    priceEgp: Number(p.price_egp || p.priceEgp || 0),
    priceUsd: Number(p.price_usd || p.priceUsd || 0),
    isFeatured: Boolean(p.is_featured),
    isActive: p.is_active !== false,
    isArchived: false,
    displayOrder: p.display_order || 0,
    image: img,
    featuredImage: img,
    rating: Number(p.rating) || 4.9,
    ratingCount: String(p.rating_count || '100+'),
    desc: p.description || p.desc || '',
    specs: Array.isArray(p.specs) ? p.specs : [],
    fullDesc: p.full_desc || p.fullDesc || '',
    activationGuide: p.activation_guide || p.activationGuide || '',
    deliveryInstructions: p.delivery_instructions || p.deliveryInstructions || '',
    warranty: p.warranty || '',
    stockStatus: p.stock_status || 'in_stock',
    inventory: {
      stockType: p.stock_type || 'unlimited',
      available: p.quantity_available !== undefined ? p.quantity_available : 100,
      threshold: p.low_stock_threshold || 5,
      isPaused: Boolean(p.is_paused)
    }
  };
});

// 3. Official Category Configurations (Only Approved Products Mentioned)
const CATEGORIES_CONFIG = {
  ai: {
    id: 'ai',
    name: 'أدوات الذكاء الاصطناعي',
    nameEn: 'AI Assistant Pro',
    sub: 'مساعد الذكاء الاصطناعي والأتمتة',
    desc: 'ChatGPT Plus · Gemini · Perplexity · ElevenLabs',
    icon: 'fa-solid fa-wand-magic-sparkles',
    badge: 'الأكثر طلباً',
    image: 'logos/chatgpt-plus.webp',
    accentColor: '#00d2ff',
    url: 'category.html?cat=ai'
  },
  creative: {
    id: 'creative',
    name: 'البرامج الإبداعية والتصميم',
    nameEn: 'Creative Suite',
    sub: 'مجموعة المونتاج والتصميم الاحترافي',
    desc: 'CapCut Pro · Adobe Creative Cloud · Figma Pro',
    icon: 'fa-solid fa-palette',
    badge: 'للمصممين',
    image: 'logos/capcut-pro.webp',
    accentColor: '#f43f5e',
    url: 'category.html?cat=creative'
  },
  office: {
    id: 'office',
    name: 'برامج المكتب والإنتاجية',
    nameEn: 'Office Tools',
    sub: 'حزم الأعمال والشركات المعتمدة',
    desc: 'Microsoft 365 · Notion · Zoom Pro · Coursera',
    icon: 'fa-solid fa-border-all',
    badge: 'للشركات والأفراد',
    image: 'logos/office-365.webp',
    accentColor: '#38bdf8',
    url: 'category.html?cat=office'
  },
  streaming: {
    id: 'streaming',
    name: 'الترفيه والاشتراكات',
    nameEn: 'Streaming Bundle',
    sub: 'باقة الترفيه والمحتوى اللامحدود',
    desc: 'YouTube Premium · Spotify · Apple Music · Prime Video',
    icon: 'fa-solid fa-play',
    badge: 'الترفيه والبث',
    image: 'logos/youtube-premium.webp',
    accentColor: '#e11d48',
    url: 'category.html?cat=streaming'
  },
  gaming: {
    id: 'gaming',
    name: 'الألعاب والبطاقات والحماية',
    nameEn: 'Gaming Pass & Security',
    sub: 'اشتراكات الاتصال الآمن والمجتمعات',
    desc: 'Discord Nitro · NordVPN · ProtonVPN',
    icon: 'fa-solid fa-shield-halved',
    badge: 'ألعاب وحماية',
    image: 'logos/discord-nitro.webp',
    accentColor: '#10b981',
    url: 'category.html?cat=gaming'
  }
};

const PRIMARY_STORAGE_KEY = 'nexa_products_catalog_canonical_v5';
const LEGACY_STORAGE_KEY = 'nexa_products_catalog_v5';

try {
  localStorage.removeItem('nexa_products_catalog_canonical_v1');
  localStorage.removeItem('nexa_products_catalog_v2');
  localStorage.removeItem('nexa_products_catalog_canonical_v3');
  localStorage.removeItem('nexa_products_catalog_canonical_v4');
} catch (e) {}

const WIN1252_MAP = {
  0x20AC: 0x80, 0x0081: 0x81, 0x201A: 0x82, 0x0192: 0x83,
  0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B,
  0x0152: 0x8C, 0x008D: 0x8D, 0x017D: 0x8E, 0x008F: 0x8F,
  0x0090: 0x90, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x009D: 0x9D, 0x017E: 0x9E, 0x0178: 0x9F
};

function fixArabicMojibake(str) {
  if (typeof str !== 'string' || !str) return str;
  if (!/[\u00C0-\u00FF]/.test(str)) return str;
  try {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (WIN1252_MAP[code] !== undefined) {
        bytes.push(WIN1252_MAP[code]);
      } else if (code <= 0xFF) {
        bytes.push(code);
      } else {
        return str;
      }
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch (e) {
    return str;
  }
}
window.fixArabicMojibake = fixArabicMojibake;

function cleanArabicObj(val) {
  if (typeof val === 'string') return fixArabicMojibake(val);
  if (Array.isArray(val)) return val.map(cleanArabicObj);
  return val;
}

function normalizeProduct(p) {
  if (!p || !p.id || !AUTHORIZED_PRODUCT_SET.has(p.id)) return null;
  const clone = Object.assign({}, p);
  clone.name = cleanArabicObj(clone.name || clone.title);
  clone.duration = cleanArabicObj(clone.duration);
  clone.desc = cleanArabicObj(clone.desc || clone.description);
  clone.description = clone.desc;
  clone.fullDesc = cleanArabicObj(clone.fullDesc || clone.full_desc);
  clone.warranty = cleanArabicObj(clone.warranty);
  clone.deliveryInstructions = cleanArabicObj(clone.deliveryInstructions || clone.delivery_instructions || 'سيتم إرسال بيانات الاشتراك والتفعيل مباشرة إلى بريدك الإلكتروني فور إتمام الدفع.');
  clone.activationGuide = cleanArabicObj(clone.activationGuide || clone.activation_guide);
  if (Array.isArray(clone.features)) clone.features = clone.features.map(cleanArabicObj);
  if (Array.isArray(clone.specs)) clone.specs = clone.specs.map(cleanArabicObj);

  const canonicalCatNames = {
    'ai': 'أدوات الذكاء الاصطناعي',
    'creative': 'البرامج الإبداعية والتصميم',
    'office': 'برامج المكتب والإنتاجية',
    'streaming': 'الترفيه والاشتراكات',
    'gaming': 'الألعاب والبطاقات والحماية'
  };
  clone.category = clone.category || clone.category_id || 'ai';
  clone.catName = canonicalCatNames[clone.category] || cleanArabicObj(clone.catName) || 'أدوات الذكاء الاصطناعي';

  clone.priceEgp = Number(clone.priceEgp || clone.price_egp || 0);
  clone.priceUsd = Number(clone.priceUsd || clone.price_usd || (clone.priceEgp / 50));
  clone.deliveryMethod = clone.deliveryMethod || clone.delivery_method || 'email';
  clone.requiredFields = Array.isArray(clone.requiredFields) ? clone.requiredFields : (Array.isArray(clone.required_fields) ? clone.required_fields : ['recipient_email']);
  if (!clone.image && window.NexaResolveProductImage) clone.image = window.NexaResolveProductImage(clone);
  return clone;
}

function getProductsCatalog() {
  try {
    const raw = localStorage.getItem(PRIMARY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .filter(p => p && p.id && AUTHORIZED_PRODUCT_SET.has(p.id) && p.isActive !== false && p.is_active !== false)
          .map(normalizeProduct)
          .filter(Boolean);
        if (valid.length > 0) return valid;
      }
    }
  } catch (e) {
    console.warn('Error reading cached catalog, using defaults:', e);
  }
  saveProductsCatalog(DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS.map(normalizeProduct).filter(Boolean);
}

function saveProductsCatalog(products) {
  try {
    const clean = Array.isArray(products) ? products.filter(p => p && p.id && AUTHORIZED_PRODUCT_SET.has(p.id)) : DEFAULT_PRODUCTS;
    localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(clean));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('nexaProductsUpdated', { detail: clean }));
  } catch (e) {
    console.warn('Error saving products to storage:', e);
  }
}

// Global NexaDB Export
window.NexaDB = {
  getAll: getProductsCatalog,
  getById: function (id) {
    if (!id) return null;
    const canonicalId = resolveCanonicalProductId(id);
    const list = getProductsCatalog();
    return list.find(p => p.id === canonicalId || p.id === id) || null;
  },
  getByCategory: function (cat) {
    const list = getProductsCatalog();
    if (!cat || cat === 'all') return list;
    return list.filter(p => p.category === cat);
  },
  getRelated: function (productId, limit = 4) {
    const canonicalId = resolveCanonicalProductId(productId);
    const list = getProductsCatalog();
    const current = list.find(p => p.id === canonicalId || p.id === productId);
    if (!current) return list.slice(0, limit);
    const sameCat = list.filter(p => p.category === current.category && p.id !== current.id);
    if (sameCat.length >= limit) return sameCat.slice(0, limit);
    const others = list.filter(p => p.id !== current.id && !sameCat.some(s => s.id === p.id));
    return [...sameCat, ...others].slice(0, limit);
  },
  getCategories: function () {
    return CATEGORIES_CONFIG;
  },
  resolveCanonicalId: resolveCanonicalProductId,
  isAuthorized: function (id) {
    return AUTHORIZED_PRODUCT_SET.has(id);
  }
};
window.ActivKeyzDB = window.NexaDB;

// -------------------------------------------------------------------
// UNIFIED GLOBAL STORE CURRENCY CONTROLLER (EGP / SAR / USD)
// -------------------------------------------------------------------
(function() {
  const DEFAULT_CURRENCY = 'EGP';
  window.NEXA_CURRENCY = localStorage.getItem('nexa_currency') || DEFAULT_CURRENCY;

  window.getNexaCurrency = function() {
    return window.NEXA_CURRENCY || 'EGP';
  };

  window.setNexaCurrency = function(curr) {
    if (curr !== 'EGP' && curr !== 'SAR' && curr !== 'USD') curr = 'EGP';
    window.NEXA_CURRENCY = curr;
    try {
      localStorage.setItem('nexa_currency', curr);
    } catch (e) {}
    
    // Update labels in headers across DOM
    document.querySelectorAll('.current-currency-text, #currentCurrencyLabel').forEach(el => {
      el.textContent = curr === 'SAR' ? 'ر.س' : (curr === 'USD' ? '$' : 'ج.م');
    });
    document.querySelectorAll('.currency-choice').forEach(el => {
      el.classList.toggle('active', el.dataset.currency === curr);
    });

    // Notify active page to re-render
    if (typeof window.onCurrencyChange === 'function') {
      window.onCurrencyChange(curr);
    }
    window.dispatchEvent(new CustomEvent('nexa-currency-changed', { detail: { currency: curr } }));
  };

  window.formatNexaPrice = function(egpPrice) {
    const curr = window.NEXA_CURRENCY || 'EGP';
    const egp = Number(egpPrice) || 0;
    if (curr === 'SAR') {
      // 1 SAR = 13.333 EGP (1 EGP = 0.075 SAR)
      const sar = Math.round(egp * 0.075);
      return { amount: sar, formatted: sar.toLocaleString(), unit: 'ر.س', full: `${sar.toLocaleString()} ر.س` };
    } else if (curr === 'USD') {
      const usd = (egp / 50).toFixed(2);
      return { amount: Number(usd), formatted: usd, unit: '$', full: `$${usd}` };
    }
    return { amount: egp, formatted: egp.toLocaleString(), unit: 'ج.م', full: `${egp.toLocaleString()} ج.م` };
  };

  // Auto-init header dropdown bindings when DOM is ready
  function initCurrencyHeaderUI() {
    const btn = document.getElementById('currencyToggleBtn');
    const menu = document.getElementById('currencyMenu');
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
          menu.classList.remove('open');
        }
      });
      menu.querySelectorAll('.currency-choice').forEach(opt => {
        opt.addEventListener('click', () => {
          const c = opt.dataset.currency;
          window.setNexaCurrency(c);
          menu.classList.remove('open');
        });
      });
    }
    // Update initial label
    const curr = window.getNexaCurrency();
    const lbl = document.getElementById('currentCurrencyLabel');
    if (lbl) lbl.textContent = curr === 'SAR' ? 'ر.س' : (curr === 'USD' ? '$' : 'ج.م');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCurrencyHeaderUI);
  } else {
    initCurrencyHeaderUI();
  }
})();