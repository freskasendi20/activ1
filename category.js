/* ===================================================================
   ACTIVKEYZ - CATEGORY CATALOG CONTROLLER (category.js)
   Dedicated customer-facing catalog controller.
   Zero bot names, zero supplier terminology.
   =================================================================== */

const CATEGORY_META = {
  all: {
    title: 'جميع المنتجات والاشتراكات الرقمية',
    desc: 'تصفح كافة الاشتراكات الرقمية والبرامج المعتمدة بأفضل الأسعار الرسمية والضمان الفوري الشامل.',
    badge: 'جميع الأقسام'
  },
  ai: {
    title: 'أدوات الذكاء الاصطناعي (AI Tools)',
    desc: 'أحدث نماذج الذكاء الاصطناعي والإنتاجية الذكية ChatGPT Plus, Gemini, Perplexity, Runway, ElevenLabs.',
    badge: 'أدوات الذكاء الاصطناعي'
  },
  creative: {
    title: 'البرامج الإبداعية والتصميم (Creative Suite)',
    desc: 'حزم التصميم والمونتاج الاحترافية CapCut Pro, Adobe Creative Cloud, Figma Pro, Framer Pro.',
    badge: 'البرامج الإبداعية'
  },
  office: {
    title: 'برامج المكتب والإنتاجية (Office & Work)',
    desc: 'أدوات الأعمال والشركات Microsoft Office 365, Notion, Zoom Pro, Coursera, LinkedIn Learning.',
    badge: 'برامج المكتب'
  },
  streaming: {
    title: 'الترفيه والاشتراكات (Streaming & Media)',
    desc: 'منصات البث والموسيقى YouTube Premium, Spotify, Apple Music, Prime Video بدون إعلانات.',
    badge: 'الترفيه والاشتراكات'
  },
  gaming: {
    title: 'الألعاب والبطاقات وشبكات الحماية (Gaming & Security)',
    desc: 'اشتراكات الألعاب وسيرفرات الديسكورد وشبكات VPN العسكرية Discord Nitro, NordVPN, ProtonVPN.',
    badge: 'الألعاب والبطاقات'
  }
};

let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'featured';
let cartItems = [];

// Initialize Page
function initCategoryPage() {
  // Read category from URL
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get('cat');
  if (catParam && CATEGORY_META[catParam]) {
    currentCategory = catParam;
  }

  // Read search query from URL
  const searchParam = params.get('search') || params.get('q');
  if (searchParam) {
    currentSearch = searchParam.trim().toLowerCase();
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) searchInput.value = searchParam;
    const headerSearch = document.getElementById('searchInput');
    if (headerSearch) headerSearch.value = searchParam;
    const mobSearch = document.getElementById('mobileSearchInput');
    if (mobSearch) mobSearch.value = searchParam;
  }

  // Highlight matching pill
  updateActivePill(currentCategory);
  updateHeroHeader(currentCategory);

  // Setup pill click listeners
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = pill.getAttribute('data-category');
      setCategory(cat);
    });
  });

  // Setup search input
  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim().toLowerCase();
      renderCatalog();
    });
  }

  // Setup header search
  const headerSearch = document.getElementById('searchInput');
  if (headerSearch) {
    headerSearch.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim().toLowerCase();
      if (searchInput) searchInput.value = e.target.value;
      renderCatalog();
    });
  }

  // Setup sort select
  const sortSelect = document.getElementById('catalogSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderCatalog();
    });
  }

  // Load Cart
  loadCart();

  // Listen for DB updates
  window.addEventListener('nexaProductsUpdated', () => {
    renderCatalog();
  });

  // Initial render
  renderCatalog();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCategoryPage);
} else {
  initCategoryPage();
}

function setCategory(cat) {
  currentCategory = cat;
  updateActivePill(cat);
  updateHeroHeader(cat);

  // Update URL without reload
  const newUrl = `${window.location.pathname}?cat=${cat}`;
  window.history.pushState({ path: newUrl }, '', newUrl);

  renderCatalog();
}

function updateActivePill(cat) {
  document.querySelectorAll('.filter-pill').forEach(pill => {
    if (pill.getAttribute('data-category') === cat) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function updateHeroHeader(cat) {
  const meta = CATEGORY_META[cat] || CATEGORY_META.all;
  const titleEl = document.getElementById('categoryHeroTitle');
  const descEl = document.getElementById('categoryHeroDesc');
  const badgeEl = document.getElementById('categoryHeroBadge');

  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.desc;
  if (badgeEl) badgeEl.querySelector('span').textContent = meta.badge;
}

// Render Products Grid (Supabase + Local Cache)
function renderCatalogWithList(allProducts) {
  const grid = document.getElementById('catalogGrid');
  const countPill = document.getElementById('catalogItemsCount');
  if (!grid) return;

  // Filter by category (exclude archived, inactive, or unauthorized)
  let list = (allProducts || []).filter(p => {
    if (!p || !p.id) return false;
    if (window.NexaDB && typeof window.NexaDB.isAuthorized === 'function' && !window.NexaDB.isAuthorized(p.id)) return false;
    if (p.isArchived) return false;
    if (p.isActive === false) return false;
    if (currentCategory === 'all') return true;
    return p.category === currentCategory;
  });

  // Filter by search
  if (currentSearch) {
    list = list.filter(p => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.desc || '').toLowerCase();
      const cat = (p.catName || '').toLowerCase();
      return name.includes(currentSearch) || desc.includes(currentSearch) || cat.includes(currentSearch);
    });
  }

  // Sort
  if (currentSort === 'price-asc') {
    list.sort((a, b) => a.priceEgp - b.priceEgp);
  } else if (currentSort === 'price-desc') {
    list.sort((a, b) => b.priceEgp - a.priceEgp);
  } else if (currentSort === 'rating') {
    list.sort((a, b) => b.rating - a.rating);
  } else if (currentSort === 'featured') {
    list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }

  if (countPill) {
    countPill.textContent = `${list.length} اشتراك متوفر`;
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
        <i class="fa-solid fa-box-open" style="font-size: 3rem; color: var(--text-dim); margin-bottom: 15px;"></i>
        <h3 style="color: #fff; font-size: 1.3rem;">لم يتم العثور على اشتراكات مطابقة</h3>
        <p style="color: var(--text-muted); margin-top: 6px;">جرب تغيير كلمة البحث أو اختيار قسم آخر.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(prod => {
    const inv = prod.inventory;
    const isOutOfStock = (inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused);
    const isLowStock = (inv && inv.stockType === 'limited' && inv.available > 0 && inv.available <= (inv.threshold || 5));

    let stockBadge = `<span class="catalog-stock-pill verified"><i class="fa-solid fa-check"></i> متاح للطلب</span>`;
    if (isOutOfStock) {
      stockBadge = `<span class="catalog-stock-pill out"><i class="fa-solid fa-circle-xmark"></i> نفدت الكمية</span>`;
    } else if (isLowStock) {
      stockBadge = `<span class="catalog-stock-pill limited"><i class="fa-solid fa-triangle-exclamation"></i> كمية محدودة</span>`;
    }

    const imgPath = (window.NexaResolveProductImage ? window.NexaResolveProductImage(prod) : prod.image) || 'logos/Activkeyzmainlogo.png';
    const priceUsdFormatted = prod.priceUsd ? Number(prod.priceUsd).toFixed(2) : (Number(prod.priceEgp) / 50).toFixed(2);

    const catLabel = (CATEGORY_META[prod.category] && CATEGORY_META[prod.category].badge) 
      || (window.fixArabicMojibake ? window.fixArabicMojibake(prod.catName) : prod.catName) 
      || 'اشتراك رقمي';
    const formattedPrice = window.formatNexaPrice 
      ? window.formatNexaPrice(prod.priceEgp) 
      : { formatted: Number(prod.priceEgp).toLocaleString(), unit: 'ج.م' };

    return `
      <div class="catalog-card ${isOutOfStock ? 'card-out-of-stock' : ''}" onclick="window.location.href='product.html?id=' + encodeURIComponent('${prod.id}')">
        <!-- 1. Hero Showcase Stage with 3D floating visual -->
        <div class="catalog-card-showcase">
          <div class="catalog-card-floating-badges">
            <span class="catalog-duration-badge">
              <i class="fa-regular fa-clock"></i>
              <span>${escapeHtml(prod.duration || 'اشتراك رسمي')}</span>
            </span>
            ${stockBadge}
          </div>
          <div class="catalog-card-visual-stage">
            <img src="${imgPath}" alt="${escapeHtml(prod.name)}" class="catalog-card-hero-img" loading="lazy" onerror="this.src='logos/Activkeyzmainlogo.png'">
          </div>
        </div>

        <!-- 2. Card Info Body -->
        <div class="catalog-card-body">
          <div class="catalog-card-category-tag">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>${escapeHtml(catLabel)}</span>
          </div>
          <h3 class="catalog-card-title">${escapeHtml(prod.name)}</h3>
          <p class="catalog-card-desc">${escapeHtml(prod.desc || 'اشتراك رقمي معتمد مع ضمان كامل طوال المدة وتسليم فوري.')}</p>
        </div>

        <!-- 3. Card Pricing & CTA Footer -->
        <div class="catalog-card-footer">
          <div class="catalog-price-cluster">
            <div class="catalog-price-main">${formattedPrice.formatted} <span class="currency-unit">${formattedPrice.unit}</span></div>
            <div class="catalog-price-secondary">${(window.getNexaCurrency && window.getNexaCurrency() === 'USD') ? '' : `$${priceUsdFormatted}`}</div>
          </div>

          <div class="catalog-actions-cluster">
            <button class="btn-card-quick-cart ${isOutOfStock ? 'btn-disabled' : ''}" 
                    onclick="event.stopPropagation(); addToCart('${prod.id}')" 
                    title="إضافة سريعة إلى السلة"
                    ${isOutOfStock ? 'disabled' : ''}>
              <i class="fa-solid fa-cart-plus"></i>
            </button>
            <a href="product.html?id=${encodeURIComponent(prod.id)}" 
               class="btn-card-action" 
               onclick="event.stopPropagation();" 
               title="عرض تفاصيل واشتراك ${escapeHtml(prod.name)}">
              <span>عرض والاشتراك</span>
              <i class="fa-solid fa-arrow-left"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.ActivkeyzI18n && typeof window.ActivkeyzI18n.translateDOM === 'function') {
    window.ActivkeyzI18n.translateDOM();
  }
}

async function renderCatalog() {
  // 1. Instant Synchronous Cache Render (0ms latency)
  if (window.NexaDB && typeof window.NexaDB.getAll === 'function') {
    const cached = window.NexaDB.getAll();
    if (cached && cached.length > 0) {
      renderCatalogWithList(cached);
    }
  }

  // 2. Background Asynchronous Supabase Refresh
  if (window.NexaSupabase && typeof window.NexaSupabase.products.getAll === 'function') {
    try {
      const live = await window.NexaSupabase.products.getAll();
      if (Array.isArray(live) && live.length > 0) {
        renderCatalogWithList(live);
      }
    } catch (e) {
      // already rendered from cache
    }
  }
}

// Navigate to Dedicated Full Product Page
function openProductModal(prodId) {
  window.location.href = 'product.html?id=' + encodeURIComponent(prodId);
}

function closeProductModal() {
  // Handled for backward compatibility
}

// Cart System
function loadCart() {
  try {
    const raw = localStorage.getItem('nexa_cart');
    cartItems = raw ? JSON.parse(raw) : [];
  } catch (e) {
    cartItems = [];
  }
  updateCartBadge();
}

function saveCart() {
  try {
    localStorage.setItem('nexa_cart', JSON.stringify(cartItems));
  } catch (e) {}
  updateCartBadge();
  renderCartDrawer();
}

function addToCart(prodId) {
  let all = [];
  try {
    const raw = localStorage.getItem('nexa_products_catalog_v2');
    if (raw) all = JSON.parse(raw);
  } catch (e) {}
  if (!all.length && window.NexaDB) all = window.NexaDB.getAll();

  const prod = all.find(p => p.id === prodId);
  if (!prod) return;

  const inv = prod.inventory;
  if ((inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused) || (prod.isActive === false)) {
    showToast('عذراً، هذا المنتج غير متوفر في المخزون حالياً! ⚠️');
    return;
  }

  const existing = cartItems.find(item => item.id === prodId);
  if (existing) {
    if (inv && inv.stockType === 'limited' && (existing.quantity >= inv.available)) {
      showToast(`عذراً، الحد الأقصى المتوفر في المخزون هو ${inv.available} فقط.`);
      return;
    }
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cartItems.push({
      id: prod.id,
      name: prod.name,
      priceEgp: prod.priceEgp,
      priceUsd: prod.priceUsd,
      image: prod.image,
      duration: prod.duration,
      quantity: 1
    });
  }

  saveCart();
  showToast(`تمت إضافة "${prod.name}" إلى سلتك بنجاح!`);
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadgeCount');
  if (badge) {
    const totalCount = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
    badge.textContent = totalCount;
  }
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer && overlay) {
    if (open) {
      renderCartDrawer();
      drawer.classList.add('open', 'active');
      overlay.classList.add('show', 'active');
      document.body.classList.add('cart-drawer-open');
    } else {
      drawer.classList.remove('open', 'active');
      overlay.classList.remove('show', 'active');
      document.body.classList.remove('cart-drawer-open');
    }
  }
}

// Cart button click
document.addEventListener('click', (e) => {
  if (e.target.closest('#cartBtn')) {
    toggleCartDrawer(true);
  }
});

function renderCartDrawer() {
  const list = document.getElementById('cartItemsList');
  const totalSum = document.getElementById('cartTotalSum');
  if (!list || !totalSum) return;

  if (cartItems.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:var(--text-dim);">
        <i class="fa-solid fa-basket-shopping" style="font-size:2.5rem; margin-bottom:12px;"></i>
        <p style="color:#fff;">سلتك فارغة حالياً</p>
        <span style="font-size:0.85rem;">اختر برامجك المفضلة وأضفها إلى السلة</span>
      </div>
    `;
    totalSum.textContent = '0 ج.م';
    return;
  }

  let total = 0;
  list.innerHTML = cartItems.map((item, idx) => {
    const sub = item.priceEgp * (item.quantity || 1);
    total += sub;
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px; background:rgba(8, 16, 32, 0.7); border-radius:12px; margin-bottom:10px; border:1px solid rgba(56, 189, 248, 0.12);">
        <div style="width:42px; height:42px; border-radius:10px; overflow:hidden; border:1px solid rgba(56, 189, 248, 0.3); background:#060d1a; flex-shrink:0;">
          <img src="${(window.NexaResolveProductImage ? window.NexaResolveProductImage(item) : item.image) || 'logos/chatgpt-plus.webp'}" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/chatgpt-plus.webp'">
        </div>
        <div style="flex:1;">
          <h4 style="color:#fff; font-size:0.9rem; margin-bottom:2px;">${escapeHtml(item.name)}</h4>
          <span style="color:var(--cyan-primary); font-size:0.82rem; font-weight:700;">${item.priceEgp} ج.م</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#fff; font-weight:700; font-size:0.85rem;">× ${item.quantity || 1}</span>
          <button onclick="removeCartItem(${idx})" style="color:#ef4444; font-size:0.85rem; padding:4px;" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
  }).join('');

  totalSum.textContent = `${total} ج.م`;
}

function removeCartItem(idx) {
  cartItems.splice(idx, 1);
  saveCart();
}

function proceedToCheckout() {
  if (cartItems.length === 0) return;
  const itemsText = cartItems.map(i => `${i.name} (x${i.quantity || 1})`).join(', ');
  const total = cartItems.reduce((acc, i) => acc + (i.priceEgp * (i.quantity || 1)), 0);
  const waUrl = `https://wa.me/201225106057?text=${encodeURIComponent(`مرحباً ActivKeyz، أود إتمام طلب السلة التالية:\nالمنتجات: ${itemsText}\nالمجموع: ${total} ج.م`)}`;
  window.open(waUrl, '_blank');
}

// Toast Notifications
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast-alert';
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--cyan-primary);"></i> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Mobile Drawer & Account Navigation
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  const drawerClose = document.getElementById('drawerCloseBtn');
  if (mobileBtn && drawer) {
    mobileBtn.addEventListener('click', () => {
      drawer.classList.add('active');
      drawer.classList.add('open');
    });
  }
  if (drawerClose && drawer) {
    drawerClose.addEventListener('click', () => {
      drawer.classList.remove('active');
      drawer.classList.remove('open');
    });
  }

  document.getElementById('accountBtn')?.addEventListener('click', () => {
    window.location.href = 'account.html';
  });

  window.addEventListener('nexa-currency-changed', () => {
    if (typeof renderProductCards === 'function') renderProductCards();
  });

  window.addEventListener('activkeyz-language-changed', () => {
    if (typeof renderCatalog === 'function') renderCatalog();
    if (typeof renderCart === 'function') renderCart();
  });
});
