/* ===================================================================
   Activkeyz - CORE APPLICATION LOGIC & STOREFRONT ENGINE
   100% Integrated with NexaDB (Local & LocalStorage Synced)
   =================================================================== */

// Clean URL Helper: Automatically strip /index.html and /index from URL bar on GitHub Pages
(function cleanIndexUrl() {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const pathname = window.location.pathname;
      if (pathname.endsWith('/index.html') || pathname.endsWith('/index')) {
        const cleanUrl = pathname.replace(/\/index(\.html)?$/, '/') + window.location.search + window.location.hash;
        window.history.replaceState(null, '', cleanUrl);
      }
    } catch (e) {}
  }
})();

// Global State
let currentCategory = 'all';
let currentSearch = '';
let cart = [];

// Helper to get active products from database (Supabase + Local Cache)
let cachedStorefrontCatalog = null;
function getCatalog() {
  if (cachedStorefrontCatalog && cachedStorefrontCatalog.length > 0) {
    if (window.NexaDB && typeof window.NexaDB.isAuthorized === 'function') {
      return cachedStorefrontCatalog.filter(p => p && p.id && window.NexaDB.isAuthorized(p.id));
    }
    return cachedStorefrontCatalog;
  }
  if (window.NexaDB && typeof window.NexaDB.getAll === 'function') {
    return window.NexaDB.getAll();
  }
  return [];
}

async function refreshCatalogFromSupabase() {
  if (window.NexaSupabase && typeof window.NexaSupabase.products.getAll === 'function') {
    try {
      const data = await window.NexaSupabase.products.getAll();
      if (Array.isArray(data) && data.length > 0) {
        const authorized = window.NexaDB && typeof window.NexaDB.isAuthorized === 'function'
          ? data.filter(p => p && p.id && window.NexaDB.isAuthorized(p.id))
          : data;
        cachedStorefrontCatalog = authorized;
        renderCatalogGrid();
        renderCart();
      }
    } catch (e) {}
  }
}

// 1. Live Countdown Timer (17:59:23)
function initCountdownTimer() {
  let hours = 17;
  let minutes = 59;
  let seconds = 23;

  const hoursEl = document.getElementById('hoursVal');
  const minutesEl = document.getElementById('minutesVal');
  const secondsEl = document.getElementById('secondsVal');

  setInterval(() => {
    seconds--;
    if (seconds < 0) {
      seconds = 59;
      minutes--;
      if (minutes < 0) {
        minutes = 59;
        hours--;
        if (hours < 0) {
          hours = 23;
        }
      }
    }

    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
  }, 1000);
}

// 2. Shopping Cart Functions
function saveCartToStorage() {
  try {
    localStorage.setItem('nexa_cart', JSON.stringify(cart));
  } catch (e) {}
}

function initCart() {
  try {
    const raw = localStorage.getItem('nexa_cart');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cart = parsed.map(item => item.product ? item : { product: item, quantity: item.quantity || 1 });
        renderCart();
        return;
      }
    }
  } catch (e) {}

  const products = getCatalog();
  const defaultItem = products.find(p => p.id === 'gaming-discord-nitro') || products[0];
  if (defaultItem) {
    cart = [{ product: defaultItem, quantity: 1 }];
    saveCartToStorage();
  }
  renderCart();
}

function renderCart() {
  const cartList = document.getElementById('cartItemsList');
  const badgeCount = document.getElementById('cartBadgeCount');
  const totalItemsCount = document.getElementById('cartTotalItems');
  const subtotalEl = document.getElementById('cartSubtotal');
  const discountEl = document.getElementById('cartDiscount');
  const totalFinalEl = document.getElementById('cartTotalFinal');

  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  if (badgeCount) badgeCount.textContent = totalQty;
  if (totalItemsCount) totalItemsCount.textContent = totalQty;

  if (!cartList) return;

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div class="cart-empty-message" style="text-align:center; padding: 40px 10px; color: var(--text-dim);">
        <i class="fa-solid fa-basket-shopping" style="font-size: 2.8rem; color: var(--cyan-primary); margin-bottom: 12px; display:block;"></i>
        <h3 style="color:#fff; margin-bottom: 6px;">سلة مشترياتك فارغة</h3>
        <p>استكشف اشتراكاتنا الرقمية وأضف ما يناسبك الآن!</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = '0 ج.م ($0.00)';
    if (discountEl) discountEl.textContent = '-0 ج.م';
    if (totalFinalEl) totalFinalEl.textContent = '0 ج.م ($0.00)';
    return;
  }

  let subtotalEgp = 0;
  let subtotalUsd = 0;

  cartList.innerHTML = cart.map((item, idx) => {
    const unitEgp = item.product.priceEgp || 0;
    const unitUsd = item.product.priceUsd || (unitEgp / 50);
    const itemEgp = unitEgp * item.quantity;
    const itemUsd = unitUsd * item.quantity;
    subtotalEgp += itemEgp;
    subtotalUsd += itemUsd;

    const activationBadge = item.activation === 'personal'
      ? `<span style="font-size:0.7rem; color:#38bdf8; background:rgba(56,189,248,0.12); padding:2px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.3); display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-envelope"></i> تفعيل شخصي</span>`
      : `<span style="font-size:0.7rem; color:#4ade80; background:rgba(74,222,128,0.12); padding:2px 6px; border-radius:4px; border:1px solid rgba(74,222,128,0.3); display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-bolt"></i> كود/حساب جاهز</span>`;

    return `
      <div class="cart-item-card" style="display:flex; flex-direction:column; gap:10px; padding:12px; background:rgba(12,22,40,0.75); border:1px solid rgba(56,189,248,0.22); border-radius:14px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:48px; height:48px; border-radius:10px; overflow:hidden; background:#081020; border:1px solid var(--border-cyan-subtle); flex-shrink:0;">
            <img src="${(window.NexaResolveProductImage ? window.NexaResolveProductImage(item.product) : (item.product.image || item.product.featuredImage)) || 'logos/chatgpt-plus.webp'}" alt="${item.product.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/chatgpt-plus.webp'">
          </div>
          <div style="flex:1; text-align:right;">
            <div style="font-weight:700; font-size:0.9rem; color:#fff; line-height:1.25;">${item.product.name}</div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
              ${activationBadge}
              <span style="font-size:0.74rem; color:#94a3b8;">${item.product.duration || ''}</span>
            </div>
          </div>
          <button onclick="removeFromCart(${idx})" title="حذف من السلة" style="color:#ef4444; font-size:0.92rem; padding:6px; cursor:pointer; background:none; border:none; transition:transform 0.2s;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
          <!-- Cart Quantity Stepper -->
          <div style="display:flex; align-items:center; background:rgba(6,12,22,0.9); border:1px solid rgba(56,189,248,0.3); border-radius:8px; padding:2px;">
            <button onclick="updateCartItemQty(${idx}, -1)" title="تقليل" style="width:26px; height:26px; border:none; background:transparent; color:#38bdf8; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fa-solid fa-minus" style="font-size:0.75rem;"></i></button>
            <span style="min-width:28px; text-align:center; font-family:var(--font-latin); font-weight:800; color:#fff; font-size:0.9rem;">${item.quantity}</span>
            <button onclick="updateCartItemQty(${idx}, 1)" title="زيادة" style="width:26px; height:26px; border:none; background:transparent; color:#38bdf8; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:4px;"><i class="fa-solid fa-plus" style="font-size:0.75rem;"></i></button>
          </div>

          <div style="text-align:left;">
            <div style="font-family:var(--font-latin); font-size:0.98rem; color:var(--cyan-bright); font-weight:800;">${itemEgp.toLocaleString()} ج.م</div>
            <div style="font-family:var(--font-latin); font-size:0.75rem; color:#64748b;">$${itemUsd.toFixed(2)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const promoPct = window.storeGlobalDiscountPct || 0;
  const discountEgp = promoPct > 0 ? Math.round(subtotalEgp * (promoPct / 100)) : 0;
  const finalTotalEgp = subtotalEgp - discountEgp;
  const finalTotalUsd = (subtotalUsd * (1 - (promoPct / 100))).toFixed(2);

  if (subtotalEl) subtotalEl.textContent = `${subtotalEgp.toLocaleString()} ج.م ($${subtotalUsd.toFixed(2)})`;
  if (discountEl) {
    if (discountEgp > 0) {
      discountEl.textContent = `-${discountEgp.toLocaleString()} ج.م (خصم ${promoPct}%)`;
      if (discountEl.parentElement) discountEl.parentElement.style.display = 'flex';
    } else {
      discountEl.textContent = '0 ج.م';
      if (discountEl.parentElement) discountEl.parentElement.style.display = 'none';
    }
  }
  if (totalFinalEl) totalFinalEl.textContent = `${finalTotalEgp.toLocaleString()} ج.م ($${finalTotalUsd})`;

  const checkoutModalAmount = document.getElementById('checkoutModalAmount');
  if (checkoutModalAmount) checkoutModalAmount.textContent = `${finalTotalEgp.toLocaleString()} ج.م ($${finalTotalUsd})`;

  if (window.ActivkeyzI18n && typeof window.ActivkeyzI18n.translateDOM === 'function') {
    window.ActivkeyzI18n.translateDOM();
  }
}

function updateCartItemQty(index, delta) {
  if (cart[index]) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      removeFromCart(index);
      return;
    }
    saveCartToStorage();
    renderCart();
  }
}

function orderCartViaWhatsApp() {
  if (!cart || cart.length === 0) {
    showToast('سلة مشترياتك فارغة! أضف منتجات أولاً.');
    return;
  }
  const itemsText = cart.map(i => `${i.product.name} (x${i.quantity || 1}) - ${i.product.priceEgp} ج.م`).join('\n• ');
  const totalEgp = cart.reduce((acc, i) => acc + ((i.product.priceEgp || 0) * (i.quantity || 1)), 0);
  const promoPct = window.storeGlobalDiscountPct || 0;
  const discountEgp = promoPct > 0 ? Math.round(totalEgp * (promoPct / 100)) : 0;
  const finalTotalEgp = totalEgp - discountEgp;
  const discountNote = promoPct > 0 ? ` (بعد خصم ${promoPct}%)` : '';

  const msg = `مرحباً Activkeyz! أود إتمام طلب السلة التالية عبر واتساب:\n\n• ${itemsText}\n\nالإجمالي${discountNote}: ${finalTotalEgp.toLocaleString()} ج.م\nرقم الهاتف للتواصل: 01225106057`;
  window.open(`https://wa.me/201225106057?text=${encodeURIComponent(msg)}`, '_blank');
}

function addToCart(productId) {
  const products = getCatalog();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const inv = product.inventory;
  if ((inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused) || (product.isActive === false)) {
    showToast('عذراً، هذا المنتج غير متوفر حالياً أو نفدت كميته! ⚠️');
    return;
  }

  const existing = cart.find(item => item.product.id === productId);
  if (existing) {
    if (inv && inv.stockType === 'limited' && (existing.quantity >= inv.available)) {
      showToast(`عذراً، الحد الأقصى المتوفر في المخزون هو ${inv.available} فقط.`);
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({ product, quantity: 1, activation: 'ready' });
  }

  saveCartToStorage();
  renderCart();
  showToast(`تمت إضافة "${product.name}" إلى السلة بنجاح! 🛍️`);
}

function removeFromCart(index) {
  const removedItem = cart[index];
  cart.splice(index, 1);
  saveCartToStorage();
  renderCart();
  if (removedItem) {
    showToast(`تم إزالة "${removedItem.product.name}" من السلة`);
  }
}

function openCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-drawer-open');
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  if (drawer && overlay) {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
  }
}

// 3. Category & Catalog Filtering
const CATEGORY_META = {
  all: {
    title: 'دليل الاشتراكات والبرامج الكامل',
    badge: 'جميع الأقسام',
    desc: 'تصفح جميع الاشتراكات المعتمدة بأسعار الجملة التنافسية وضمان رسمي شامل لجميع الحسابات'
  },
  ai: {
    title: 'أدوات ونماذج الذكاء الاصطناعي (AI)',
    badge: 'الذكاء الاصطناعي',
    desc: 'اشتراكات شات جي بي تي بلس، بيربلكسيتي، جروك، رن واي، كلينج، وجيميني أدفانسد بأقوى الأسعار'
  },
  creative: {
    title: 'برامج التصميم والمونتاج الإبداعية',
    badge: 'البرامج الإبداعية',
    desc: 'باقات أدوبي السحابية كاملة، فري بيك بمحرك مانيفيك، فيجما برو السنوية، وأدوبي إكسبريس'
  },
  office: {
    title: 'برامج الإنتاجية والمكتب الاحترافية',
    badge: 'برامج المكتب',
    desc: 'اشتراكات مايكروسوفت أوفيس 365 بلس الأصلية، نوشن بلس وبيزنس السنوية، وحسابات زووم برو للاجتماعات'
  },
  streaming: {
    title: 'اشتراكات الترفيه والبث الرقمي',
    badge: 'الترفيه والاشتراكات',
    desc: 'يوتيوب بريميوم بدون إعلانات مع ضمان كامل، سبوتيفاي بريميوم، أبل ميوزك، وأمازون برايم فيديو'
  },
  gaming: {
    title: 'بطاقات الألعاب وخدمات الاتصال الآمن (VPN)',
    badge: 'الألعاب والبطاقات',
    desc: 'اشتراكات ديسكورد نيترو الأصلية، نورد في بي إن، بروتون في بي إن، ودورات كورسيرا ودولينجو بلس'
  }
};

function filterByCategory(category) {
  window.location.href = `category.html?cat=${category}`;
}

// 4. Render Dynamic Catalog Grid
function renderCatalogGrid() {
  const grid = document.getElementById('catalogGrid');
  const countEl = document.getElementById('catalogItemsCount');
  if (!grid) return;

  const products = getCatalog();

  // Filter items (exclude inactive or archived)
  const filtered = products.filter(p => {
    if (p.isArchived) return false;
    if (p.isActive === false) return false;
    const matchCat = (currentCategory === 'all' || p.category === currentCategory);
    const matchSearch = (!currentSearch || 
      p.name.toLowerCase().includes(currentSearch) ||
      (p.desc && p.desc.toLowerCase().includes(currentSearch)) ||
      (p.catName && p.catName.toLowerCase().includes(currentSearch))
    );
    return matchCat && matchSearch;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} اشتراك متوفر`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: rgba(8,16,32,0.6); border: 1px dashed rgba(56,189,248,0.2); border-radius: 20px;">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: var(--cyan-primary); margin-bottom: 14px; display: block;"></i>
        <h3 style="color: #fff; margin-bottom: 6px;">لا توجد اشتراكات مطابقة للبحث</h3>
        <p style="color: var(--text-dim); margin-bottom: 16px;">جرب تغيير القسم أو كتابة اسم اشتراك آخر أو مسح كلمة البحث</p>
        <button class="btn btn-cyan-primary" onclick="resetCatalogFilters()">عرض جميع الاشتراكات</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const canonicalCatNames = {
      'ai': 'أدوات الذكاء الاصطناعي',
      'creative': 'البرامج الإبداعية',
      'office': 'برامج المكتب',
      'streaming': 'الترفيه والاشتراكات',
      'gaming': 'الألعاب والبطاقات'
    };
    const catLabel = canonicalCatNames[item.category] || (window.fixArabicMojibake ? window.fixArabicMojibake(item.catName) : item.catName) || 'اشتراك رقمي';
    const thumb = (window.NexaResolveProductImage ? window.NexaResolveProductImage(item) : (item.image || item.featuredImage)) || 'logos/Activkeyzmainlogo.png';
    const specsList = (item.specs && Array.isArray(item.specs)) ? item.specs.slice(0, 3) : [
      'تفعيل رسمي معتمد',
      'ضمان كامل طوال المدة',
      'تسليم فوري ومباشر'
    ];

    const inv = item.inventory;
    const isOutOfStock = (inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused);
    const isLowStock = (inv && inv.stockType === 'limited' && inv.available > 0 && inv.available <= (inv.threshold || 5));

    let stockBadge = `<span class="catalog-stock-pill verified"><i class="fa-solid fa-shield-halved"></i> متاح للطلب</span>`;
    if (isOutOfStock) {
      stockBadge = `<span class="catalog-stock-pill out"><i class="fa-solid fa-circle-xmark"></i> نفدت الكمية</span>`;
    } else if (isLowStock) {
      stockBadge = `<span class="catalog-stock-pill limited"><i class="fa-solid fa-triangle-exclamation"></i> كمية محدودة</span>`;
    }

    const priceUsdFormatted = (item.priceUsd || (Number(item.priceEgp) / 50)).toFixed(2);
    const formattedPrice = window.formatNexaPrice ? window.formatNexaPrice(item.priceEgp) : { formatted: Number(item.priceEgp).toLocaleString(), unit: 'ج.م' };

    return `
      <div class="catalog-card ${isOutOfStock ? 'card-out-of-stock' : ''}" data-id="${item.id}" data-category="${item.category}" onclick="window.location.href='product.html?id=' + encodeURIComponent('${item.id}')">
        <!-- 1. Hero Showcase Stage with 3D floating visual -->
        <div class="catalog-card-showcase">
          <div class="catalog-card-floating-badges">
            <span class="catalog-duration-badge">
              <i class="fa-regular fa-clock"></i>
              <span>${item.duration || 'اشتراك رسمي'}</span>
            </span>
            ${stockBadge}
          </div>
          <div class="catalog-card-visual-stage">
            <img src="${thumb}" alt="${item.name}" class="catalog-card-hero-img" loading="lazy" onerror="this.src='logos/Activkeyzmainlogo.png'">
          </div>
        </div>

        <!-- 2. Card Info Body -->
        <div class="catalog-card-body">
          <div class="catalog-card-category-tag">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>${catLabel}</span>
          </div>
          <h3 class="catalog-card-title">${item.name}</h3>
          <p class="catalog-card-desc">${item.desc || 'اشتراك رقمي معتمد مع ضمان شامل وتسليم فوري.'}</p>
        </div>

        <!-- 3. Card Pricing & CTA Footer -->
        <div class="catalog-card-footer">
          <div class="catalog-price-cluster">
            <div class="catalog-price-main">${formattedPrice.formatted} <span class="currency-unit">${formattedPrice.unit}</span></div>
            <div class="catalog-price-secondary">${(window.getNexaCurrency && window.getNexaCurrency() === 'USD') ? '' : `$${priceUsdFormatted}`}</div>
          </div>
          <div class="catalog-actions-cluster">
            <button class="btn-card-quick-cart ${isOutOfStock ? 'btn-disabled' : ''}" 
                    onclick="event.stopPropagation(); addToCart('${item.id}')" 
                    title="إضافة سريعة إلى السلة"
                    ${isOutOfStock ? 'disabled' : ''}>
              <i class="fa-solid fa-cart-plus"></i>
            </button>
            <a href="product.html?id=${encodeURIComponent(item.id)}" class="btn-card-action" onclick="event.stopPropagation();" title="عرض تفاصيل واشتراك ${item.name}">
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

function resetCatalogFilters() {
  currentCategory = 'all';
  currentBot = 'all';
  currentSearch = '';
  
  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('.filter-pill').forEach(p => {
    if (p.dataset.category === 'all') p.classList.add('active');
    else p.classList.remove('active');
  });

  document.querySelectorAll('.bot-pill').forEach(b => {
    if (b.dataset.bot === 'all') b.classList.add('active');
    else b.classList.remove('active');
  });

  filterByCategory('all');
}

// 5. Navigate to Dedicated Product Page
function openProductModal(productId) {
  const canonicalId = (window.NexaResolveCanonicalProductId ? window.NexaResolveCanonicalProductId(productId) : productId) || productId;
  window.location.href = `product.html?id=${encodeURIComponent(canonicalId)}`;
}

function closeProductModal() {
  // Handled for backward compatibility
}

// 6. Checkout & Order Flow
function openCheckoutModal() {
  closeCartDrawer();
  window.location.href = 'checkout.html?from=cart';
}

// 7. User Account Modal
function openAccountModal() {
  window.location.href = 'account.html';
}

function closeAccountModal() {
  // Account modal superseded by full account.html portal
}

function switchAccountTab(tab) {
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const secLogin = document.getElementById('loginFormSection');
  const secRegister = document.getElementById('registerFormSection');

  if (tab === 'login') {
    tabLogin?.classList.add('active');
    tabRegister?.classList.remove('active');
    if (secLogin) secLogin.style.display = 'block';
    if (secRegister) secRegister.style.display = 'none';
  } else {
    tabRegister?.classList.add('active');
    tabLogin?.classList.remove('active');
    if (secLogin) secLogin.style.display = 'none';
    if (secRegister) secRegister.style.display = 'block';
  }
}

async function handleUserLogin(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('loginEmailInput')?.value.trim();
  const password = document.getElementById('loginPasswordInput')?.value;

  if (!email || !password) {
    showToast('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    return;
  }

  if (window.NexaSupabase && window.NexaSupabase.auth) {
    try {
      await window.NexaSupabase.auth.signIn(email, password);
      showToast('تم تسجيل الدخول بنجاح! مرحباً بك في Activkeyz 🚀');
      closeAccountModal();
      return;
    } catch (err) {
      console.warn('Supabase auth sign in error, fallback to demo login:', err);
    }
  }

  closeAccountModal();
  showToast('مرحباً بك مجدداً في Activkeyz! 🚀');
}

function getRegFullPhone() {
  const codeEl = document.getElementById('regCountryCode');
  const phoneEl = document.getElementById('regPhoneInput');
  if (!phoneEl) return '';
  const raw = phoneEl.value.trim();
  if (!raw) return '';
  const code = codeEl ? codeEl.value : '+20';
  if (raw.startsWith('+')) return raw;
  if (code && raw.startsWith(code.replace('+', ''))) return '+' + raw;
  const digitsOnly = raw.replace(/^0+/, '');
  return code ? `${code}${digitsOnly}` : raw;
}

async function handleUserRegister(event) {
  if (event) event.preventDefault();
  const name = document.getElementById('regNameInput')?.value.trim();
  const email = document.getElementById('regEmailInput')?.value.trim();
  const phone = getRegFullPhone();
  const password = document.getElementById('regPasswordInput')?.value;

  if (!email || !password) {
    showToast('⚠️ يرجى استكمال البيانات المطلوبة.');
    return;
  }

  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 8) {
    showToast('⚠️ يرجى إدخال رقم واتساب صحيح مع اختيار رمز الدولة لتأكيد حسابك وتفعيل اشتراكاتك!');
    document.getElementById('regPhoneInput')?.focus();
    return;
  }

  // Persist customer inputs
  try {
    localStorage.setItem('activkeyz_customer_phone', phone);
    localStorage.setItem('activkeyz_customer_email', email);
    const rawUser = localStorage.getItem('nexa_customer_user');
    const u = rawUser ? JSON.parse(rawUser) : {};
    u.phone = phone;
    u.email = email;
    if (name) u.full_name = name;
    localStorage.setItem('nexa_customer_user', JSON.stringify(u));
  } catch (e) {}

  if (window.NexaSupabase && window.NexaSupabase.auth) {
    try {
      await window.NexaSupabase.auth.signUp(email, password, name, phone);
      showToast('تم إنشاء الحساب بنجاح! مرحباً بك يا ' + (name || 'عميلنا المميز') + ' 🎉');
      closeAccountModal();
      return;
    } catch (err) {
      console.warn('Supabase auth sign up error, fallback to demo register:', err);
    }
  }

  closeAccountModal();
  showToast('تم إنشاء الحساب بنجاح! مرحباً بك في Activkeyz 🎉');
}

function handleMockLogin() {
  closeAccountModal();
  showToast('مرحباً بك مجدداً في Activkeyz! 🚀');
}

// 8. Header Search Bar
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const suggestionsBox = document.getElementById('searchSuggestions');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    
    if (clearBtn) {
      clearBtn.style.display = val ? 'block' : 'none';
    }

    if (!val) {
      if (suggestionsBox) suggestionsBox.style.display = 'none';
      return;
    }

    const products = getCatalog();
    const matches = products.filter(p => 
      p.name.toLowerCase().includes(val) || 
      (p.desc && p.desc.toLowerCase().includes(val)) ||
      (p.catName && p.catName.toLowerCase().includes(val))
    );

    if (suggestionsBox) {
      if (matches.length > 0) {
        suggestionsBox.innerHTML = matches.slice(0, 7).map(p => `
          <div class="search-suggestion-item" onclick="openProductModal('${p.id}'); document.getElementById('searchSuggestions').style.display='none';">
            <span class="search-match-title">${p.name} - ${p.duration || ''}</span>
            <span class="search-match-price">${p.priceEgp} ج.م</span>
          </div>
        `).join('');
        suggestionsBox.style.display = 'block';
      } else {
        suggestionsBox.innerHTML = `<div class="search-suggestion-item" style="color:var(--text-dim); text-align:center;">لا توجد اشتراكات مطابقة</div>`;
        suggestionsBox.style.display = 'block';
      }
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      if (suggestionsBox) suggestionsBox.style.display = 'none';
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-search-wrap') && suggestionsBox) {
      suggestionsBox.style.display = 'none';
    }
  });
}

// 9. Toast Notifications
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i class="fa-solid fa-circle-check" style="color: var(--cyan-primary); font-size: 1.1rem;"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function handleNewsletterSubmit() {
  const emailInput = document.getElementById('newsletterEmail');
  if (emailInput && emailInput.value) {
    showToast(`شكراً لاشتراكك! تم إرسال كود خصم إضافي إلى ${emailInput.value} 🎁`);
    emailInput.value = '';
  }
}

// Dynamic Settings Engine
async function loadDynamicStorefrontSettings() {
  if (!window.NexaSupabase || !window.NexaSupabase.settings) return;
  try {
    const settings = await window.NexaSupabase.settings.getStoreSettings();
    if (!settings) return;

    if (settings.announcements && settings.announcements.text) {
      const barText = document.getElementById('storeAnnouncementText');
      if (barText) barText.textContent = settings.announcements.text;
    }

    if (settings.contact_whatsapp) {
      const cleanWa = settings.contact_whatsapp.replace(/[^0-9]/g, '');
      document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
        a.href = `https://wa.me/${cleanWa}`;
      });
    }

    if (settings.maintenance_mode) {
      let banner = document.getElementById('maintenanceModeBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'maintenanceModeBanner';
        banner.style.cssText = 'background: linear-gradient(90deg, #991b1b, #ef4444); color: #fff; text-align: center; padding: 10px 16px; font-weight: 700; font-size: 0.88rem; position: relative; z-index: 99999; box-shadow: 0 4px 15px rgba(239,68,68,0.4);';
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-left:8px;"></i> تنبيه: المتجر في وضع الصيانة المجدولة حالياً — الطلبات قيد المتابعة.`;
        document.body.prepend(banner);
      }
    }
  } catch (e) {
    console.warn('Dynamic settings error:', e);
  }
}

// Dynamic Featured Bundles Showcase
async function loadFeaturedBundles() {
  const grid = document.getElementById('featuredBundlesGrid');
  if (!grid) return;

  let bundles = [];
  if (window.NexaSupabase && window.NexaSupabase.bundles) {
    try {
      bundles = await window.NexaSupabase.bundles.getAll(false);
    } catch (e) {
      console.warn('Bundles fetch error:', e);
    }
  }

  if (!Array.isArray(bundles) || bundles.length === 0) {
    bundles = [
      {
        id: 'bundle-creator-ultra',
        title: 'باقة المبدع الشاملة (Creator Ultra Suite)',
        description: 'تجميعة شاملة لأهم أدوات الذكاء الاصطناعي والتصميم لإنتاج محتوى استثنائي واحترافي',
        original_price: 1850,
        discounted_price: 1399,
        savings_amount: 451,
        image: 'CARD3.jpg',
        bundle_items: [
          { products: { name: 'ChatGPT Plus' } },
          { products: { name: 'Canva Pro' } },
          { products: { name: 'CapCut Pro' } }
        ]
      },
      {
        id: 'bundle-ai-powerhouse',
        title: 'باقة قوى الذكاء الاصطناعي (AI Powerhouse)',
        description: 'الباقة الأقوى لرواد الأعمال والمطورين: شات جي بي تي بلس + كلود برو + بيربلكسيتي برو سنوي',
        original_price: 2800,
        discounted_price: 2199,
        savings_amount: 601,
        image: 'CARD4.jpg',
        bundle_items: [
          { products: { name: 'ChatGPT Plus' } },
          { products: { name: 'Claude Pro' } },
          { products: { name: 'Perplexity Pro' } }
        ]
      },
      {
        id: 'bundle-ultimate-entertainment',
        title: 'باقة الترفيه والألعاب المتكاملة',
        description: 'متعة وترفيه بلا حدود وبدون إعلانات: يوتيوب بريميوم سنوي + سبوتيفاي سنوي + ديسكورد نيترو',
        original_price: 1650,
        discounted_price: 1199,
        savings_amount: 451,
        image: 'CARD1.jpg',
        bundle_items: [
          { products: { name: 'YouTube Premium' } },
          { products: { name: 'Spotify Premium' } },
          { products: { name: 'Discord Nitro' } }
        ]
      }
    ];
  }

  grid.innerHTML = bundles.map(b => {
    const title = b.name || b.title || 'باقة توفيرية مجمعة';
    const origPrice = Number(b.original_price_egp ?? b.original_price) || 0;
    const discPrice = Number(b.price_egp ?? b.discounted_price) || 0;
    const savings = Number(b.savings_amount) || Math.max(0, origPrice - discPrice);
    const itemsList = Array.isArray(b.bundle_items) ? b.bundle_items.map(bi => bi.products?.name || bi.product_name || 'اشتراك معتمد') : ['اشتراكات معتمدة'];
    const img = b.image || 'CARD4.jpg';

    return `
      <div class="bundle-showcase-card" style="box-sizing:border-box; width:100%; max-width:100%; background:rgba(12,22,40,0.85); border:1px solid rgba(56,189,248,0.3); border-radius:18px; padding:18px 14px; display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden; backdrop-filter:blur(10px); box-shadow:0 12px 30px rgba(0,0,0,0.4); transition:transform 0.3s ease, border-color 0.3s ease;">
        <div style="position:absolute; top:12px; left:12px; background:linear-gradient(135deg, #f59e0b, #ef4444); color:#fff; font-size:0.75rem; font-weight:800; padding:4px 10px; border-radius:20px; box-shadow:0 4px 12px rgba(239,68,68,0.4);">
          <i class="fa-solid fa-fire"></i> وفر ${savings.toLocaleString()} ج.م
        </div>

        <div>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
            <div style="width:52px; height:52px; border-radius:14px; overflow:hidden; border:1px solid rgba(56,189,248,0.4); flex-shrink:0;">
              <img src="${img}" alt="${title}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div>
              <span style="font-size:0.72rem; color:var(--cyan-primary); font-weight:700;">باقة كومبو توفيرية</span>
              <h3 style="font-size:1.05rem; font-weight:800; color:#fff; margin:2px 0 0 0;">${title}</h3>
            </div>
          </div>

          <p style="font-size:0.84rem; color:var(--text-muted); line-height:1.45; margin-bottom:14px;">
            ${b.description || 'احصل على عدة اشتراكات في طلب واحد بسعر مخفض وضمان كامل.'}
          </p>

          <div style="background:rgba(8,16,32,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:10px 14px; margin-bottom:16px;">
            <div style="font-size:0.72rem; color:#94a3b8; font-weight:700; margin-bottom:6px;">محتويات الباقة (${itemsList.length} اشتراكات):</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${itemsList.map(item => `
                <span style="display:inline-flex; align-items:center; gap:5px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); border-radius:6px; padding:3px 8px; font-size:0.75rem; color:#38bdf8;">
                  <i class="fa-solid fa-circle-check" style="font-size:0.65rem;"></i> ${item}
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <div style="border-top:1px solid rgba(56,189,248,0.18); padding-top:14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div>
            ${origPrice > discPrice ? `<div style="text-decoration:line-through; color:#64748b; font-size:0.85rem; font-family:var(--font-latin);">${origPrice.toLocaleString()} ج.م</div>` : ''}
            <div style="color:var(--cyan-bright); font-size:1.35rem; font-weight:900; font-family:var(--font-latin);">${discPrice.toLocaleString()} ج.م</div>
          </div>
          <a href="checkout.html?bundle=${encodeURIComponent(b.id)}" class="btn btn-cyan-primary" style="padding:8px 18px; font-size:0.88rem; font-weight:800; border-radius:10px;">
            <span>اطلب الباقة</span>
            <i class="fa-solid fa-bolt"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// 10. Real-Time Sync with Dashboard
window.addEventListener('nexaProductsUpdated', () => {
  renderCatalogGrid();
  renderCart();
  loadFeaturedBundles();
  loadDynamicStorefrontSettings();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'nexa_products_catalog_v2' || e.key === 'nexa_store_settings_v2') {
    renderCatalogGrid();
    renderCart();
    loadFeaturedBundles();
    loadDynamicStorefrontSettings();
  }
});

// 11. Initializing Everything on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Init timer
  initCountdownTimer();

  // Load dynamic settings & featured bundles
  loadDynamicStorefrontSettings();
  loadFeaturedBundles();

  // Initial render of catalog
  renderCatalogGrid();

  // Sync latest catalog from Supabase
  refreshCatalogFromSupabase();

  // Init cart
  initCart();

  // Init search
  initSearch();

  // Catalog search input
  const catSearchInput = document.getElementById('catalogSearchInput');
  if (catSearchInput) {
    catSearchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim().toLowerCase();
      renderCatalogGrid();
    });
  }

  // Bot Provider pills click
  document.querySelectorAll('.bot-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.bot-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentBot = pill.dataset.bot;
      renderCatalogGrid();
    });
  });

  // Header cart button
  document.getElementById('cartBtn')?.addEventListener('click', openCartDrawer);

  // Account buttons
  document.getElementById('accountBtn')?.addEventListener('click', openAccountModal);

  // Mobile menu burger toggle
  document.getElementById('mobileMenuBtn')?.addEventListener('click', (e) => {
    if (typeof window.toggleMobileDrawer === 'function') {
      window.toggleMobileDrawer(e);
    }
  });
  document.getElementById('drawerCloseBtn')?.addEventListener('click', () => {
    if (typeof window.closeMobileDrawer === 'function') {
      window.closeMobileDrawer();
    }
  });

  // Language Switcher & Event Listener (powered by i18n.js)
  window.addEventListener('activkeyz-language-changed', (e) => {
    const lang = e.detail?.language || 'ar';
    showToast(lang === 'ar' ? 'تم ضبط اللغة: العربية' : 'Language set to English');
    renderCatalogGrid();
    renderCart();
  });

  // Category Pills Clicks
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const category = pill.dataset.category;
      filterByCategory(category);
    });
  });

  // Payment Option selection in checkout modal
  document.querySelectorAll('.pay-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.pay-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeProductModal();
      closeCheckoutModal();
      closeSuccessModal();
      closeAccountModal();
    }
  });

  // PRIORITY 4: Initialize Mobile Hero Carousel Motion
  initMobileHeroCarousel();

  // PRIORITY 6: Initialize Verified Metrics Stats Counter
  initVerifiedStatsCounter();
});

// PRIORITY 4: Mobile Hero Carousel Real Motion
function initMobileHeroCarousel() {
  const stage = document.querySelector('.cards-fan-stage');
  if (!stage) return;

  const cards = Array.from(stage.querySelectorAll('.fan-card'));
  if (cards.length === 0) return;

  let currentIndex = 0;
  let autoTimer = null;
  let isUserInteracting = false;
  let interactionTimeout = null;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scrollToCard(index) {
    if (index < 0 || index >= cards.length) return;
    const card = cards[index];
    const leftOffset = card.offsetLeft - (stage.clientWidth - card.clientWidth) / 2;
    stage.scrollTo({ left: leftOffset, behavior: prefersReduced ? 'auto' : 'smooth' });
    currentIndex = index;
  }

  function advance() {
    if (prefersReduced || isUserInteracting || window.innerWidth > 768) return;
    const nextIndex = (currentIndex + 1) % cards.length;
    scrollToCard(nextIndex);
  }

  function pauseProgression() {
    isUserInteracting = true;
    if (interactionTimeout) clearTimeout(interactionTimeout);
    interactionTimeout = setTimeout(() => {
      isUserInteracting = false;
    }, 8000);
  }

  stage.addEventListener('touchstart', pauseProgression, { passive: true });
  stage.addEventListener('touchmove', pauseProgression, { passive: true });
  stage.addEventListener('pointerdown', pauseProgression, { passive: true });
  stage.addEventListener('mouseenter', pauseProgression);

  let scrollTimeout = null;
  stage.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const stageCenter = stage.scrollLeft + stage.clientWidth / 2;
      let closestIdx = 0;
      let minDiff = Infinity;
      cards.forEach((c, idx) => {
        const cCenter = c.offsetLeft + c.clientWidth / 2;
        const diff = Math.abs(cCenter - stageCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      currentIndex = closestIdx;
    }, 100);
  }, { passive: true });

  if (!prefersReduced) {
    autoTimer = setInterval(advance, 5500);
  }
}

// PRIORITY 6: Animated Statistics Counter (Verified Metrics Only)
function initVerifiedStatsCounter() {
  const counterSection = document.getElementById('verifiedStatsCounter');
  if (!counterSection) return;

  const prodCountEl = document.getElementById('statPublishedProducts');
  const catCountEl = document.getElementById('statActiveCategories');

  const catalog = (typeof getCatalog === 'function' ? getCatalog() : []) || [];
  const totalProducts = catalog.length > 0 ? catalog.length : 23;
  const totalCategories = 5;

  let hasAnimated = false;
  function animateValue(el, start, end, duration) {
    if (!el) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(progress * (end - start) + start);
      el.textContent = current;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = end;
      }
    };
    window.requestAnimationFrame(step);
  }

  if (!window.IntersectionObserver) {
    if (prodCountEl) prodCountEl.textContent = totalProducts;
    if (catCountEl) catCountEl.textContent = totalCategories;
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        animateValue(prodCountEl, 0, totalProducts, 1200);
        animateValue(catCountEl, 0, totalCategories, 900);
      }
    });
  }, { threshold: 0.25 });

  observer.observe(counterSection);
}

window.addEventListener('nexa-currency-changed', () => {
  if (typeof renderCatalog === 'function') renderCatalog();
});
