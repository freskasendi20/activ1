/* ===================================================================
   ACTIVKEYZ - PRODUCTION SUPABASE CLIENT & BACKEND INTEGRATION
   Project Reference: mrinxsiostnzzjowutav
   Direct API connection, Storage handling, Realtime listeners,
   Authentication, and automatic fallback synchronization.
   =================================================================== */

(function () {
  'use strict';

  // 1. Supabase Project Configuration
  const SUPABASE_PROJECT_REF = 'mrinxsiostnzzjowutav';
  const SUPABASE_URL = 'https://mrinxsiostnzzjowutav.supabase.co';
  
  // Official Browser-Safe Publishable Key
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_7lx6sLmQ-08E1qKF2LO5bA_GQpMeiQs';

  // Configurable key (from window.NEXA_ENV, localStorage, or official default)
  let SUPABASE_ANON_KEY = (window.NEXA_ENV && (window.NEXA_ENV.SUPABASE_ANON_KEY || window.NEXA_ENV.SUPABASE_PUBLISHABLE_KEY)) ||
    localStorage.getItem('nexa_supabase_anon_key') ||
    DEFAULT_PUBLISHABLE_KEY;

  let client = null;
  let isConnected = false;

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

  function fixMojibakeText(str) {
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

  // Initialize Supabase Client
  function initClient() {
    if (client) return;
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function' && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('MOCK_REPLACE')) {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            storage: window.localStorage
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
        isConnected = true;
        console.log('⚡ ActivKeyz: Connected to Supabase (' + SUPABASE_PROJECT_REF + ')');
      } else {
        isConnected = false;
        console.warn('⚠️ ActivKeyz: Supabase client operating in hybrid/fallback mode. Configure SUPABASE_ANON_KEY for full live database connectivity.');
      }
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      isConnected = false;
    }
  }

  // Auto-init on script load
  if (window.supabase) {
    initClient();
  } else {
    window.addEventListener('DOMContentLoaded', initClient);
  }

  // -------------------------------------------------------------------
  // Universal Product Image Resolver (Ensures every product displays its OWN artwork)
  // -------------------------------------------------------------------
  const PRODUCT_IMAGE_ID_MAP = {
    // AI Tools
    'ai-chatgpt-plus': 'logos/chatgpt-plus.webp',
    'ai-perplexity-pro': 'logos/perplexity.webp',
    'ai-gemini-18m': 'logos/gemini.webp',
    'ai-gemini-3m': 'logos/gemini.webp',
    'gemini-advanced': 'logos/gemini.webp',
    'ai-claude-pro': 'logos/claude.webp',
    'ai-midjourney-standard': 'logos/midjourney.webp',
    'ai-elevenlabs-3m': 'logos/elevenlabs.webp',
    'ai-elevenlabs-1m': 'logos/elevenlabs.webp',
    'ai-elevenlabs-starter': 'logos/elevenlabs.webp',
    'ai-leonardo-1m': 'logos/leonardo-ai.webp',
    'ai-grok-super-1m': 'logos/grok-super.webp',
    'ai-grok-super-3m': 'logos/grok-heavy.webp',
    'ai-runway-pro-12m': 'logos/runway-pro.webp',
    'ai-runway-gen3': 'logos/runway-pro.webp',
    'ai-kling-ultra-1m': 'logos/kling-ultra.webp',
    'ai-higgsfield-1y': 'logos/higgsfield-pro.webp',
    'ai-manus-pro-1y': 'logos/manus-ai.webp',
    'ai-n8n-starter': 'logos/n8n.webp',

    // Creative
    'creative-suite-full': 'logos/adobe-full-apps.webp',
    'cr-adobe-all-apps': 'logos/adobe-full-apps.webp',
    'cr-photoshop-1m': 'logos/photoshop.webp',
    'cr-premiere-pro-1m': 'logos/premiere.webp',
    'cr-capcut-pro-1y': 'logos/capcut-pro.webp',
    'creative-capcut-6m': 'logos/capcut-pro.webp',
    'creative-capcut-1m': 'logos/capcut-pro.webp',
    'creative-capcut-7d': 'logos/capcut-pro.webp',
    'cr-canva-pro-edu': 'logos/canva-pro.webp',
    'creative-canva-pro-1y': 'logos/canva-pro.webp',
    'creative-figma-pro-1y': 'logos/figma-pro.webp',
    'cr-figma-pro': 'logos/figma-pro.webp',
    'creative-framer-pro-1y': 'logos/framer-pro.webp',
    'creative-freepik-3m': 'logos/freepik-magnific.webp',
    'creative-adobe-express-1y': 'logos/adobe-express.webp',

    // Office & Productivity
    'office-tools-full': 'logos/office-365.webp',
    'of-microsoft-365': 'logos/office-365.webp',
    'office-notion-biz-1y': 'logos/notion.webp',
    'office-notion-plus-1y': 'logos/notion.webp',
    'of-notion-plus': 'logos/notion.webp',
    'office-zoom-pro-1m': 'logos/zoom-pro.webp',
    'office-zoom-3m': 'logos/zoom-pro.webp',
    'office-zoom-1y': 'logos/zoom-pro.webp',
    'of-zoom-pro-1m': 'logos/zoom-pro.webp',
    'office-coursera-1y': 'logos/coursera-premium.webp',
    'of-coursera-plus': 'logos/coursera-premium.webp',
    'office-linkedin-career-3m': 'logos/linkedin-career.webp',
    'of-linkedin-learning': 'logos/linkedin-career.webp',
    'of-grammarly-premium': 'logos/grammarly.webp',

    // Streaming
    'streaming-bundle-main': 'logos/youtube-premium.webp',
    'st-youtube-premium-1y': 'logos/youtube-premium.webp',
    'st-youtube-premium-6m': 'logos/youtube-premium.webp',
    'streaming-yt-3m': 'logos/youtube-premium.webp',
    'streaming-yt-1m': 'logos/youtube-premium.webp',
    'st-spotify-1y': 'logos/spotify.webp',
    'streaming-spotify-3m': 'logos/spotify.webp',
    'st-apple-music-3m': 'logos/apple-music.webp',
    'streaming-apple-music-5m': 'logos/apple-music.webp',
    'st-prime-video-6m': 'logos/prime-video.webp',
    'streaming-amazon-prime-6m': 'logos/prime-video.webp',
    'streaming-duolingo-1y': 'logos/duolingo-super.webp',
    'st-deezer-premium': 'logos/deezer.webp',
    'st-netflix': 'logos/netflix.webp',
    'netflix-standard': 'logos/netflix.webp',

    // Gaming & Security
    'gaming-pass-main': 'logos/discord-nitro.webp',
    'gm-discord-nitro-1y': 'logos/discord-nitro.webp',
    'gm-discord-nitro-1m': 'logos/discord-nitro.webp',
    'gaming-discord-nitro': 'logos/discord-nitro.webp',
    'gm-nordvpn-1y': 'logos/nordvpn.webp',
    'gaming-nordvpn-3m': 'logos/nordvpn.webp',
    'gm-protonvpn-1y': 'logos/protonvpn.webp',
    'gaming-protonvpn-1m': 'logos/protonvpn.webp',
    'gm-expressvpn-1y': 'logos/expressvpn.webp',
    'gm-playstation-plus': 'logos/playstation.webp',
    'gm-xbox-game-pass': 'logos/xbox.webp'
  };

  function resolveProductImage(p) {
    if (!p) return 'logos/chatgpt-plus.webp';
    const prodId = (typeof p === 'object' ? (p.id || '') : String(p)).toLowerCase().trim();
    const prodName = (typeof p === 'object' ? (p.name || '') : '').toLowerCase();
    const rawImg = (typeof p === 'object' ? (p.image || p.featuredImage || '') : '').trim();

    // 1. Direct ID Map Match
    if (PRODUCT_IMAGE_ID_MAP[prodId]) return PRODUCT_IMAGE_ID_MAP[prodId];

    // 2. Existing Valid Non-generic Image
    if (rawImg && rawImg.startsWith('logos/') && !rawImg.includes('Robot_head') && !rawImg.includes('CARD') && !rawImg.includes('Enhancing') && !rawImg.includes('Removing')) {
      return rawImg;
    }
    if (rawImg === 'logos/prime-video.webp' || rawImg === 'primevideo_icon.svg') return 'logos/prime-video.webp';

    // 3. Name-based Match
    if (prodName.includes('chatgpt') || prodName.includes('gpt')) return 'logos/chatgpt-plus.webp';
    if (prodName.includes('gemini')) return 'logos/gemini.webp';
    if (prodName.includes('claude')) return 'logos/claude.webp';
    if (prodName.includes('midjourney')) return 'logos/midjourney.webp';
    if (prodName.includes('perplexity')) return 'logos/perplexity.webp';
    if (prodName.includes('elevenlabs') || prodName.includes('eleven')) return 'logos/elevenlabs.webp';
    if (prodName.includes('leonardo')) return 'logos/leonardo-ai.webp';
    if (prodName.includes('grok')) return prodName.includes('heavy') ? 'logos/grok-heavy.webp' : 'logos/grok-super.webp';
    if (prodName.includes('runway')) return 'logos/runway-pro.webp';
    if (prodName.includes('kling')) return 'logos/kling-ultra.webp';
    if (prodName.includes('higgsfield')) return 'logos/higgsfield-pro.webp';
    if (prodName.includes('manus')) return 'logos/manus-ai.webp';
    if (prodName.includes('n8n')) return 'logos/n8n.webp';
    if (prodName.includes('capcut')) return 'logos/capcut-pro.webp';
    if (prodName.includes('canva')) return 'logos/canva-pro.webp';
    if (prodName.includes('photoshop')) return 'logos/photoshop.webp';
    if (prodName.includes('premiere')) return 'logos/premiere.webp';
    if (prodName.includes('adobe')) return prodName.includes('express') ? 'logos/adobe-express.webp' : 'logos/adobe-full-apps.webp';
    if (prodName.includes('figma')) return 'logos/figma-pro.webp';
    if (prodName.includes('framer')) return 'logos/framer-pro.webp';
    if (prodName.includes('freepik') || prodName.includes('magnific')) return 'logos/freepik-magnific.webp';
    if (prodName.includes('office') || prodName.includes('365') || prodName.includes('microsoft')) return 'logos/office-365.webp';
    if (prodName.includes('notion')) return 'logos/notion.webp';
    if (prodName.includes('zoom')) return 'logos/zoom-pro.webp';
    if (prodName.includes('coursera')) return 'logos/coursera-premium.webp';
    if (prodName.includes('linkedin')) return 'logos/linkedin-career.webp';
    if (prodName.includes('grammarly')) return 'logos/grammarly.webp';
    if (prodName.includes('youtube')) return 'logos/youtube-premium.webp';
    if (prodName.includes('deezer')) return 'logos/deezer.webp';
    if (prodName.includes('spotify')) return 'logos/spotify.webp';
    if (prodName.includes('apple music') || prodName.includes('apple')) return 'logos/apple-music.webp';
    if (prodName.includes('prime') || prodName.includes('amazon')) return 'logos/prime-video.webp';
    if (prodName.includes('duolingo')) return 'logos/duolingo-super.webp';
    if (prodName.includes('playstation') || prodName.includes('ps plus')) return 'logos/playstation.webp';
    if (prodName.includes('xbox')) return 'logos/xbox.webp';
    if (prodName.includes('discord') || prodName.includes('nitro')) return 'logos/discord-nitro.webp';
    if (prodName.includes('proton')) return 'logos/protonvpn.webp';
    if (prodName.includes('expressvpn')) return 'logos/expressvpn.webp';
    if (prodName.includes('nord') || prodName.includes('vpn')) return 'logos/nordvpn.webp';
    if (prodName.includes('netflix')) return 'logos/netflix.webp';

    return 'logos/chatgpt-plus.webp';
  }

  window.NexaResolveProductImage = resolveProductImage;

  // -------------------------------------------------------------------
  // Helper: Convert Base64 Data URL to Blob for Supabase Storage Upload
  // -------------------------------------------------------------------
  function dataUrlToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // -------------------------------------------------------------------
  // 2. CATEGORIES API
  // -------------------------------------------------------------------
  const categoriesApi = {
    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true });
        if (error) {
          console.error('Categories fetch error:', error);
          throw new Error(`خطأ في جلب الأقسام من السحابة: ${error.message} (${error.code || ''})`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async create(category) {
      if (isConnected && client) {
        const payload = {
          id: category.id,
          name: category.name,
          icon: category.icon || 'fa-solid fa-folder',
          description: category.description || '',
          display_order: Number(category.display_order !== undefined ? category.display_order : (category.displayOrder !== undefined ? category.displayOrder : 0))
        };
        const { data, error } = await client.from('categories').insert([payload]).select().single();
        if (error) throw new Error(`فشل إضافة القسم: ${error.message}`);
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async update(id, updates) {
      if (isConnected && client) {
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.icon !== undefined) payload.icon = updates.icon;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.display_order !== undefined || updates.displayOrder !== undefined) {
          payload.display_order = Number(updates.display_order !== undefined ? updates.display_order : updates.displayOrder);
        }
        const { data, error } = await client.from('categories').update(payload).eq('id', id).select().single();
        if (error) throw new Error(`فشل تحديث القسم: ${error.message}`);
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('categories').delete().eq('id', id);
        if (error) throw new Error(`فشل حذف القسم: ${error.message}`);
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 3. PRODUCTS API
  // -------------------------------------------------------------------
  const productsApi = {
    async getAll(includeInactive = false) {
      if (isConnected && client) {
        let data, error;
        if (includeInactive) {
          // Administrative fetch: Query protected admin_products view with wholesale columns & inventory
          const res = await client
            .from('admin_products')
            .select('*, product_inventory(*)')
            .order('display_order', { ascending: true })
            .order('is_featured', { ascending: false });

          data = res.data;
          error = res.error;
        } else {
          // Public customer storefront: queries safe public catalog view (zero wholesale/bot data exposure)
          const res = await client
            .from('products_catalog')
            .select('*')
            .order('display_order', { ascending: true })
            .order('is_featured', { ascending: false });
          data = res.data;
          error = res.error;
        }

        if (error) {
          console.error('Products fetch error from Supabase:', error);
          throw new Error(`خطأ في جلب المنتجات من السحابة: ${error.message} (${error.code || ''})`);
        }

        if (Array.isArray(data)) {
          // Map database fields to frontend format
          const mapped = data.map(p => {
            const inv = Array.isArray(p.product_inventory) && p.product_inventory[0] 
              ? p.product_inventory[0] 
              : (p.stock_type ? {
                  stock_type: p.stock_type,
                  quantity_available: p.quantity_available,
                  low_stock_threshold: p.low_stock_threshold,
                  is_paused: p.is_paused
                } : null);

            return {
              id: p.id,
              name: p.name,
              category: p.category_id,
              catName: p.category_id === 'ai' ? 'أدوات الذكاء الاصطناعي' :
                       p.category_id === 'creative' ? 'البرامج الإبداعية والتصميم' :
                       p.category_id === 'office' ? 'برامج المكتب والإنتاجية' :
                       p.category_id === 'streaming' ? 'الترفيه والاشتراكات' : 'الألعاب والبطاقات والحماية',
              duration: p.duration,
              wholesaleEgp: includeInactive && (p.wholesale_egp !== undefined && p.wholesale_egp !== null) ? Number(p.wholesale_egp) : undefined,
              priceEgp: Number(p.price_egp) || 0,
              priceUsd: Number(p.price_usd) || 0,
              wholesaleUsd: includeInactive && (p.wholesale_usd !== undefined && p.wholesale_usd !== null) ? Number(p.wholesale_usd) : undefined,
              sourceBot: includeInactive ? (p.source_bot || undefined) : undefined,
              isFeatured: Boolean(p.is_featured),
              isActive: Boolean(p.is_active),
              isArchived: Boolean(p.is_archived),
              displayOrder: p.display_order || 0,
              image: resolveProductImage(p),
              featuredImage: resolveProductImage(p),
              rating: Number(p.rating) || 4.9,
              ratingCount: p.rating_count || '100+',
              desc: fixMojibakeText(p.description),
              specs: Array.isArray(p.specs) ? p.specs.map(fixMojibakeText) : [],
              fullDesc: fixMojibakeText(p.full_desc),
              activationGuide: fixMojibakeText(p.activation_guide),
              deliveryInstructions: fixMojibakeText(p.delivery_instructions),
              warranty: fixMojibakeText(p.warranty),
              deliveryMethod: p.delivery_method || 'email',
              requiredFields: p.required_fields || ['recipient_email'],
              stockStatus: p.stock_status || 'in_stock',
              inventory: inv ? {
                stockType: inv.stock_type,
                available: inv.quantity_available,
                reserved: inv.quantity_reserved || 0,
                sold: inv.quantity_sold || 0,
                threshold: inv.low_stock_threshold,
                isPaused: inv.is_paused
              } : null
            };
          });

          // Sync with local cache for offline/instant hydration
          try {
            localStorage.setItem('nexa_products_catalog_v2', JSON.stringify(mapped));
          } catch (e) {}

          return mapped;
        }
        return [];
      }

      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getById(id, forAdmin = false) {
      if (isConnected && client) {
        if (forAdmin) {
          const { data, error } = await client
            .from('admin_products')
            .select('*, product_inventory(*)')
            .eq('id', id)
            .maybeSingle();

          if (error) throw new Error(`خطأ في جلب بيانات المنتج: ${error.message}`);
          if (data) {
            const inv = Array.isArray(data.product_inventory) && data.product_inventory[0] 
              ? data.product_inventory[0] 
              : (data.stock_type ? {
                  stock_type: data.stock_type,
                  quantity_available: data.quantity_available,
                  low_stock_threshold: data.low_stock_threshold,
                  is_paused: data.is_paused
                } : null);

            return {
              id: data.id,
              name: data.name,
              category: data.category_id,
              catName: data.category_id === 'ai' ? 'أدوات الذكاء الاصطناعي' :
                       data.category_id === 'creative' ? 'البرامج الإبداعية والتصميم' :
                       data.category_id === 'office' ? 'برامج المكتب والإنتاجية' :
                       data.category_id === 'streaming' ? 'الترفيه والاشتراكات' : 'الألعاب والبطاقات والحماية',
              duration: data.duration,
              wholesaleEgp: forAdmin && data.wholesale_egp !== undefined ? Number(data.wholesale_egp) : undefined,
              priceEgp: Number(data.price_egp) || 0,
              priceUsd: Number(data.price_usd) || 0,
              wholesaleUsd: forAdmin && data.wholesale_usd !== undefined ? Number(data.wholesale_usd) : undefined,
              sourceBot: forAdmin ? data.source_bot : undefined,
              isFeatured: Boolean(data.is_featured),
              isActive: Boolean(data.is_active),
              isArchived: Boolean(data.is_archived),
              displayOrder: data.display_order || 0,
              image: resolveProductImage(data),
              featuredImage: resolveProductImage(data),
              rating: Number(data.rating) || 4.9,
              ratingCount: data.rating_count || '100+',
              desc: fixMojibakeText(data.description),
              specs: Array.isArray(data.specs) ? data.specs.map(fixMojibakeText) : [],
              fullDesc: fixMojibakeText(data.full_desc),
              activationGuide: fixMojibakeText(data.activation_guide),
              deliveryInstructions: fixMojibakeText(data.delivery_instructions),
              warranty: fixMojibakeText(data.warranty),
              deliveryMethod: data.delivery_method || 'email',
              requiredFields: data.required_fields || ['recipient_email'],
              stockStatus: data.stock_status || 'in_stock',
              inventory: inv ? {
                stockType: inv.stock_type,
                available: inv.quantity_available,
                reserved: inv.quantity_reserved || 0,
                sold: inv.quantity_sold || 0,
                threshold: inv.low_stock_threshold,
                isPaused: inv.is_paused
              } : null
            };
          }
          return null;
        }

        // Storefront public read
        const { data: catData, error: catErr } = await client
          .from('products_catalog')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (catErr) throw new Error(`خطأ في جلب بيانات المنتج: ${catErr.message}`);
        if (catData) {
          return {
            id: catData.id,
            name: catData.name,
            category: catData.category_id,
            catName: catData.category_id === 'ai' ? 'أدوات الذكاء الاصطناعي' :
                     catData.category_id === 'creative' ? 'البرامج الإبداعية والتصميم' :
                     catData.category_id === 'office' ? 'برامج المكتب والإنتاجية' :
                     catData.category_id === 'streaming' ? 'الترفيه والاشتراكات' : 'الألعاب والبطاقات والحماية',
            duration: catData.duration,
            priceEgp: Number(catData.price_egp) || 0,
            priceUsd: Number(catData.price_usd) || 0,
            isFeatured: Boolean(catData.is_featured),
            isActive: Boolean(catData.is_active),
            isArchived: Boolean(catData.is_archived),
            displayOrder: catData.display_order || 0,
            image: resolveProductImage(catData),
            featuredImage: resolveProductImage(catData),
            rating: Number(catData.rating) || 4.9,
            ratingCount: catData.rating_count || '100+',
            desc: catData.description,
            specs: Array.isArray(catData.specs) ? catData.specs : [],
            fullDesc: catData.full_desc,
            activationGuide: catData.activation_guide,
            deliveryInstructions: catData.delivery_instructions,
            warranty: catData.warranty,
            stockStatus: catData.stock_status || 'in_stock',
            inventory: {
              stockType: catData.stock_type,
              available: catData.quantity_available,
              threshold: catData.low_stock_threshold,
              isPaused: catData.is_paused
            }
          };
        }
        return null;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async create(product) {
      if (isConnected && client) {
        const payload = {
          id: product.id,
          name: product.name,
          category_id: product.category,
          duration: product.duration || '1 شهر',
          wholesale_egp: product.wholesaleEgp !== undefined ? Number(product.wholesaleEgp) : 0,
          price_egp: Number(product.priceEgp) || 0,
          price_usd: Number(product.priceUsd) || (Number(product.priceEgp) / 50),
          wholesale_usd: product.wholesaleUsd !== undefined ? Number(product.wholesaleUsd) : 0,
          source_bot: product.sourceBot || '',
          is_featured: Boolean(product.isFeatured),
          image: product.image,
          featured_image: product.featuredImage || product.image,
          rating: Number(product.rating) || 4.9,
          rating_count: product.ratingCount || '100+',
          description: product.desc || '',
          specs: Array.isArray(product.specs) ? product.specs : [],
          full_desc: product.fullDesc || '',
          activation_guide: product.activationGuide || '',
          delivery_instructions: product.deliveryInstructions || '',
          warranty: product.warranty || '',
          display_order: Number(product.displayOrder) || 0,
          is_active: product.isActive !== undefined ? Boolean(product.isActive) : true
        };

        // Note: Do not chain .select() without arguments here because PostgREST translates
        // that into RETURNING *, which requires SELECT on restricted wholesale columns
        // directly from the base products table, throwing 42501 permission denied for table products.
        const { error } = await client.from('products').insert([payload]);
        if (error) {
          console.error('Create product error:', error);
          throw new Error(error.message || 'فشل إضافة المنتج إلى قاعدة البيانات');
        }

        // Insert initial inventory record
        const invData = product.inventory || (product.stockType !== undefined ? {
          stockType: product.stockType,
          available: product.available,
          threshold: product.threshold,
          isPaused: product.isPaused
        } : null);

        const invPayload = {
          product_id: product.id,
          stock_type: (invData && invData.stockType) || 'unlimited',
          quantity_available: (invData && Number(invData.available)) || 100,
          low_stock_threshold: (invData && Number(invData.threshold)) || 5,
          is_paused: Boolean(invData && invData.isPaused)
        };

        const { error: invErr } = await client.from('product_inventory').insert([invPayload]);
        if (invErr) console.warn('Product inventory insert warning:', invErr);

        // Return full created product mapped from authenticated admin_products view
        return await this.getById(product.id, true);
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async update(id, updates) {
      if (isConnected && client) {
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.category !== undefined) payload.category_id = updates.category;
        if (updates.duration !== undefined) payload.duration = updates.duration;
        if (updates.wholesaleEgp !== undefined) payload.wholesale_egp = Number(updates.wholesaleEgp);
        if (updates.priceEgp !== undefined) payload.price_egp = Number(updates.priceEgp);
        if (updates.priceUsd !== undefined) payload.price_usd = Number(updates.priceUsd);
        if (updates.wholesaleUsd !== undefined) payload.wholesale_usd = Number(updates.wholesaleUsd);
        if (updates.sourceBot !== undefined) payload.source_bot = updates.sourceBot;
        if (updates.isFeatured !== undefined) payload.is_featured = Boolean(updates.isFeatured);
        if (updates.isActive !== undefined) payload.is_active = Boolean(updates.isActive);
        if (updates.isArchived !== undefined) payload.is_archived = Boolean(updates.isArchived);
        if (updates.displayOrder !== undefined) payload.display_order = Number(updates.displayOrder);
        if (updates.image !== undefined) {
          payload.image = updates.image;
          payload.featured_image = updates.image;
        }
        if (updates.desc !== undefined) payload.description = updates.desc;
        if (updates.specs !== undefined) payload.specs = Array.isArray(updates.specs) ? updates.specs : [];
        if (updates.fullDesc !== undefined) payload.full_desc = updates.fullDesc;
        if (updates.activationGuide !== undefined) payload.activation_guide = updates.activationGuide;
        if (updates.deliveryInstructions !== undefined) payload.delivery_instructions = updates.deliveryInstructions;
        if (updates.warranty !== undefined) payload.warranty = updates.warranty;

        if (Object.keys(payload).length > 0) {
          const { error } = await client.from('products').update(payload).eq('id', id);
          if (error) {
            console.error('Update product error:', error);
            throw new Error(error.message || 'فشل تحديث بيانات المنتج');
          }
        }

        const invData = updates.inventory || (updates.stockType !== undefined ? {
          stockType: updates.stockType,
          available: updates.available,
          threshold: updates.threshold,
          isPaused: updates.isPaused
        } : null);

        if (invData) {
          const { data: existingInv } = await client
            .from('product_inventory')
            .select('id')
            .eq('product_id', id)
            .maybeSingle();

          const invPayload = {
            product_id: id,
            stock_type: invData.stockType || 'unlimited',
            quantity_available: Number(invData.available) || 0,
            low_stock_threshold: Number(invData.threshold) || 5,
            is_paused: Boolean(invData.isPaused)
          };

          if (existingInv) {
            const { error: invErr } = await client.from('product_inventory').update(invPayload).eq('id', existingInv.id);
            if (invErr) console.warn('Product inventory update warning:', invErr);
          } else {
            const { error: invErr } = await client.from('product_inventory').insert([invPayload]);
            if (invErr) console.warn('Product inventory insert warning:', invErr);
          }
        }

        return await this.getById(id, true);
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async toggleArchive(id, isArchived) {
      return await this.update(id, { isArchived, isActive: !isArchived });
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('products').delete().eq('id', id);
        if (error) {
          console.error('Delete product error:', error);
          throw new Error(error.message || 'فشل حذف المنتج');
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async duplicate(id) {
      const original = await this.getById(id, true);
      if (!original) throw new Error('المنتج المراد نسخه غير موجود.');
      const newId = original.id + '-copy-' + Math.floor(1000 + Math.random() * 9000);
      const duplicateProduct = {
        ...original,
        id: newId,
        name: original.name + ' (نسخة)',
        isFeatured: false,
        isActive: true,
        isArchived: false
      };
      return await this.create(duplicateProduct);
    },

    async toggleActive(id, isActive) {
      return await this.update(id, { isActive });
    },

    async toggleFeatured(id, isFeatured) {
      return await this.update(id, { isFeatured });
    },

    async bulkUpdate(ids, changes) {
      if (isConnected && client && Array.isArray(ids) && ids.length > 0) {
        const { data, error } = await client.from('products').update(changes).in('id', ids);
        if (error) throw new Error(error.message || 'فشل التعديل الجماعي');
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async bulkDelete(ids) {
      if (isConnected && client && Array.isArray(ids) && ids.length > 0) {
        const { error } = await client.from('products').delete().in('id', ids);
        if (error) throw new Error(error.message || 'فشل الحذف الجماعي');
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 4. INVENTORY API
  // -------------------------------------------------------------------
  const inventoryApi = {
    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client
          .from('product_inventory')
          .select('*, products(name, category_id, image, price_egp)')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Inventory fetch error:', error);
          throw new Error(`خطأ في جلب المخزون: ${error.message}`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getByProductId(productId) {
      if (isConnected && client) {
        const { data, error } = await client
          .from('product_inventory')
          .select('*')
          .eq('product_id', productId)
          .maybeSingle();
        if (error) throw new Error(`خطأ في جلب مخزون المنتج: ${error.message}`);
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async adjustStock({ productId, stockType = 'limited', quantityChange = 0, newAvailable = null, lowStockThreshold = 5, isPaused = false, reason = 'تعديل يدوي' }) {
      if (isConnected && client) {
        try {
          const { data, error } = await client.rpc('adjust_inventory', {
            p_product_id: productId,
            p_stock_type: stockType,
            p_quantity_change: quantityChange,
            p_new_available: newAvailable,
            p_low_stock_threshold: lowStockThreshold,
            p_is_paused: isPaused,
            p_reason: reason
          });
          if (!error) return data;
          console.warn('adjust_inventory RPC warning, using direct table update:', error.message);
        } catch (rpcEx) {
          console.warn('adjust_inventory RPC exception, using direct table update:', rpcEx);
        }

        // Direct table update fallback for product_inventory
        const { data: existing } = await client
          .from('product_inventory')
          .select('id, quantity_available')
          .eq('product_id', productId)
          .maybeSingle();

        const currentQty = existing ? (existing.quantity_available || 0) : 0;
        const targetQty = newAvailable !== null && newAvailable !== undefined 
          ? Math.max(0, Number(newAvailable)) 
          : Math.max(0, currentQty + Number(quantityChange));

        const payload = {
          product_id: productId,
          stock_type: stockType,
          quantity_available: targetQty,
          low_stock_threshold: lowStockThreshold !== null && lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
          is_paused: Boolean(isPaused)
        };

        if (existing) {
          const { data: updated, error: updErr } = await client
            .from('product_inventory')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single();
          if (updErr) throw new Error(`فشل تحديث المخزون: ${updErr.message}`);
          return updated;
        } else {
          const { data: inserted, error: insErr } = await client
            .from('product_inventory')
            .insert([payload])
            .select()
            .single();
          if (insErr) throw new Error(`فشل إنشاء سجل المخزون: ${insErr.message}`);
          return inserted;
        }
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getMovements(productId = null, limit = 50) {
      if (isConnected && client) {
        let q = client
          .from('inventory_movements')
          .select('*, products(name)')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (productId) {
          q = q.eq('product_id', productId);
        }

        const { data, error } = await q;
        if (error) throw new Error(`خطأ في جلب حركات المخزون: ${error.message}`);
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 5. BUNDLES API (Combos)
  // -------------------------------------------------------------------
  const bundlesApi = {
    async getAll(includeInactive = false) {
      if (isConnected && client) {
        let q = client
          .from('bundles')
          .select('*, bundle_items(*, products(name, price_egp, image))')
          .order('display_order', { ascending: true });

        if (!includeInactive) {
          q = q.eq('is_active', true);
        }

        const { data, error } = await q;
        if (error) {
          console.error('Bundles fetch error:', error);
          throw new Error(`خطأ في جلب الباقات التوفيرية: ${error.message}`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getById(id) {
      if (isConnected && client) {
        const { data, error } = await client
          .from('bundles')
          .select('*, bundle_items(*, products(name, price_egp, image))')
          .eq('id', id)
          .maybeSingle();
        if (error) throw new Error(`خطأ في جلب تفاصيل الباقة: ${error.message}`);
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async create(bundleData, itemsArray = []) {
      if (isConnected && client) {
        const bundleId = bundleData.id || 'bundle-' + Date.now();
        const payload = {
          id: bundleId,
          name: bundleData.name,
          slug: bundleData.slug || bundleId,
          description: bundleData.description || '',
          image: bundleData.image || 'logos/chatgpt-plus.webp',
          original_price_egp: Number(bundleData.originalPriceEgp) || 0,
          price_egp: Number(bundleData.priceEgp) || 0,
          price_usd: Number(bundleData.priceUsd) || (Number(bundleData.priceEgp) / 50),
          is_active: bundleData.isActive !== undefined ? Boolean(bundleData.isActive) : true,
          is_featured: bundleData.isFeatured !== undefined ? Boolean(bundleData.isFeatured) : true,
          starts_at: bundleData.startsAt || new Date().toISOString(),
          expires_at: bundleData.expiresAt || null,
          display_order: Number(bundleData.displayOrder) || 0
        };

        const { data: createdBundle, error: bErr } = await client.from('bundles').insert([payload]).select().single();
        if (bErr) {
          console.error('Create bundle error:', bErr);
          throw new Error(`فشل إنشاء الباقة: ${bErr.message}`);
        }

        if (Array.isArray(itemsArray) && itemsArray.length > 0) {
          const itemsPayload = itemsArray.map((it, idx) => ({
            bundle_id: createdBundle.id,
            product_id: it.productId || it.id,
            quantity: Number(it.quantity) || 1,
            display_order: idx + 1
          }));
          const { error: iErr } = await client.from('bundle_items').insert(itemsPayload);
          if (iErr) {
            console.error('Insert bundle items error:', iErr);
            throw new Error(`فشل إضافة عناصر الباقة: ${iErr.message}`);
          }
        }

        return createdBundle;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async update(id, bundleData, itemsArray = null) {
      if (isConnected && client) {
        const payload = {};
        if (bundleData.name !== undefined) payload.name = bundleData.name;
        if (bundleData.description !== undefined) payload.description = bundleData.description;
        if (bundleData.image !== undefined) payload.image = bundleData.image;
        if (bundleData.originalPriceEgp !== undefined) payload.original_price_egp = Number(bundleData.originalPriceEgp);
        if (bundleData.priceEgp !== undefined) payload.price_egp = Number(bundleData.priceEgp);
        if (bundleData.priceUsd !== undefined) payload.price_usd = Number(bundleData.priceUsd);
        if (bundleData.isActive !== undefined) payload.is_active = Boolean(bundleData.isActive);
        if (bundleData.isFeatured !== undefined) payload.is_featured = Boolean(bundleData.isFeatured);
        if (bundleData.startsAt !== undefined) payload.starts_at = bundleData.startsAt;
        if (bundleData.expiresAt !== undefined) payload.expires_at = bundleData.expiresAt;
        if (bundleData.displayOrder !== undefined) payload.display_order = Number(bundleData.displayOrder);

        const { data, error } = await client.from('bundles').update(payload).eq('id', id).select().single();
        if (error) {
          console.error('Update bundle error:', error);
          throw new Error(`فشل تحديث الباقة: ${error.message}`);
        }

        if (Array.isArray(itemsArray)) {
          const { error: delErr } = await client.from('bundle_items').delete().eq('bundle_id', id);
          if (delErr) throw new Error(`فشل تحديث عناصر الباقة: ${delErr.message}`);
          if (itemsArray.length > 0) {
            const itemsPayload = itemsArray.map((it, idx) => ({
              bundle_id: id,
              product_id: it.productId || it.id,
              quantity: Number(it.quantity) || 1,
              display_order: idx + 1
            }));
            const { error: insErr } = await client.from('bundle_items').insert(itemsPayload);
            if (insErr) throw new Error(`فشل إدراج عناصر الباقة: ${insErr.message}`);
          }
        }

        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async toggleActive(id, isActive) {
      return await this.update(id, { isActive });
    },

    async toggleFeatured(id, isFeatured) {
      return await this.update(id, { isFeatured });
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('bundles').delete().eq('id', id);
        if (error) {
          console.error('Delete bundle error:', error);
          throw new Error(`فشل حذف الباقة: ${error.message}`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 6. DYNAMIC PAYMENT METHODS API
  // -------------------------------------------------------------------
  const paymentsApi = {
    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client
          .from('payment_methods')
          .select('*')
          .order('display_order', { ascending: true });
        if (error) {
          console.error('Payment methods fetch error:', error);
          throw new Error(`خطأ في جلب وسائل الدفع: ${error.message} (${error.code || ''})`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getActive() {
      const all = await this.getAll();
      return all.filter(p => p.is_active);
    },

    async create(method) {
      if (isConnected && client) {
        const { data, error } = await client.from('payment_methods').insert([method]).select().single();
        if (error) {
          console.error('Create payment method error:', error);
          throw new Error(`فشل إضافة وسيلة الدفع: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async update(id, updates) {
      if (isConnected && client) {
        const { data, error } = await client.from('payment_methods').update(updates).eq('id', id).select().single();
        if (error) {
          console.error('Update payment method error:', error);
          throw new Error(`فشل تحديث وسيلة الدفع: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async toggleActive(id, isActive) {
      return await this.update(id, { is_active: isActive });
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('payment_methods').delete().eq('id', id);
        if (error) {
          console.error('Delete payment method error:', error);
          throw new Error(`فشل حذف وسيلة الدفع: ${error.message}`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 7. STORAGE API: Receipts & Product Media
  // -------------------------------------------------------------------
  const storageApi = {
    async uploadReceipt(fileOrBase64, orderId) {
      if (!fileOrBase64) return null;
      if (!isConnected || !client) {
        return fileOrBase64;
      }

      try {
        let blob;
        let ext = 'jpg';

        if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) {
          blob = dataUrlToBlob(fileOrBase64);
          const mimeMatch = fileOrBase64.match(/:(.*?);/);
          if (mimeMatch && mimeMatch[1]) {
            ext = mimeMatch[1].split('/')[1] || 'jpg';
          }
        } else if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
          blob = fileOrBase64;
          ext = (fileOrBase64.name && fileOrBase64.name.split('.').pop()) || 'jpg';
        } else {
          return null;
        }

        const fileName = `${orderId}_${Date.now()}.${ext}`;
        const filePath = fileName;

        const { data, error } = await client.storage
          .from('receipts')
          .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          console.warn('Storage upload error, retaining original:', error);
          return typeof fileOrBase64 === 'string' ? fileOrBase64 : null;
        }

        return filePath;
      } catch (err) {
        console.error('Failed to upload receipt to Supabase storage:', err);
        return typeof fileOrBase64 === 'string' ? fileOrBase64 : null;
      }
    },

    async getReceiptUrl(pathOrUrl) {
      if (!pathOrUrl) return null;
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
        return pathOrUrl;
      }
      if (isConnected && client) {
        try {
          // 1. Try directly with given path
          const { data, error } = await client.storage
            .from('receipts')
            .createSignedUrl(pathOrUrl, 3600);
          if (!error && data && data.signedUrl) {
            return data.signedUrl;
          }
          // 2. If path starts with 'receipts/', try without prefix
          if (pathOrUrl.startsWith('receipts/')) {
            const stripped = pathOrUrl.replace(/^receipts\//, '');
            const { data: d2, error: e2 } = await client.storage
              .from('receipts')
              .createSignedUrl(stripped, 3600);
            if (!e2 && d2 && d2.signedUrl) {
              return d2.signedUrl;
            }
          } else {
            // 3. If path didn't have prefix, try with 'receipts/'
            const withPrefix = `receipts/${pathOrUrl}`;
            const { data: d3, error: e3 } = await client.storage
              .from('receipts')
              .createSignedUrl(withPrefix, 3600);
            if (!e3 && d3 && d3.signedUrl) {
              return d3.signedUrl;
            }
          }
          // 4. Fallback to public URL if configured as public bucket
          const { data: pubData } = client.storage.from('receipts').getPublicUrl(pathOrUrl);
          if (pubData && pubData.publicUrl) return pubData.publicUrl;
        } catch (e) {
          console.warn('getReceiptUrl error:', e);
        }
      }
      return pathOrUrl;
    },

    async uploadProductMedia(file, fileName) {
      if (!isConnected || !client) throw new Error('Not connected to Supabase');
      const cleanName = fileName || `product_${Date.now()}_${file.name}`;
      const { data, error } = await client.storage
        .from('product-media')
        .upload(cleanName, file, { upsert: true });
      if (error) throw new Error(`فشل رفع الصورة: ${error.message}`);
      const { data: pubData } = client.storage.from('product-media').getPublicUrl(cleanName);
      return pubData.publicUrl;
    }
  };

  // -------------------------------------------------------------------
  // 8. ORDERS API (With Bundles, Payment Records & Status History)
  // -------------------------------------------------------------------
  const ordersApi = {
    async create(orderData) {
      let receiptPath = null;

      // 1. Upload receipt to private bucket if provided
      if (orderData.receiptImage) {
        try {
          receiptPath = await storageApi.uploadReceipt(orderData.receiptImage, orderData.orderId);
        } catch (e) {
          receiptPath = orderData.receiptImage;
        }
      }

      const deliveryPref = orderData.deliveryPreference || 'website';
      const prefLabels = {
        website: 'الموقع مباشرة (Private Order Page)',
        email: 'البريد الإلكتروني (Email Delivery)',
        whatsapp: 'الواتساب (WhatsApp Delivery)'
      };
      const customerIdentityId = authApi.getCustomerIdentityId();
      const deliveryHeader = `[طريقة الاستلام المفضلة: ${prefLabels[deliveryPref] || deliveryPref}] [CID:${customerIdentityId}]`;
      const combinedNotes = orderData.notes 
        ? `${deliveryHeader}\n${orderData.notes}` 
        : deliveryHeader;

      if (isConnected && client) {
        // Attempt server-side verified RPC order creation
        const { data: rpcRes, error: rpcErr } = await client.rpc('create_order_securely', {
          p_order_id: orderData.orderId,
          p_customer_name: orderData.customerName || 'عميل Activkeyz',
          p_customer_email: orderData.customerEmail,
          p_customer_phone: orderData.customerPhone,
          p_notes: combinedNotes,
          p_payment_method: orderData.paymentMethod || 'vodafone',
          p_payment_method_id: orderData.paymentMethodId || null,
          p_transfer_number: orderData.transferNumber || '01225106057',
          p_receipt_image_url: receiptPath || orderData.receiptImage,
          p_coupon_code: orderData.appliedCoupon || '',
          p_items: (orderData.items || []).map(i => ({
            id: i.id,
            quantity: i.quantity || 1,
            is_bundle: Boolean(i.isBundle),
            deliveryType: i.deliveryType || 'حساب رسمي مجهز',
            activation: i.activation || 'ready'
          }))
        });

        if (rpcErr) {
          console.error('RPC create_order_securely error:', rpcErr);
          throw new Error(rpcErr.message || 'فشل في اعتماد الطلب وحساب الأسعار عبر السحابة.');
        }

        if (rpcRes && rpcRes.success) {
          console.log('✅ Server-verified order created via Supabase RPC:', rpcRes.order_id);

          // Persist structured phone fields on order row
          try {
            await client.from('orders').update({
              phone_country_code: orderData.phoneCountryCode || 'EG',
              phone_country_name: orderData.phoneCountryName || 'مصر',
              phone_dial_code: orderData.phoneDialCode || '+20',
              phone_national_number: orderData.phoneNationalNumber || orderData.customerPhone || '',
              phone_e164: orderData.phoneE164 || ''
            }).eq('order_id', rpcRes.order_id);
          } catch(updateErr) {
            console.warn('Note on updating order phone columns:', updateErr);
          }

          const verifiedOrder = {
            ...orderData,
            customerIdentityId,
            deliveryPreference: deliveryPref,
            receiptImage: receiptPath || orderData.receiptImage,
            subtotalEgp: rpcRes.subtotal_egp,
            discountEgp: rpcRes.discount_egp,
            totalEgp: rpcRes.total_egp,
            totalUsd: rpcRes.total_usd,
            dbId: rpcRes.order_uuid,
            accessToken: rpcRes.access_token
          };

          // Mirror to local cache for customer confirmation
          try {
            const local = JSON.parse(localStorage.getItem('nexa_orders') || '[]');
            local.unshift(verifiedOrder);
            localStorage.setItem('nexa_orders', JSON.stringify(local));
          } catch (e) {}

          return verifiedOrder;
        }
      }

      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getAll({ status = 'all', paymentStatus = 'all', fulfillmentStatus = 'all', search = '' } = {}) {
      if (isConnected && client) {
        let query = client
          .from('orders')
          .select('*, order_items(*), order_status_history(*)')
          .order('created_at', { ascending: false });

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        if (paymentStatus && paymentStatus !== 'all') {
          query = query.eq('payment_status', paymentStatus);
        }
        if (fulfillmentStatus && fulfillmentStatus !== 'all') {
          query = query.eq('fulfillment_status', fulfillmentStatus);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Orders fetch error from Supabase:', error);
          throw new Error(`خطأ في جلب الطلبات من السحابة: ${error.message} (${error.code || ''})`);
        }

        if (Array.isArray(data)) {
          const mapped = data.map(o => {
            const meta = o.metadata || {};
            let pref = meta.delivery_preference;
            if (!pref && o.notes) {
              if (o.notes.includes('الواتساب') || o.notes.includes('whatsapp')) pref = 'whatsapp';
              else if (o.notes.includes('البريد') || o.notes.includes('email')) pref = 'email';
              else pref = 'website';
            }

            return {
              orderId: o.order_id,
              dbId: o.id,
              accessToken: o.access_token,
              createdAt: o.created_at,
              customerName: o.customer_name,
              customerEmail: o.customer_email,
              customerPhone: o.customer_phone,
              phoneCountryCode: o.phone_country_code || meta.phone_country_code || 'EG',
              phoneCountryName: o.phone_country_name || meta.phone_country_name || 'مصر',
              phoneDialCode: o.phone_dial_code || meta.phone_dial_code || '+20',
              phoneNationalNumber: o.phone_national_number || meta.phone_national_number || o.customer_phone || '',
              phoneE164: o.phone_e164 || meta.phone_e164 || '',
              notes: o.notes,
              adminNotes: o.admin_notes,
              subtotalEgp: Number(o.subtotal_egp),
              discountEgp: Number(o.discount_egp),
              totalEgp: Number(o.total_egp),
              totalUsd: Number(o.total_usd),
              paymentMethod: o.payment_method,
              paymentMethodId: o.payment_method_id,
              transferNumber: o.transfer_number,
              receiptImage: o.receipt_image_url,
              paymentStatus: o.payment_status,
              fulfillmentStatus: o.fulfillment_status,
              status: o.status,
              verifiedAt: o.verified_at,
              fulfilledAt: o.fulfilled_at,
              deliveryPreference: pref || 'website',
              fulfillmentData: meta.fulfillment_payload || null,
              deliveryHistory: meta.delivery_history || [],
              items: (o.order_items || []).map(i => ({
                orderItemId: i.id,
                id: i.product_id || i.bundle_id,
                productId: i.product_id,
                name: i.name,
                isBundle: i.is_bundle,
                duration: i.duration,
                quantity: i.quantity,
                priceEgp: Number(i.price_egp),
                deliveryType: i.delivery_type,
                activation: i.activation_type,
                image: i.image,
                bundleContents: i.bundle_contents
              })),
              statusHistory: o.order_status_history || []
            };
          });

          // Sync with local cache and merge any newly created orders
          try {
            const localOrders = JSON.parse(localStorage.getItem('nexa_orders') || '[]');
            const existingIds = new Set(mapped.map(m => m.orderId));
            const freshLocal = localOrders.filter(lo => !existingIds.has(lo.orderId));
            const merged = [...freshLocal, ...mapped];
            localStorage.setItem('nexa_orders', JSON.stringify(merged));
            return merged;
          } catch (e) {
            return mapped;
          }
        }
        return JSON.parse(localStorage.getItem('nexa_orders') || '[]');
      }

      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getById(orderId, accessToken = null) {
      if (isConnected && client) {
        // 1. Primary: Use authoritative lookup_order RPC (unified server endpoint with token security)
        try {
          const { data: rpcData, error: rpcErr } = await client.rpc('lookup_order', {
            p_order_id: orderId,
            p_access_token: accessToken || null
          });

          if (!rpcErr && rpcData && rpcData.orderId) {
            // Attach local conversation messages if any
            try {
              const chatKey = `nexa_order_chat_${orderId}`;
              const localMsgs = JSON.parse(localStorage.getItem(chatKey) || '[]');
              if (localMsgs.length > 0) {
                const existingIds = new Set((rpcData.messages || []).map(m => m.id));
                const extra = localMsgs.filter(m => !existingIds.has(m.id));
                rpcData.messages = [...(rpcData.messages || []), ...extra];
              }
            } catch(e) {}
            return rpcData;
          }
        } catch(rpcErr) {
          console.warn('lookup_order RPC error, falling back to direct table select:', rpcErr);
        }

        // 2. Direct query fallback for authenticated admin or matching access token
        const { data, error } = await client
          .from('orders')
          .select('*, order_items(*), order_status_history(*)')
          .eq('order_id', orderId)
          .maybeSingle();

        if (data) {
          const meta = data.metadata || {};
          let pref = meta.delivery_preference;
          if (!pref && data.notes) {
            if (data.notes.includes('الواتساب') || data.notes.includes('whatsapp')) pref = 'whatsapp';
            else if (data.notes.includes('البريد') || data.notes.includes('email')) pref = 'email';
            else pref = 'website';
          }

          // Return full payload if user is admin, owner, or token matches
          const isTokenAuthorized = accessToken && (accessToken === data.access_token);
          const isAdmin = typeof window.NexaSupabase?.auth?.isAdmin === 'function' ? await window.NexaSupabase.auth.isAdmin() : false;

          return {
            orderId: data.order_id,
            dbId: data.id,
            accessToken: data.access_token,
            createdAt: data.created_at,
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            customerPhone: data.customer_phone,
            phoneCountryCode: data.phone_country_code || meta.phone_country_code || 'EG',
            phoneCountryName: data.phone_country_name || meta.phone_country_name || 'مصر',
            phoneDialCode: data.phone_dial_code || meta.phone_dial_code || '+20',
            phoneNationalNumber: data.phone_national_number || meta.phone_national_number || data.customer_phone || '',
            phoneE164: data.phone_e164 || meta.phone_e164 || '',
            notes: data.notes,
            adminNotes: data.admin_notes,
            subtotalEgp: Number(data.subtotal_egp),
            discountEgp: Number(data.discount_egp),
            totalEgp: Number(data.total_egp),
            totalUsd: Number(data.total_usd),
            paymentMethod: data.payment_method,
            transferNumber: data.transfer_number,
            receiptImage: data.receipt_image_url,
            paymentStatus: data.payment_status,
            fulfillmentStatus: data.fulfillment_status,
            status: data.status,
            verifiedAt: data.verified_at,
            fulfilledAt: data.fulfilled_at,
            deliveryPreference: pref || 'website',
            isAuthorized: (isTokenAuthorized || isAdmin),
            fulfillmentData: (isTokenAuthorized || isAdmin) ? (meta.fulfillment_payload || null) : null,
            deliveryHistory: meta.delivery_history || [],
            items: (data.order_items || []).map(i => ({
              orderItemId: i.id,
              id: i.product_id || i.bundle_id,
              productId: i.product_id,
              name: i.name,
              isBundle: i.is_bundle,
              duration: i.duration,
              quantity: i.quantity,
              priceEgp: Number(i.price_egp),
              deliveryType: i.delivery_type,
              activation: i.activation_type,
              image: i.image,
              bundleContents: i.bundle_contents
            })),
            statusHistory: data.order_status_history || [],
            fulfillments: [],
            pendingDrafts: [],
            messages: []
          };
        }

        return null;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async verifyPayment(orderId, paymentStatus = 'verified', notes = null) {
      if (isConnected && client) {
        // Fetch existing order to determine current fulfillment status
        const { data: existing } = await client
          .from('orders')
          .select('id, payment_status, fulfillment_status')
          .eq('order_id', orderId)
          .maybeSingle();

        const currentFulfillment = existing?.fulfillment_status || 'unfulfilled';
        const defaultNotes = paymentStatus === 'verified'
          ? 'تم التحقق من إيصال التحويل واعتماده رسمياً'
          : 'تم رفض إيصال التحويل لعدم التطابق';

        // Always route through secure order status RPC (avoids table permission denied)
        const { data, error } = await client.rpc('update_order_status_secure', {
          p_order_id: orderId,
          p_payment_status: paymentStatus,
          p_fulfillment_status: currentFulfillment,
          p_admin_notes: notes || defaultNotes
        });

        if (error) {
          console.error('Verify payment RPC error:', error);
          throw new Error(`فشل تحديث حالة الدفع: ${error.message}`);
        }

        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async deliverOrder({ orderId, fulfillmentData, itemFulfillments = null, adminNotes = null, channel = 'website' }) {
      if (isConnected && client) {
        // Enforce payment verification prerequisite
        const { data: existing } = await client
          .from('orders')
          .select('id, payment_status, fulfillment_status')
          .eq('order_id', orderId)
          .maybeSingle();

        if (existing && existing.payment_status !== 'verified') {
          throw new Error('لا يمكن تسليم الطلب قبل التحقق من صحة الدفع واعتماده أولاً.');
        }

        const itemsPayload = Array.isArray(itemFulfillments) && itemFulfillments.length > 0
          ? itemFulfillments
          : (fulfillmentData ? [fulfillmentData] : []);

        // Strict Item Integrity: Every fulfillment item must have a valid orderItemId
        for (const item of itemsPayload) {
          if (!item.orderItemId) {
            throw new Error(`عنصر التسليم (${item.productName || item.title || 'منتج'}) غير مرتبط برمز عنصر الطلب (orderItemId). التسليم غير المربوط مرفوض.`);
          }
        }

        // 1. Primary: Use dedicated deliver_digital_order RPC
        const { data: rpcData, error: rpcErr } = await client.rpc('deliver_digital_order', {
          p_order_id: orderId,
          p_fulfillments: itemsPayload,
          p_admin_notes: adminNotes || 'تم تسليم بيانات التفعيل الرقمي ونشرها للعميل بنجاح',
          p_channel: channel
        });

        if (!rpcErr) {
          return rpcData;
        }

        // 2. Fallback: If deliver_digital_order RPC is not yet created in DB (pending migration),
        // use the existing secure update_order_status_secure RPC to complete the order transition safely.
        if (rpcErr.message && (rpcErr.message.includes('function') || rpcErr.message.includes('does not exist'))) {
          const { data: statusData, error: statusErr } = await client.rpc('update_order_status_secure', {
            p_order_id: orderId,
            p_payment_status: 'verified',
            p_fulfillment_status: 'in_progress',
            p_admin_notes: adminNotes || 'تم تسليم جزء من الطلب بنجاح'
          });

          if (statusErr) {
            console.error('Delivery status fallback error:', statusErr);
            throw new Error(`فشل تسليم الطلب: ${statusErr.message}`);
          }

          // Persist fulfillment details in secure client cache for immediate retrieval
          try {
            const cacheKey = `nexa_delivery_${orderId}`;
            localStorage.setItem(cacheKey, JSON.stringify({
              itemsPayload,
              deliveredAt: new Date().toISOString(),
              channel
            }));
          } catch (e) {}

          return { success: true, fallback: true, ...statusData };
        }

        console.error('Deliver order RPC error:', rpcErr);
        throw new Error(`فشل تسليم الطلب: ${rpcErr.message}`);
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async saveFulfillmentDraft(orderId, draftData, adminNotes = null) {
      const itemsPayload = Array.isArray(draftData) ? draftData : [draftData];

      // Strict Draft Integrity: Must contain valid orderItemId
      for (const item of itemsPayload) {
        if (!item.orderItemId) {
          throw new Error(`مسودة التفعيل (${item.productName || item.title || 'منتج'}) تتطلب رمز عنصر الطلب (orderItemId).`);
        }
      }

      // Local persistence backup
      try {
        const draftKey = `nexa_fulfillment_draft_${orderId}`;
        localStorage.setItem(draftKey, JSON.stringify({
          drafts: itemsPayload,
          adminNotes,
          savedAt: new Date().toISOString()
        }));
      } catch (e) {}

      // Server persistence via RPC when migration is applied
      if (isConnected && client) {
        try {
          const { data, error } = await client.rpc('save_fulfillment_draft', {
            p_order_id: orderId,
            p_fulfillments: itemsPayload,
            p_admin_notes: adminNotes
          });
          if (!error && data) {
            return { success: true, serverSaved: true, ...data };
          }
        } catch (rpcErr) {
          // Graceful fallback to client storage until SQL migration is executed
        }
      }

      return { success: true, serverSaved: false, drafts: itemsPayload };
    },

    async recoverOrderAccess(orderId, verificationInput) {
      if (isConnected && client) {
        // Safe manual recovery: routes to manual identity verification with abuse protection
        const { data, error } = await client.rpc('request_order_recovery', {
          p_order_id: orderId,
          p_contact_info: verificationInput || ''
        });
        if (error) {
          throw new Error(error.message || 'فشل تسجيل طلب استرجاع الطلب');
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async revealOrderCredential(orderId, orderItemId, accessToken = null) {
      if (isConnected && client) {
        const { data, error } = await client.rpc('reveal_order_credential', {
          p_order_id: orderId,
          p_order_item_id: orderItemId,
          p_access_token: accessToken || null
        });
        if (error) {
          throw new Error(error.message || 'فشل فك تشفير بيانات الحساب');
        }
        return data;
      }
      return { success: false, error: 'غير متصل بسحابة Supabase' };
    },

    async getFulfillmentTemplates() {
      if (isConnected && client) {
        try {
          const { data, error } = await client.from('fulfillment_templates').select('*').eq('is_active', true);
          if (!error && data && data.length > 0) {
            return data;
          }
        } catch (e) {}
      }
      return [
        {
          id: 'gemini_standard',
          name: 'Google Gemini Advanced (رابط دعوة + دليل 2TB)',
          categoryId: 'ai',
          defaultType: 'link',
          defaultBlocks: [
            { id: 'b_heading', type: 'heading', content: 'بيانات تفعيل اشتراك Google Gemini Advanced' },
            { id: 'b_link', type: 'link', label: 'رابط الانضمام / تفعيل الدعوة', url: '', buttonText: 'تفعيل الاشتراك الآن' },
            { id: 'b_guide', type: 'guide', title: 'خطوات التفعيل السريع', steps: [
              'افتح رابط الدعوة أعلاه في متصفحك وأنت مسجل دخولك بحساب Google الخاص بك.',
              'وافق على الانضمام لخطة العائلة / الخطة المميزة.',
              'توجه إلى gemini.google.com وستجد شارة Advanced وسعة 2TB نشطة فوراً.'
            ]},
            { id: 'b_warranty', type: 'warranty', text: 'ضمان كامل المدة المشتراة مع دعم فني مستمر.' }
          ]
        },
        {
          id: 'adobe_redemption',
          name: 'Adobe Creative Cloud (كود رقمي + خطوات الاسترداد)',
          categoryId: 'creative',
          defaultType: 'license',
          defaultBlocks: [
            { id: 'b_heading', type: 'heading', content: 'كود تفعيل باقة Adobe Creative Cloud All Apps' },
            { id: 'b_code', type: 'license', label: 'مفتاح التفعيل الرقمي (Redemption Code)', code: '' },
            { id: 'b_link', type: 'link', label: 'صفحة الاسترداد الرسمية', url: 'https://redeem.adobe.com', buttonText: 'الانتقال لصفحة استرداد أدوبي' },
            { id: 'b_guide', type: 'guide', title: 'خطوات الاسترداد الرسمية', steps: [
              'توجه إلى رابط استرداد أدوبي أعلاه وسجل دخولك بحسابك الشخصي.',
              'انسخ كود التفعيل وألصقه في الخانة المخصصة ثم اضغط استرداد.',
              'حمل تطبيق Creative Cloud واستمتع بجميع البرامج (Photoshop, Premiere, Illustrator...).'
            ]},
            { id: 'b_warning', type: 'warning', text: 'تأكد من عدم وجود اشتراك فردي نشط متعارض في حسابك قبل تطبيق الكود.' }
          ]
        },
        {
          id: 'chatgpt_account',
          name: 'ChatGPT Plus (بيانات حساب مجهز / دعوة رسمية)',
          categoryId: 'ai',
          defaultType: 'credentials',
          defaultBlocks: [
            { id: 'b_heading', type: 'heading', content: 'بيانات تفعيل اشتراك ChatGPT Plus' },
            { id: 'b_creds', type: 'credentials', title: 'بيانات الحساب المجهز', username: '', password: '', loginUrl: 'https://chatgpt.com' },
            { id: 'b_guide', type: 'guide', title: 'إرشادات الاستخدام والحماية', steps: [
              'توجه إلى chatgpt.com وسجل الدخول باستخدام البريد وكلمة السر المرفقين.',
              'استمتع بنماذج GPT-4o والذاكرة المتقدمة وإنشاء الصور وتحليل الملفات.',
              'لا تقم بتغيير كلمة السر إلا بعد مراجعة الدعم إذا كان الحساب مشتركاً.'
            ]},
            { id: 'b_warranty', type: 'warranty', text: 'ضمان كامل المدة ضد التوقف مع تعويض فوري حال حدوث أي خلل.' }
          ]
        },
        {
          id: 'linkedin_premium',
          name: 'LinkedIn Business / Career (رابط ترويجي + شروط الأهلية)',
          categoryId: 'office',
          defaultType: 'link',
          defaultBlocks: [
            { id: 'b_heading', type: 'heading', content: 'رابط تفعيل ترقية LinkedIn Premium' },
            { id: 'b_link', type: 'link', label: 'رابط التفعيل الترويجي المباشر', url: '', buttonText: 'تفعيل LinkedIn Premium' },
            { id: 'b_guide', type: 'guide', title: 'خطوات التفعيل والشروط', steps: [
              'تأكد من عدم وجود اشتراك Premium نشط حالياً على حسابك الشخصي.',
              'افتح الرابط أعلاه من متصفحك وسجل الدخول بحسابك.',
              'وافق على الترقية وستتفعل ميزات InMail و Learning والشارة الذهبية فوراً.'
            ]},
            { id: 'b_warranty', type: 'warranty', text: 'ضمان كامل المدة مع ترقية رسمية 100%.' }
          ]
        },
        {
          id: 'generic_license',
          name: 'كود / مفتاح ترخيص رقمي (Generic License Key)',
          categoryId: 'general',
          defaultType: 'license',
          defaultBlocks: [
            { id: 'b_heading', type: 'heading', content: 'مفتاح الترخيص الرقمي الرسمي' },
            { id: 'b_code', type: 'license', label: 'مفتاح الترخيص / كود التفعيل', code: '' },
            { id: 'b_guide', type: 'guide', title: 'طريقة استخدام الكود', steps: [
              'افتح البرنامج أو المنصة المطلوبة.',
              'توجه إلى خانة التفعيل وألصق الكود الموضح أعلاه.',
              'اضغط تفعيل واستمتع بالخدمة.'
            ]}
          ]
        },
        {
          id: 'manual_service',
          name: 'خدمة مفعلة يدوياً (تأكيد ورسالة شكر)',
          categoryId: 'manual',
          defaultType: 'manual',
          defaultBlocks: [
            { id: 'b_heading', type: 'heading', content: 'تم تفعيل الخدمة بنجاح من قبل الإدارة' },
            { id: 'b_msg', type: 'message', content: 'تمت ترقية حسابك وتأكيد الاشتراك بنجاح من قبل فريق العمل. يمكنك الاستمتاع بكامل الميزات الآن.' },
            { id: 'b_warranty', type: 'warranty', text: 'ضمان كامل المدة مع دعم فني مستمر.' }
          ]
        }
      ];
    },

    async getFulfillmentDraft(orderId) {
      if (isConnected && client) {
        // 1. Check dedicated order_fulfillment_drafts table
        try {
          let targetId = orderId;
          const { data: dbOrder } = await client
            .from('orders')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle();
          if (dbOrder?.id) targetId = dbOrder.id;

          const { data, error } = await client
            .from('order_fulfillment_drafts')
            .select('*')
            .eq('order_id', targetId);

          if (!error && data && data.length > 0) {
            return data;
          }
        } catch (e) {}

        // 2. Check via lookup_order if admin session
        try {
          const { data: rpcData } = await client.rpc('lookup_order', {
            p_order_id: orderId
          });
          if (rpcData && Array.isArray(rpcData.pendingDrafts) && rpcData.pendingDrafts.length > 0) {
            return rpcData.pendingDrafts;
          }
        } catch(e) {}
      }

      try {
        const cached = localStorage.getItem(`nexa_fulfillment_draft_${orderId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed.drafts || [parsed];
        }
      } catch (e) {}
      return [];
    },

    async markMessagesRead(orderId, readerType = 'admin', accessToken = null) {
      if (isConnected && client) {
        try {
          await client.rpc('mark_order_messages_read', {
            p_order_id: orderId,
            p_reader_type: readerType,
            p_access_token: accessToken
          });
        } catch (e) {}
      }
    },

    async calculateCoinsRedemption(subtotalEgp, coinsRequested = 0) {
      if (isConnected && client) {
        try {
          const { data, error } = await client.rpc('calculate_order_coins_redemption', {
            p_subtotal_egp: subtotalEgp,
            p_coins_requested: coinsRequested
          });
          if (!error && data && data.is_enabled) return data;
        } catch (e) {}
      }
      // If server-side loyalty migration is not installed yet, keep redemption disabled
      return {
        is_enabled: false,
        is_available: false,
        reason: 'pending_activation',
        redeem_rate_egp: 0.5,
        min_redeem_coins: 10,
        max_discount_percentage: 50,
        max_eligible_coins: 0,
        coins_to_use: 0,
        discount_egp: 0,
        final_payable: subtotalEgp,
        coins_to_earn_on_completion: 0
      };
    },

    async reserveAndRedeemCoins(orderId, coinsToRedeem, idempotencyKey = null) {
      if (isConnected && client && coinsToRedeem > 0) {
        try {
          const { data, error } = await client.rpc('reserve_and_redeem_coins', {
            p_order_id: orderId,
            p_coins_to_redeem: coinsToRedeem,
            p_idempotency_key: idempotencyKey || null
          });
          if (error) {
            console.warn('reserve_and_redeem_coins note:', error.message);
            return { success: false, reason: 'pending_activation' };
          }
          return data;
        } catch (e) {
          console.warn('reserve_and_redeem_coins exception:', e.message);
          return { success: false, reason: 'pending_activation' };
        }
      }
      return { success: true, coins_redeemed: 0 };
    },

    async uploadAttachment(file, orderId) {
      if (!file) throw new Error('يرجى اختيار ملف صالح.');
      const maxSize = 10 * 1024 * 1024; // 10MB limit matching DB policy
      if (file.size > maxSize) throw new Error('حجم الملف يتجاوز الحد المسموح (10 ميجابايت).');

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('نوع الملف غير مدعوم. الصيغ المسموحة: JPG, PNG, WEBP, GIF, PDF.');
      }

      // Try uploading to Supabase Storage private bucket 'order-attachments'
      if (isConnected && client) {
        try {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
          const filePath = `${orderId}/${cleanName}`;
          const { data, error } = await client.storage
            .from('order-attachments')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

          if (!error && data) {
            // Generate valid short-lived signed URL for private bucket delivery (15 minutes)
            let resolvedUrl = filePath;
            try {
              const { data: signedData } = await client.storage
                .from('order-attachments')
                .createSignedUrl(filePath, 900);
              if (signedData?.signedUrl) {
                resolvedUrl = signedData.signedUrl;
              }
            } catch(e) {}

            return {
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              storagePath: filePath,
              url: resolvedUrl
            };
          }
        } catch (storageErr) {}
      }

      // Fallback: Read as base64 Data URL for client preview & temporary persistence
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            url: reader.result,
            isLocal: true
          });
        };
        reader.onerror = () => reject(new Error('فشل قراءة الملف المرفوع.'));
        reader.readAsDataURL(file);
      });
    },

    async getAttachmentUrl(pathOrUrl, orderId = null, accessToken = null) {
      if (!pathOrUrl) return null;
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
        return pathOrUrl;
      }
      if (isConnected && client) {
        try {
          // If admin / authenticated user with select permission
          const { data, error } = await client.storage
            .from('order-attachments')
            .createSignedUrl(pathOrUrl, 900);
          if (!error && data?.signedUrl) {
            return data.signedUrl;
          }
        } catch (e) {}

        // For guest customer, obtain requester-bound permission grant
        if (orderId && accessToken) {
          try {
            const { data } = await client.rpc('create_attachment_download_grant', {
              p_order_id: orderId,
              p_access_token: accessToken,
              p_file_path: pathOrUrl
            });
            if (data?.success) {
              // Validated server grant issued
            }
          } catch(e) {}
        }
      }
      return pathOrUrl;
    },

    async addOrderMessage({ orderId, accessToken = null, message, attachments = [], isInternal = false }) {
      if (isConnected && client) {
        try {
          const { data, error } = await client.rpc('add_order_message', {
            p_order_id: orderId,
            p_access_token: accessToken,
            p_message: message || '',
            p_attachments: attachments || [],
            p_is_internal: isInternal
          });
          if (!error && data) {
            return data;
          }
          if (error && !error.message?.includes('function') && !error.message?.includes('does not exist')) {
            throw new Error(error.message);
          }
        } catch (rpcErr) {
          if (rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
            throw rpcErr;
          }
        }
      }

      // Fallback client conversation caching
      try {
        const chatKey = `nexa_order_chat_${orderId}`;
        const existing = JSON.parse(localStorage.getItem(chatKey) || '[]');
        const newMsg = {
          id: 'local_' + Date.now(),
          senderType: accessToken ? 'customer' : 'admin',
          senderName: accessToken ? 'العميل' : 'فريق دعم Activkeyz',
          message: message || '',
          attachments: attachments || [],
          isInternalNote: isInternal,
          createdAt: new Date().toISOString()
        };
        existing.push(newMsg);
        localStorage.setItem(chatKey, JSON.stringify(existing));
        return { success: true, localOnly: true, message_id: newMsg.id };
      } catch (e) {}

      return { success: true };
    },

    async updateStatusSecure({ orderId, paymentStatus, fulfillmentStatus, adminNotes = null }) {
      if (isConnected && client) {
        const { data, error } = await client.rpc('update_order_status_secure', {
          p_order_id: orderId,
          p_payment_status: paymentStatus,
          p_fulfillment_status: fulfillmentStatus,
          p_admin_notes: adminNotes
        });

        if (error) {
          console.error('update_order_status_secure error:', error);
          throw new Error(`فشل تحديث حالة الطلب: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async updateStatus(orderId, paymentStatus, fulfillmentStatus, adminNotes = null) {
      return this.updateStatusSecure({
        orderId,
        paymentStatus: paymentStatus || 'unverified',
        fulfillmentStatus: fulfillmentStatus || 'unfulfilled',
        adminNotes
      });
    },

    async delete(orderId) {
      if (isConnected && client) {
        const { error } = await client.from('orders').delete().eq('order_id', orderId);
        if (error) {
          console.error('Delete order error:', error);
          throw new Error(`فشل حذف الطلب: ${error.message}`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async expireUnpaid(timeoutHours = 48) {
      if (isConnected && client) {
        const { data, error } = await client.rpc('expire_unpaid_orders', {
          p_timeout_hours: timeoutHours
        });
        if (error) throw new Error(`فشل إلغاء الطلبات المتأخرة: ${error.message}`);
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async calculateCoinsRedemption(subtotalEgp, coinsRequested = 0) {
      if (isConnected && client) {
        try {
          const { data, error } = await client.rpc('calculate_order_coins_redemption', {
            p_subtotal_egp: Number(subtotalEgp),
            p_coins_requested: Number(coinsRequested)
          });
          if (!error && data) return data;
        } catch (e) {}
      }
      // Client-side fallback matching default rules (1 coin = 0.50 EGP, max 50% discount)
      const maxDiscountEgp = subtotalEgp * 0.50;
      const maxEligibleCoins = Math.floor(maxDiscountEgp / 0.50);
      const coinsToUse = Math.min(Number(coinsRequested), maxEligibleCoins);
      const discountEgp = Math.round(coinsToUse * 0.50);
      const finalPayable = Math.max(0, subtotalEgp - discountEgp);
      return {
        is_enabled: true,
        earn_rate_ratio: 0.10,
        redeem_rate_egp: 0.50,
        min_redeem_coins: 10,
        max_discount_percentage: 50.00,
        max_eligible_coins: maxEligibleCoins,
        coins_to_use: coinsToUse,
        discount_egp: discountEgp,
        final_payable: finalPayable,
        coins_to_earn_on_completion: Math.floor(finalPayable * 0.10)
      };
    },

    async reserveAndRedeemCoins(orderId, coinsToRedeem) {
      if (!coinsToRedeem || coinsToRedeem <= 0) return { success: true };
      if (isConnected && client) {
        try {
          const { data, error } = await client.rpc('reserve_and_redeem_coins', {
            p_order_id: orderId,
            p_coins_to_redeem: Number(coinsToRedeem)
          });
          if (!error && data) return data;
          if (error) console.warn('reserve_and_redeem_coins RPC warning:', error);
        } catch (e) {
          console.warn('reserve_and_redeem_coins RPC exception:', e);
        }
      }
      return { success: true };
    }
  };

  // -------------------------------------------------------------------
  // 9. COUPONS API
  // -------------------------------------------------------------------
  const couponsApi = {
    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client
          .from('coupons')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Coupons fetch error:', error);
          throw new Error(`خطأ في جلب الكوبونات من السحابة: ${error.message} (${error.code || ''})`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async create(coupon) {
      if (isConnected && client) {
        const { data, error } = await client.from('coupons').insert([coupon]).select().single();
        if (error) {
          console.error('Create coupon error:', error);
          throw new Error(`فشل حفظ الكوبون في السحابة: ${error.message} (${error.code || ''})`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async update(id, updates) {
      if (isConnected && client) {
        const { data, error } = await client.from('coupons').update(updates).eq('id', id).select().single();
        if (error) {
          console.error('Update coupon error:', error);
          throw new Error(`فشل تحديث الكوبون: ${error.message} (${error.code || ''})`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async toggleActive(id, isActive) {
      return await this.update(id, { is_active: isActive });
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('coupons').delete().eq('id', id);
        if (error) {
          console.error('Delete coupon error:', error);
          throw new Error(`فشل حذف الكوبون: ${error.message} (${error.code || ''})`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async validate(code, subtotal = 0) {
      if (!code) return { valid: false, message: 'يرجى كتابة رمز الكوبون' };
      if (isConnected && client) {
        const { data, error } = await client
          .from('coupons')
          .select('*')
          .eq('code', code.toUpperCase().trim())
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Coupon validation query error:', error);
          return { valid: false, message: 'فشل التحقق من الكوبون من قاعدة البيانات' };
        }

        if (!data) {
          return { valid: false, message: 'رمز الكوبون غير صالح أو غير مفعل' };
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          return { valid: false, message: 'عذراً، انتهت صلاحية هذا الكوبون' };
        }

        if (data.usage_limit && data.usage_count >= data.usage_limit) {
          return { valid: false, message: 'عذراً، تم استنفاد الحد الأقصى لاستخدام هذا الكوبون' };
        }

        if (subtotal < (Number(data.min_order_value) || 0)) {
          return { valid: false, message: `الحد الأدنى للطلب لتفعيل هذا الكوبون هو ${data.min_order_value} ج.م` };
        }

        let discountAmount = 0;
        if (data.discount_type === 'percentage') {
          discountAmount = Math.round(subtotal * (Number(data.discount_value) / 100));
          if (data.max_discount_amount) {
            discountAmount = Math.min(discountAmount, Number(data.max_discount_amount));
          }
        } else {
          discountAmount = Math.min(Number(data.discount_value), subtotal);
        }

        return {
          valid: true,
          code: data.code,
          discountType: data.discount_type,
          discountValue: Number(data.discount_value),
          discountAmount,
          message: `تم تطبيق خصم بقيمة ${discountAmount} ج.م بنجاح!`
        };
      }
      return { valid: false, message: 'قاعدة بيانات المتجر غير متصلة بالسحابة.' };
    }
  };

  // -------------------------------------------------------------------
  // 10. CUSTOMERS / PROFILES API
  // -------------------------------------------------------------------
  const customersApi = {
    async getAll() {
      if (isConnected && client) {
        try {
          const { data, error } = await client
            .from('profiles')
            .select('*, loyalty_wallets(available_balance, pending_balance, lifetime_earned)')
            .order('created_at', { ascending: false });
          if (!error && Array.isArray(data)) return data;
        } catch (e) {}

        const { data, error } = await client
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Customers fetch error:', error);
          throw new Error(`خطأ في جلب المستخدمين من السحابة: ${error.message} (${error.code || ''})`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async updateRole(userId, newRole) {
      if (isConnected && client) {
        const { data, error } = await client.rpc('assign_admin_role', {
          p_user_id: userId,
          p_role: newRole
        });
        if (error) {
          console.error('Update customer role error:', error);
          throw new Error(`فشل تعديل صلاحية المستخدم: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 10B. LOYALTY & REWARDS API (ADMIN & AUDIT)
  // -------------------------------------------------------------------
  const loyaltyApi = {
    async getRules() {
      if (isConnected && client) {
        try {
          const { data } = await client.from('loyalty_rules').select('*').eq('id', 'default').maybeSingle();
          if (data) return data;
        } catch(e) {}
      }
      return {
        is_enabled: true,
        earn_rate_ratio: 0.1000,
        redeem_rate_egp: 0.5000,
        min_redeem_coins: 10,
        max_discount_percentage: 50.00,
        allow_full_coin_payment: true
      };
    },

    async updateRules(rules) {
      if (isConnected && client) {
        const payload = {
          id: 'default',
          is_enabled: Boolean(rules.is_enabled),
          earn_rate_ratio: Number(rules.earn_rate_ratio) || 0.10,
          redeem_rate_egp: Number(rules.redeem_rate_egp) || 0.50,
          min_redeem_coins: parseInt(rules.min_redeem_coins) || 10,
          max_discount_percentage: Number(rules.max_discount_percentage) || 50.00,
          allow_full_coin_payment: Boolean(rules.allow_full_coin_payment),
          updated_at: new Date().toISOString()
        };
        const { data, error } = await client.from('loyalty_rules').upsert(payload).select().single();
        if (error) throw new Error(`فشل تحديث قواعد المكافآت: ${error.message}`);
        return data;
      }
      throw new Error('غير متصل بالسحابة');
    },

    async adminAdjustCoins({ targetUserId, amount, reason }) {
      if (!reason || !reason.trim()) {
        throw new Error('سبب التعديل إلزامي للتوثيق والمساءلة الرقابية (Audit Log).');
      }
      if (isConnected && client) {
        const { data, error } = await client.rpc('admin_adjust_customer_coins', {
          p_target_user_id: targetUserId,
          p_amount: parseInt(amount),
          p_reason: reason.trim()
        });
        if (error) throw new Error(error.message || 'فشل تطبيق التعديل');
        return data;
      }
      throw new Error('غير متصل بالسحابة');
    },

    async getAuditLog(limit = 50) {
      if (isConnected && client) {
        try {
          const { data } = await client
            .from('loyalty_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
          return data || [];
        } catch (e) {
          return [];
        }
      }
      return [];
    },

    async getAllTransactions(limit = 100) {
      if (isConnected && client) {
        try {
          const { data } = await client
            .from('loyalty_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
          return data || [];
        } catch (e) {
          return [];
        }
      }
      return [];
    }
  };

  // -------------------------------------------------------------------
  // 11. STORE SETTINGS API
  // -------------------------------------------------------------------
  const settingsApi = {
    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client.from('store_settings').select('*');
        if (error) {
          console.error('Store settings fetch error:', error);
          throw new Error(`خطأ في جلب إعدادات المتجر: ${error.message} (${error.code || ''})`);
        }
        const map = {};
        if (Array.isArray(data)) {
          data.forEach(item => { map[item.key] = item.value; });
        }
        return map;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async get(key) {
      if (isConnected && client) {
        const { data, error } = await client.from('store_settings').select('value').eq('key', key).maybeSingle();
        if (error) throw new Error(`خطأ في جلب الإعداد ${key}: ${error.message}`);
        return data ? data.value : null;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async set(key, value) {
      if (isConnected && client) {
        const { data, error } = await client.from('store_settings').upsert({ key, value }).select().single();
        if (error) {
          console.error('Set setting error:', error);
          throw new Error(`فشل حفظ الإعدادات: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 12. REVIEWS API
  // -------------------------------------------------------------------
  const reviewsApi = {
    async getAll(includeUnapproved = false) {
      if (isConnected && client) {
        let q = client
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false });

        if (!includeUnapproved) {
          q = q.eq('is_approved', true);
        }

        const { data, error } = await q;
        if (error) {
          console.error('Reviews fetch error:', error);
          throw new Error(`خطأ في جلب التقييمات: ${error.message} (${error.code || ''})`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async create(review) {
      if (isConnected && client) {
        const { data, error } = await client.from('reviews').insert([{
          product_id: review.productId || null,
          customer_name: review.name,
          product_name: review.productName,
          category: review.category || 'ai',
          rating: Number(review.rating) || 5,
          comment: review.comment,
          is_verified: false,
          is_approved: false
        }]).select().single();

        if (error) {
          console.error('Create review error:', error);
          throw new Error(`فشل حفظ التقييم: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async toggleApproval(id, isApproved) {
      if (isConnected && client) {
        const { data, error } = await client.from('reviews').update({ is_approved: isApproved }).eq('id', id).select().single();
        if (error) {
          console.error('Toggle review approval error:', error);
          throw new Error(`فشل تحديث اعتماد التقييم: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('reviews').delete().eq('id', id);
        if (error) {
          console.error('Delete review error:', error);
          throw new Error(`فشل حذف التقييم: ${error.message}`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 13. SUPPORT TICKETS API
  // -------------------------------------------------------------------
  const ticketsApi = {
    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client.from('support_tickets').select('*').order('created_at', { ascending: false });
        if (error) {
          console.error('Support tickets fetch error:', error);
          throw new Error(`خطأ في جلب تذاكر الدعم: ${error.message} (${error.code || ''})`);
        }
        return Array.isArray(data) ? data : [];
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async create(ticket) {
      const ticketNum = 'TCK-' + Math.floor(100000 + Math.random() * 900000);
      if (isConnected && client) {
        const { data, error } = await client.from('support_tickets').insert([{
          ticket_number: ticketNum,
          customer_name: ticket.name,
          customer_email: ticket.email,
          customer_phone: ticket.phone,
          subject: ticket.subject,
          message: ticket.message
        }]).select().single();

        if (error) {
          console.error('Create ticket error:', error);
          throw new Error(`فشل إرسال تذكرة الدعم: ${error.message}`);
        }
        return { ...ticket, ticketNumber: ticketNum };
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async updateStatus(id, status, adminReply = null) {
      if (isConnected && client) {
        const payload = { status, updated_at: new Date().toISOString() };
        if (adminReply !== null) payload.admin_reply = adminReply;
        const { data, error } = await client.from('support_tickets').update(payload).eq('id', id).select().single();
        if (error) {
          console.error('Update ticket error:', error);
          throw new Error(`فشل تحديث التذكرة: ${error.message}`);
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client.from('support_tickets').delete().eq('id', id);
        if (error) {
          console.error('Delete ticket error:', error);
          throw new Error(`فشل حذف التذكرة: ${error.message}`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 14. AUTH API
  // -------------------------------------------------------------------
  // 12. CUSTOMER & AUTH API (Email + Password Direct Auth)
  // -------------------------------------------------------------------
  const authApi = {
    async signUp(emailOrObj, passwordArg, fullNameArg, phoneArg) {
      if (isConnected && client) {
        let cleanEmail = '';
        let pwd = '';
        let fullName = '';
        let phone = '';

        if (typeof emailOrObj === 'object' && emailOrObj !== null) {
          cleanEmail = (emailOrObj.email || '').trim().toLowerCase();
          pwd = emailOrObj.password || '';
          fullName = (emailOrObj.fullName || emailOrObj.full_name || emailOrObj.options?.data?.full_name || '').trim();
          phone = (emailOrObj.phone || emailOrObj.options?.data?.phone || '').trim();
        } else {
          cleanEmail = (emailOrObj || '').trim().toLowerCase();
          pwd = passwordArg || '';
          fullName = (fullNameArg || '').trim();
          phone = (phoneArg || '').trim();
        }

        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password: pwd,
          options: {
            data: {
              full_name: fullName,
              phone: phone
            }
          }
        });
        if (error) throw error;

        // Ensure customer profile record is created/updated if user session exists
        if (data?.user) {
          try {
            await client.from('profiles').upsert({
              id: data.user.id,
              full_name: fullName || data.user.user_metadata?.full_name || '',
              phone: phone || data.user.user_metadata?.phone || '',
              role: 'customer'
            });
          } catch (pErr) {
            console.warn('Profile upsert note:', pErr);
          }
        }
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async signInWithPassword(emailOrObj, passwordArg) {
      if (isConnected && client) {
        let cleanEmail = '';
        let pwd = '';
        if (typeof emailOrObj === 'object' && emailOrObj !== null) {
          cleanEmail = (emailOrObj.email || '').trim().toLowerCase();
          pwd = emailOrObj.password || '';
        } else {
          cleanEmail = (emailOrObj || '').trim().toLowerCase();
          pwd = passwordArg || '';
        }
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password: pwd
        });
        if (error) throw error;
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async signIn(email, password) {
      return this.signInWithPassword(email, password);
    },

    async signOut() {
      if (isConnected && client) {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
      sessionStorage.removeItem('nexa_admin_authenticated');
      return true;
    },

    async getUser() {
      if (isConnected && client) {
        const { data: { user } } = await client.auth.getUser();
        return user;
      }
      return null;
    },

    async getSession() {
      if (isConnected && client) {
        const { data: { session } } = await client.auth.getSession();
        return session;
      }
      return null;
    },

    onAuthStateChange(callback) {
      if (isConnected && client) {
        return client.auth.onAuthStateChange(callback);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    },

    async isAdmin() {
      if (!isConnected || !client) return false;
      try {
        const { data, error } = await client.rpc('is_admin');
        if (!error && data === true) return true;

        const { data: { user } } = await client.auth.getUser();
        if (user) {
          const { data: profile } = await client
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          return profile && profile.role === 'admin';
        }
      } catch (e) {
        console.warn('isAdmin check exception:', e);
      }
      return false;
    },

    async signInWithOtp(email, fullName = '', phone = '') {
      if (isConnected && client) {
        const cleanEmail = email.trim().toLowerCase();
        const { data, error } = await client.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim()
            },
            emailRedirectTo: window.location.origin + '/account.html'
          }
        });
        if (error) throw error;
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async verifyOtp(email, token) {
      if (isConnected && client) {
        const cleanEmail = email.trim().toLowerCase();
        const { data, error } = await client.auth.verifyOtp({
          email: cleanEmail,
          token: token.trim(),
          type: 'email'
        });
        if (error) throw error;
        try {
          if (data?.user) {
            const meta = data.user.user_metadata || {};
            await client.from('profiles').upsert({
              id: data.user.id,
              full_name: meta.full_name || '',
              phone: meta.phone || ''
            });
          }
        } catch (e) {}
        return data;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async getProfile() {
      if (isConnected && client) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return null;
        const { data: profile } = await client
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        return {
          id: user.id,
          email: user.email,
          fullName: profile?.full_name || user.user_metadata?.full_name || '',
          phone: profile?.phone || user.user_metadata?.phone || '',
          role: profile?.role || 'customer',
          createdAt: profile?.created_at || user.created_at
        };
      }
      return null;
    },

    async updateProfile({ fullName, phone }) {
      if (isConnected && client) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('يرجى تسجيل الدخول أولاً');
        const { error } = await client
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: fullName.trim(),
            phone: phone.trim()
          });
        if (error) throw error;
        return true;
      }
      throw new Error('تعذر تحديث بيانات الحساب حالياً.');
    },

    async getWallet() {
      if (isConnected && client) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return null;
        try {
          const { data, error } = await client.rpc('get_or_create_customer_wallet', {
            p_user_id: user.id
          });
          if (!error && data?.success) {
            return {
              is_available: true,
              ...data
            };
          }
        } catch (e) {}

        try {
          const { data: wallet, error } = await client
            .from('loyalty_wallets')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (!error && wallet) {
            return {
              is_available: true,
              ...wallet
            };
          }
        } catch (e) {}

        // Backend loyalty migration has not been executed yet
        return {
          is_available: false,
          status: 'pending_activation',
          available_balance: null,
          lifetime_earned: null
        };
      }
      return {
        is_available: false,
        status: 'pending_activation',
        available_balance: null,
        lifetime_earned: null
      };
    },

    async getWalletTransactions() {
      if (isConnected && client) {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return [];
        const { data: txs } = await client
          .from('loyalty_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        return txs || [];
      }
      return [];
    },

    async claimGuestOrder(orderId, accessToken) {
      if (isConnected && client) {
        const { data, error } = await client.rpc('claim_guest_order_with_token', {
          p_order_id: orderId,
          p_access_token: accessToken
        });
        if (error) throw new Error(error.message || 'فشل ربط الطلب بالحساب');
        return data;
      }
      throw new Error('غير متصل بالسحابة');
    },

    getCustomerIdentityId() {
      try {
        let cId = localStorage.getItem('nexa_customer_identity_id');
        if (!cId) {
          cId = 'cst_' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
          localStorage.setItem('nexa_customer_identity_id', cId);
        }
        return cId;
      } catch (e) {
        return 'cst_guest_device';
      }
    },

    getCustomerOrders() {
      try {
        const cId = this.getCustomerIdentityId();
        const orders = JSON.parse(localStorage.getItem('nexa_orders') || '[]');
        return orders.filter(o => !o.customerIdentityId || o.customerIdentityId === cId);
      } catch(e) {
        return [];
      }
    },

    onAuthStateChange(callback) {
      if (isConnected && client) {
        return client.auth.onAuthStateChange(callback);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  };

  // -------------------------------------------------------------------
  // 15. REALTIME SUBSCRIPTIONS
  // -------------------------------------------------------------------
  const realtimeApi = {
    subscribeToOrders(callback) {
      if (!isConnected || !client) return null;
      try {
        const channel = client
          .channel('public:orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            console.log('⚡ Realtime Order Update:', payload);
            if (typeof callback === 'function') callback(payload);
          })
          .subscribe();
        return channel;
      } catch (e) {
        console.error('Failed to subscribe to realtime orders:', e);
        return null;
      }
    },

    subscribeToProducts(callback) {
      if (!isConnected || !client) return null;
      try {
        const channel = client
          .channel('public:products')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
            console.log('⚡ Realtime Product Update:', payload);
            if (typeof callback === 'function') callback(payload);
          })
          .subscribe();
        return channel;
      } catch (e) {
        console.error('Failed to subscribe to realtime products:', e);
        return null;
      }
    },

    subscribeToInventory(callback) {
      if (!isConnected || !client) return null;
      try {
        const channel = client
          .channel('public:product_inventory')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'product_inventory' }, payload => {
            console.log('⚡ Realtime Inventory Update:', payload);
            if (typeof callback === 'function') callback(payload);
          })
          .subscribe();
        return channel;
      } catch (e) {
        console.error('Failed to subscribe to realtime inventory:', e);
        return null;
      }
    }
  };

  // -------------------------------------------------------------------
  // 15B. Product Variants API (Dedicated Real Variant CRUD)
  // -------------------------------------------------------------------
  const variantsApi = {
    async getByProductId(productId) {
      if (isConnected && client) {
        const { data, error } = await client
          .from('product_variants')
          .select('id, product_id, name, duration, price_egp, price_usd, is_active, display_order')
          .eq('product_id', productId)
          .order('display_order', { ascending: true });
        if (error) {
          console.error('Error fetching variants for product:', error);
          throw new Error(`خطأ في جلب باقات المنتج: ${error.message}`);
        }
        return Array.isArray(data) ? data : [];
      }
      return [];
    },

    async getAll() {
      if (isConnected && client) {
        const { data, error } = await client
          .from('product_variants')
          .select('id, product_id, name, duration, price_egp, price_usd, is_active, display_order')
          .order('display_order', { ascending: true });
        if (error) {
          console.error('Error fetching all variants:', error);
          throw new Error(`خطأ في جلب باقات المنتجات: ${error.message}`);
        }
        return Array.isArray(data) ? data : [];
      }
      return [];
    },

    async create(variant) {
      if (isConnected && client) {
        const payload = {
          product_id: variant.productId || variant.product_id,
          name: variant.name,
          duration: variant.duration || '1 شهر',
          price_egp: Number(variant.priceEgp !== undefined ? variant.priceEgp : variant.price_egp) || 0,
          price_usd: Number(variant.priceUsd !== undefined ? variant.priceUsd : variant.price_usd) || (Number(variant.priceEgp || variant.price_egp) / 50),
          is_active: variant.isActive !== undefined ? Boolean(variant.isActive) : true,
          display_order: Number(variant.displayOrder || variant.display_order) || 0
        };
        const { data, error } = await client
          .from('product_variants')
          .insert([payload])
          .select('id')
          .single();
        if (error) {
          console.error('Create variant error:', error);
          throw new Error(`فشل إضافة باقة/متغير المنتج: ${error.message}`);
        }
        return { ...payload, id: data.id };
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async update(id, updates) {
      if (isConnected && client) {
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.duration !== undefined) payload.duration = updates.duration;
        if (updates.priceEgp !== undefined || updates.price_egp !== undefined) {
          payload.price_egp = Number(updates.priceEgp !== undefined ? updates.priceEgp : updates.price_egp);
        }
        if (updates.priceUsd !== undefined || updates.price_usd !== undefined) {
          payload.price_usd = Number(updates.priceUsd !== undefined ? updates.priceUsd : updates.price_usd);
        }
        if (updates.isActive !== undefined || updates.is_active !== undefined) {
          payload.is_active = Boolean(updates.isActive !== undefined ? updates.isActive : updates.is_active);
        }
        if (updates.displayOrder !== undefined || updates.display_order !== undefined) {
          payload.display_order = Number(updates.displayOrder !== undefined ? updates.displayOrder : updates.display_order);
        }

        const { error } = await client
          .from('product_variants')
          .update(payload)
          .eq('id', id);
        if (error) {
          console.error('Update variant error:', error);
          throw new Error(`فشل تحديث باقة المنتج: ${error.message}`);
        }
        return { id, ...payload };
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    },

    async delete(id) {
      if (isConnected && client) {
        const { error } = await client
          .from('product_variants')
          .delete()
          .eq('id', id);
        if (error) {
          console.error('Delete variant error:', error);
          throw new Error(`فشل حذف باقة المنتج: ${error.message}`);
        }
        return true;
      }
      throw new Error('قاعدة بيانات المتجر غير متصلة بسحابة Supabase.');
    }
  };

  // -------------------------------------------------------------------
  // 16. Public Export on window.NexaSupabase
  // -------------------------------------------------------------------
  window.NexaSupabase = {
    url: SUPABASE_URL,
    projectRef: SUPABASE_PROJECT_REF,
    getClient: () => {
      if (!client && window.supabase && typeof window.supabase.createClient === 'function') {
        initClient();
      }
      return client;
    },
    isConfigured: () => isConnected,
    setAnonKey: (key) => {
      SUPABASE_ANON_KEY = key;
      localStorage.setItem('nexa_supabase_anon_key', key);
      initClient();
    },
    categories: categoriesApi,
    products: productsApi,
    variants: variantsApi,
    inventory: inventoryApi,
    bundles: bundlesApi,
    payments: paymentsApi,
    orders: ordersApi,
    coupons: couponsApi,
    customers: customersApi,
    loyalty: loyaltyApi,
    calculateCoinsRedemption: (...args) => ordersApi.calculateCoinsRedemption(...args),
    reserveAndRedeemCoins: (...args) => ordersApi.reserveAndRedeemCoins(...args),
    settings: settingsApi,
    reviews: reviewsApi,
    tickets: ticketsApi,
    storage: storageApi,
    auth: authApi,
    realtime: realtimeApi
  };

  window.ActivKeyzSupabase = window.NexaSupabase;
  window.ActivkeyzSupabase = window.NexaSupabase;

})();
