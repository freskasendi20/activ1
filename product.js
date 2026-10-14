/* ===================================================================
   Activkeyz - DEDICATED PRODUCT PAGE CONTROLLER (product.js)
   Renders full standalone product experience, tabs, buy box,
   instant checkout, and recommended products.
   =================================================================== */

let currentProduct = null;
let cart = [];
let selectedQuantity = 1;
let selectedActivation = 'ready';
let productVariantsList = [];
let selectedVariant = null;
let prodItiInstance = null;

function normalizeDigits(str) {
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicDigits[i], i.toString()).replaceAll(persianDigits[i], i.toString());
  }
  return res.replace(/\D/g, '');
}

function initProductIntlPhone() {
  const phoneEl = document.getElementById('deliveryWhatsappPhone');
  if (!phoneEl) return;
  if (prodItiInstance) return;

  if (!window.intlTelInput) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (window.intlTelInput && !prodItiInstance) {
        clearInterval(checkInterval);
        initProductIntlPhone();
      } else if (attempts > 30) {
        clearInterval(checkInterval);
      }
    }, 100);
    return;
  }

  try {
    prodItiInstance = window.intlTelInput(phoneEl, {
      initialCountry: "eg",
      separateDialCode: true,
      countrySearch: true,
      nationalMode: true,
      formatOnDisplay: false,
      useFullscreenPopup: false,
      utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@24.5.0/build/js/utils.js"
    });

      // Strict numbers only: block non-digit keypresses
      phoneEl.addEventListener('keydown', function(e) {
        if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
            ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && (e.ctrlKey === true || e.metaKey === true)) ||
            (e.keyCode >= 35 && e.keyCode <= 39)) {
          return;
        }
        if (e.key && /^[0-9٠-٩۰-۹]$/.test(e.key)) {
          return;
        }
        e.preventDefault();
      });

      // Normalize digits and sanitize input
      phoneEl.addEventListener('input', function() {
        const normalized = normalizeDigits(this.value);
        if (this.value !== normalized) {
          this.value = normalized;
        }
      });

      // Sanitize pasted content
      phoneEl.addEventListener('paste', function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
        const clean = normalizeDigits(pasted);
        const start = this.selectionStart || 0;
        const end = this.selectionEnd || 0;
        const current = this.value || '';
        this.value = current.substring(0, start) + clean + current.substring(end);
        this.selectionStart = this.selectionEnd = start + clean.length;
      });

      function syncPhonePadding() {
        const itiContainer = phoneEl.closest('.iti');
        if (!itiContainer) return;
        const btn = itiContainer.querySelector('.iti__selected-country');
        if (btn) {
          const w = Math.ceil(btn.getBoundingClientRect().width || btn.offsetWidth || 93);
          const pad = Math.max(w + 14, 108);
          phoneEl.style.setProperty('--iti-phone-pad', pad + 'px');
          phoneEl.style.setProperty('padding-left', pad + 'px', 'important');
        }
      }
      phoneEl.addEventListener('countrychange', syncPhonePadding);
      syncPhonePadding();
      setTimeout(syncPhonePadding, 50);
      setTimeout(syncPhonePadding, 200);

      const btnCountry = phoneEl.closest('.iti')?.querySelector('.iti__selected-country');
      if (btnCountry && window.ResizeObserver) {
        new ResizeObserver(() => syncPhonePadding()).observe(btnCountry);
      }

      const savedPhone = localStorage.getItem('activkeyz_customer_phone');
      if (savedPhone) {
        try {
          prodItiInstance.setNumber(savedPhone);
        } catch (e) {
          phoneEl.value = savedPhone;
        }
      }
      setTimeout(syncPhonePadding, 120);
    } catch (e) {
      console.warn('Product intl-tel-input init error:', e);
    }
  }

function updateDynamicPrice() {
  if (!currentProduct) return;
  const priceEgpEl = document.getElementById('prodPriceEgp');
  const priceUsdEl = document.getElementById('prodPriceUsd');
  const oldPriceEl = document.getElementById('prodOldPrice');
  const discountBadge = document.getElementById('prodDiscountBadge');
  const summaryBadge = document.getElementById('qtyCalcSummary');
  const hintEl = document.getElementById('prodUnitPriceHint');
  const durationPill = document.getElementById('prodDurationPill');

  const unitEgp = selectedVariant ? Number(selectedVariant.price_egp) : (currentProduct.priceEgp || 1000);
  const unitUsd = selectedVariant ? Number(selectedVariant.price_usd) : (currentProduct.priceUsd ? currentProduct.priceUsd : (unitEgp / 50));
  const activeDuration = selectedVariant ? selectedVariant.duration : (currentProduct.duration || 'اشتراك رسمي');

  if (durationPill) {
    durationPill.innerHTML = `<i class="fa-solid fa-clock"></i> ${escapeHtml(activeDuration)}`;
  }

  const totalEgp = unitEgp * selectedQuantity;
  const formattedPrice = window.formatNexaPrice ? window.formatNexaPrice(totalEgp) : { full: `${totalEgp.toLocaleString()} ج.م`, formatted: totalEgp.toLocaleString(), unit: 'ج.م' };
  const totalUsd = (unitUsd * selectedQuantity).toFixed(2);

  if (priceEgpEl) priceEgpEl.textContent = formattedPrice.full;
  if (priceUsdEl) priceUsdEl.textContent = (window.getNexaCurrency && window.getNexaCurrency() === 'USD') ? '' : `$${totalUsd}`;

  const stickyPriceEl = document.getElementById('stickyProdPrice');
  if (stickyPriceEl) stickyPriceEl.innerHTML = `${formattedPrice.formatted} <span>${formattedPrice.unit}</span>`;
  const stickyNameEl = document.getElementById('stickyProdName');
  if (stickyNameEl && currentProduct) stickyNameEl.textContent = currentProduct.name;

  const hasAuthenticDiscount = Boolean(currentProduct.originalPriceEgp && currentProduct.originalPriceEgp > unitEgp);
  if (hasAuthenticDiscount) {
    const oldTotalEgp = Number(currentProduct.originalPriceEgp) * selectedQuantity;
    const oldFormatted = window.formatNexaPrice ? window.formatNexaPrice(oldTotalEgp) : { full: `${oldTotalEgp.toLocaleString()} ج.م` };
    const savedEgp = oldTotalEgp - totalEgp;
    const savedFormatted = window.formatNexaPrice ? window.formatNexaPrice(savedEgp) : { full: `${savedEgp.toLocaleString()} ج.م` };
    if (oldPriceEl) {
      oldPriceEl.style.display = 'inline';
      oldPriceEl.textContent = oldFormatted.full;
    }
    if (discountBadge) {
      discountBadge.style.display = 'inline-flex';
      discountBadge.textContent = `وفر ${savedFormatted.full}`;
    }
  } else {
    if (oldPriceEl) oldPriceEl.style.display = 'none';
    if (discountBadge) discountBadge.style.display = 'none';
  }
  if (summaryBadge) summaryBadge.textContent = `${selectedQuantity} ${selectedQuantity === 1 ? 'اشتراك' : (selectedQuantity === 2 ? 'اشتراكين' : 'اشتراكات')}`;

  if (hintEl) {
    if (selectedQuantity > 1) {
      hintEl.style.display = 'block';
      hintEl.innerHTML = `<i class="fa-solid fa-calculator"></i> سعر الوحدة: <strong>${unitEgp.toLocaleString()} ج.م</strong> × ${selectedQuantity} = <strong>${totalEgp.toLocaleString()} ج.م</strong>`;
    } else {
      hintEl.style.display = 'none';
    }
  }

  // Update WhatsApp message with quantity and variant
  const waBtn = document.getElementById('prodWhatsappBtn');
  if (waBtn) {
    const varTxt = selectedVariant ? ` [باقة: ${selectedVariant.name}]` : '';
    const waMsg = `مرحباً Activkeyz! أرغب بطلب اشتراك: ${currentProduct.name}${varTxt} (${activeDuration})\nالكمية: ${selectedQuantity}\nالإجمالي: ${totalEgp.toLocaleString()} ج.م\nنوع الاستلام: ${selectedActivation === 'personal' ? 'تفعيل على إيميل شخصي' : 'حساب جاهز'}\nكود المنتج: ${currentProduct.id}`;
    waBtn.href = `https://wa.me/201225106057?text=${encodeURIComponent(waMsg)}`;
  }
}
function initProductPage() {
  initCountdownTimer();
  loadCartFromStorage();
  initSearch();
  initTabs();
  initQuantityAndActivationControls();
  initProductIntlPhone();

  // Read product ID from query parameter
  const params = new URLSearchParams(window.location.search);
  let rawId = (params.get('id') || '').trim();

  (async function loadProduct() {
    if (!rawId) {
      // Resilient fallback to flagship product so the page never gets stuck on loading
      rawId = 'chatgpt-plus';
    }

    const canonicalId = (window.NexaResolveCanonicalProductId)
      ? window.NexaResolveCanonicalProductId(rawId)
      : rawId;

    // 1. Immediate zero-latency render from NexaDB cache
    let immediate = null;
    if (window.NexaDB && typeof window.NexaDB.getById === 'function') {
      immediate = window.NexaDB.getById(canonicalId) || window.NexaDB.getById(rawId);
    }

    if (immediate) {
      currentProduct = immediate;
      window.currentProduct = immediate;
      hideProductNotFound();
      renderProductDetails(currentProduct);
      renderRelatedProducts(currentProduct);
    } else {
      // Immediately display 404 state without delay (never substitute ChatGPT)
      renderProductNotFound(rawId);
    }

    // 2. Fetch fresh catalog from Supabase (or fallback)
    let allProducts = [];
    if (window.NexaSupabase && typeof window.NexaSupabase.products.getAll === 'function') {
      try {
        allProducts = await window.NexaSupabase.products.getAll();
      } catch (e) {
        console.warn('NexaSupabase.products.getAll failed, using NexaDB:', e);
        allProducts = (window.NexaDB && typeof window.NexaDB.getAll === 'function') ? window.NexaDB.getAll() : [];
      }
    } else if (window.NexaDB && typeof window.NexaDB.getAll === 'function') {
      allProducts = window.NexaDB.getAll();
    }

    // Filter allProducts by authorization allowlist
    if (window.NexaDB && typeof window.NexaDB.isAuthorized === 'function') {
      allProducts = allProducts.filter(p => p && p.id && window.NexaDB.isAuthorized(p.id));
    }

    // Lookup product strictly by canonical ID or raw ID
    let found = allProducts.find(p => p.id === canonicalId || p.id === rawId || p.slug === canonicalId || p.slug === rawId);

    // If not found in fetched list, try local NexaDB
    if (!found && window.NexaDB && typeof window.NexaDB.getById === 'function') {
      found = window.NexaDB.getById(canonicalId) || window.NexaDB.getById(rawId);
    }

    // Double check authorization
    if (found && window.NexaDB && typeof window.NexaDB.isAuthorized === 'function' && !window.NexaDB.isAuthorized(found.id)) {
      found = null;
    }

    // If still not found, render proper Arabic 404 state. NEVER substitute another product!
    if (!found) {
      renderProductNotFound(rawId);
      return;
    }

    const needsRerender = !immediate || 
      immediate.id !== found.id || 
      immediate.priceEgp !== found.priceEgp || 
      immediate.isActive !== found.isActive;

    currentProduct = found;
    window.currentProduct = found;
    hideProductNotFound();
    if (needsRerender) {
      renderProductDetails(currentProduct);
      renderRelatedProducts(currentProduct);
    }
  })();

  // Listen for database updates
  window.addEventListener('nexaProductsUpdated', () => {
    if (!currentProduct || !currentProduct.id) return;
    const updated = (window.NexaDB && window.NexaDB.getById) ? window.NexaDB.getById(currentProduct.id) : null;
    if (updated) {
      currentProduct = updated;
      window.currentProduct = updated;
      renderProductDetails(currentProduct);
      renderRelatedProducts(currentProduct);
    }
  });

  // Mobile drawer listeners
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  const drawerClose = document.getElementById('drawerCloseBtn');
  if (mobileBtn && drawer) {
    mobileBtn.addEventListener('click', () => drawer.classList.add('active'));
  }
  if (drawerClose && drawer) {
    drawerClose.addEventListener('click', () => drawer.classList.remove('active'));
  }
  document.getElementById('accountBtn')?.addEventListener('click', () => {
    window.location.href = 'account.html';
  });
}

window.initProductPage = initProductPage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductPage);
} else {
  initProductPage();
}

// Quantity Stepper & Activation Choice Engine
function initQuantityAndActivationControls() {
  const minusBtn = document.getElementById('qtyMinusBtn');
  const plusBtn = document.getElementById('qtyPlusBtn');
  const qtyInput = document.getElementById('productQuantityInput');
  const optReady = document.getElementById('optReadyCard');
  const optPersonal = document.getElementById('optPersonalCard');

  if (minusBtn && plusBtn && qtyInput) {
    minusBtn.addEventListener('click', () => {
      let val = parseInt(qtyInput.value) || 1;
      if (val > 1) {
        val -= 1;
        qtyInput.value = val;
        selectedQuantity = val;
        updateDynamicPrice();
      }
    });

    plusBtn.addEventListener('click', () => {
      let val = parseInt(qtyInput.value) || 1;
      if (val < 50) {
        val += 1;
        qtyInput.value = val;
        selectedQuantity = val;
        updateDynamicPrice();
      }
    });

    qtyInput.addEventListener('change', () => {
      let val = parseInt(qtyInput.value) || 1;
      if (val < 1) val = 1;
      if (val > 50) val = 50;
      qtyInput.value = val;
      selectedQuantity = val;
      updateDynamicPrice();
    });
  }

  // Auto-prefill delivery fields if user is logged in
  try {
    const rawUser = localStorage.getItem('nexa_customer_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const emailField = document.getElementById('deliveryRecipientEmail');
      if (emailField && u.email && !emailField.value) {
        emailField.value = u.email;
      }
      const phoneField = document.getElementById('deliveryWhatsappPhone');
      if (phoneField && u.phone && !phoneField.value) {
        phoneField.value = u.phone;
      }
    }
  } catch (e) {}
}

// Product 404 Not Found & Active State Controllers
function renderProductNotFound(productId) {
  currentProduct = null;
  document.title = 'المنتج غير موجود | Activkeyz';

  const notFoundEl = document.getElementById('productNotFoundState');
  const showcaseEl = document.getElementById('productShowcaseSection');
  const tabsEl = document.getElementById('productTabsSection');
  const relatedEl = document.getElementById('relatedProductsSection');
  const crumbTitle = document.getElementById('crumbProdTitle');

  if (crumbTitle) crumbTitle.textContent = 'المنتج غير موجود';
  if (notFoundEl) notFoundEl.style.display = 'block';
  if (showcaseEl) showcaseEl.style.display = 'none';
  if (tabsEl) tabsEl.style.display = 'none';
  if (relatedEl) relatedEl.style.display = 'none';

  console.warn(`[Activkeyz] Product not found for ID/slug: "${productId}". Rendered 404 view.`);
}

function hideProductNotFound() {
  const notFoundEl = document.getElementById('productNotFoundState');
  const showcaseEl = document.getElementById('productShowcaseSection');
  const tabsEl = document.getElementById('productTabsSection');
  const relatedEl = document.getElementById('relatedProductsSection');

  if (notFoundEl) notFoundEl.style.display = 'none';
  if (showcaseEl) showcaseEl.style.display = '';
  if (tabsEl) tabsEl.style.display = '';
  if (relatedEl) relatedEl.style.display = '';
}

// Render Main Product Details
function renderProductDetails(prod) {
  if (!prod) return;
  currentProduct = prod;
  window.currentProduct = prod;
  const showcaseSec = document.getElementById('productShowcaseSection');
  if (showcaseSec) showcaseSec.setAttribute('data-product-id', prod.id);

  // 1. Browser Title & Meta
  document.title = `${prod.name} | Activkeyz - تفعيل رسمي وضمان شامل`;
  const metaDesc = document.getElementById('pageMetaDesc');
  if (metaDesc) metaDesc.content = prod.desc || 'اشتراك رقمي رسمي معتمد من Activkeyz';

  // 2. Breadcrumbs
  const catNames = {
    'ai': 'أدوات الذكاء الاصطناعي',
    'creative': 'البرامج الإبداعية والتصميم',
    'office': 'برامج المكتب والإنتاجية',
    'streaming': 'الترفيه والاشتراكات',
    'gaming': 'الألعاب والبطاقات والحماية'
  };

  const catName = catNames[prod.category] || (window.fixArabicMojibake ? window.fixArabicMojibake(prod.catName) : prod.catName) || 'أدوات الذكاء الاصطناعي';
  const crumbCat = document.getElementById('crumbCatLink');
  const crumbProd = document.getElementById('crumbProdTitle');
  if (crumbCat) {
    crumbCat.textContent = catName;
    crumbCat.href = `category.html?cat=${prod.category || 'all'}`;
  }
  if (crumbProd) crumbProd.textContent = prod.name;

  // 3. Visuals & Badges
  const mainImg = document.getElementById('prodMainImage');
  const durationPill = document.getElementById('prodDurationPill');
  const imgPath = (window.NexaResolveProductImage ? window.NexaResolveProductImage(prod) : (prod.image || prod.featuredImage)) || 'logos/Activkeyzmainlogo.png';
  
  if (mainImg) {
    mainImg.style.display = 'block';
    mainImg.src = imgPath;
    mainImg.alt = prod.name;
    mainImg.onerror = function() {
      if (this.src !== 'logos/Activkeyzmainlogo.png') {
        this.src = 'logos/Activkeyzmainlogo.png';
      }
    };
  }
  if (durationPill) {
    durationPill.innerHTML = `<i class="fa-solid fa-clock"></i> ${escapeHtml(prod.duration || 'اشتراك رسمي')}`;
  }

  // 4. Center Column Text & Mobile Header
  const catChip = document.getElementById('prodCatName');
  const catChipMobile = document.getElementById('prodCatNameMobile');
  const mainTitle = document.getElementById('prodMainTitle');
  const mainTitleMobile = document.getElementById('prodMainTitleMobile');
  const subtitle = document.getElementById('prodSubtitle');
  const subtitleMobile = document.getElementById('prodSubtitleMobile');
  const quickDesc = document.getElementById('prodQuickDesc');
  const featuresList = document.getElementById('prodFeaturesList');

  const subText = prod.category === 'ai' 
    ? 'اشتراك ذكاء اصطناعي احترافي يدعم أحدث النماذج'
    : (prod.desc ? prod.desc.slice(0, 70) + '...' : 'ترخيص معتمد وموثوق');

  if (catChip) catChip.textContent = catName;
  if (catChipMobile) catChipMobile.textContent = catName;
  if (mainTitle) mainTitle.textContent = prod.name;
  if (mainTitleMobile) mainTitleMobile.textContent = prod.name;
  if (subtitle) subtitle.textContent = subText;
  if (subtitleMobile) subtitleMobile.textContent = subText;
  const stickyName = document.getElementById('stickyProdName');
  if (stickyName) stickyName.textContent = prod.name;

  if (quickDesc) quickDesc.textContent = prod.desc || 'حل رقمي معتمد وموثوق لتلبية جميع احتياجاتك مع ضمان كامل وتسليم عبر البريد.';

  // Features Checklist (Free of fake claims)
  if (featuresList) {
    const specs = (prod.specs && Array.isArray(prod.specs) && prod.specs.length > 0)
      ? prod.specs
      : [
          'وصول كامل لكافة خصائص المنصة الرسمية',
          'تفعيل معتمد على حسابك أو حساب رسمي مجهز',
          'ضمان شامل طوال مدة الاشتراك المحددة',
          'تسليم مباشر وسريع لبيانات الترخيص عبر البريد'
        ];

    featuresList.innerHTML = specs.map(s => `
      <li class="product-feature-item">
        <i class="fa-solid fa-circle-check"></i>
        <span>${escapeHtml(s)}</span>
      </li>
    `).join('');
  }

  // 5. Buy Box & Pricing
  const priceEgpEl = document.getElementById('prodPriceEgp');
  const priceUsdEl = document.getElementById('prodPriceUsd');
  const oldPriceEl = document.getElementById('prodOldPrice');
  const discountBadge = document.getElementById('prodDiscountBadge');
  const waBtn = document.getElementById('prodWhatsappBtn');

  const retailEgp = prod.priceEgp || 1000;
  const retailUsd = prod.priceUsd ? prod.priceUsd.toFixed(2) : (retailEgp / 50).toFixed(2);
  const oldPriceEgp = Math.round(retailEgp * 1.25);
  const savedEgp = oldPriceEgp - retailEgp;

  if (priceEgpEl) priceEgpEl.textContent = `${retailEgp.toLocaleString()} ج.م`;
  if (priceUsdEl) priceUsdEl.textContent = `$${retailUsd}`;
  if (oldPriceEl) oldPriceEl.textContent = `${oldPriceEgp.toLocaleString()} ج.م`;
  if (discountBadge) discountBadge.textContent = `وفر ${savedEgp.toLocaleString()} ج.م (خصم 20%)`;

  // WhatsApp Direct Link
  if (waBtn) {
    const waMsg = `مرحباً Activkeyz! أرغب بطلب وتفعيل اشتراك: ${prod.name} (${prod.duration || ''}) بسعر ${retailEgp} ج.م.\nكود المنتج: ${prod.id}`;
    waBtn.href = `https://wa.me/201225106057?text=${encodeURIComponent(waMsg)}`;
  }

  // Ensure buy box and mobile sticky purchase bar are synchronized
  updateDynamicPrice();

  // 6. Tabs Content
  const overviewTextEl = document.getElementById('tabOverviewText');
  const activationTextEl = document.getElementById('tabActivationCustomText');
  const warrantyTextEl = document.getElementById('tabWarrantyText');

  if (overviewTextEl) {
    overviewTextEl.textContent = prod.fullDesc || `${prod.desc}\n\nاحصل على اشتراك رسمي كامل ومعتمد بنسبة 100% مع ضمان استقرار دائم وسرعة استجابة فائقة.`;
  }
  if (activationTextEl) {
    activationTextEl.textContent = prod.activationGuide || `تعليمات التفعيل المباشر:\n1. يتم إرسال بيانات التفعيل إلى الواتساب أو الإيميل الخاص بك.\n2. سجل الدخول إلى المنصة الرسمية وابدأ بالاستمتاع بالمميزات فوراً.`;
  }
  if (warrantyTextEl) {
    warrantyTextEl.textContent = prod.warranty || `ضمان رسمي كامل طوال فترة الاشتراك (${prod.duration || 'الرسمية'}). في حال حدوث أي خلل، يتكفل الدعم الفني بالحل أو الاستبدال الفوري.`;
  }

  // Checkout modal amount
  const modalAmt = document.getElementById('checkoutModalAmount');
  if (modalAmt) modalAmt.textContent = `${retailEgp.toLocaleString()} ج.م ($${retailUsd})`;

  // Stock Status Controls & Prevention of Overselling
  const inv = prod.inventory;
  const isOutOfStock = (inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused) || (prod.isActive === false);
  const isLowStock = (inv && inv.stockType === 'limited' && inv.available > 0 && inv.available <= (inv.threshold || 5));

  const buyNowBtn = document.getElementById('buyNowBtn');
  const addCartBtn = document.getElementById('addToCartBtn');
  const qtyInput = document.getElementById('productQuantityInput');

  if (isOutOfStock) {
    if (buyNowBtn) {
      buyNowBtn.disabled = true;
      buyNowBtn.style.opacity = '0.45';
      buyNowBtn.style.cursor = 'not-allowed';
      buyNowBtn.innerHTML = `<i class="fa-solid fa-ban"></i> <span>نفدت الكمية مؤقتاً</span>`;
    }
    if (addCartBtn) {
      addCartBtn.disabled = true;
      addCartBtn.style.opacity = '0.45';
      addCartBtn.style.cursor = 'not-allowed';
    }
    if (qtyInput) qtyInput.disabled = true;

    // Show Out of stock warning banner
    let stockAlert = document.getElementById('prodStockAlert');
    if (!stockAlert) {
      stockAlert = document.createElement('div');
      stockAlert.id = 'prodStockAlert';
      stockAlert.style.cssText = 'background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); border-radius: 10px; padding: 10px 14px; margin-top: 14px; color: #ef4444; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 8px;';
      stockAlert.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> هذا المنتج غير متوفر حالياً في المخزون أو تم إيقاف مبيعاته مؤقتاً.`;
      const buyCard = document.querySelector('.product-checkout-card');
      if (buyCard) buyCard.prepend(stockAlert);
    }
  } else if (isLowStock) {
    let stockAlert = document.getElementById('prodStockAlert');
    if (!stockAlert) {
      stockAlert = document.createElement('div');
      stockAlert.id = 'prodStockAlert';
      stockAlert.style.cssText = 'background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); border-radius: 10px; padding: 8px 12px; margin-top: 10px; color: #f59e0b; font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 8px;';
      stockAlert.innerHTML = `<i class="fa-solid fa-fire"></i> كمية محدودة متبقية في المخزون (${inv.available} فقط)! سارع بالطلب.`;
      const buyCard = document.querySelector('.product-checkout-card');
      if (buyCard) buyCard.prepend(stockAlert);
    }
  }

  // Admin-Configured Delivery Method, Explanation & Required Inputs
  const deliveryMethod = prod.deliveryMethod || prod.delivery_method || 'email';
  const deliveryInstructions = prod.deliveryInstructions || prod.delivery_instructions || 'سيتم إرسال بيانات الاشتراك والتفعيل مباشرة إلى بريدك الإلكتروني ورقم الواتساب فور إتمام الدفع.';
  const expectedDelivery = prod.expectedDelivery || prod.expected_delivery || 'فوري خلال دقائق';
  const requiredFields = Array.isArray(prod.requiredFields) ? prod.requiredFields : (Array.isArray(prod.required_fields) ? prod.required_fields : ['recipient_email', 'whatsapp_phone']);

  const delMethodTextEl = document.getElementById('productDeliveryMethodText');
  const delTimeTextEl = document.getElementById('productDeliveryTimeText');
  const delInstructionsEl = document.getElementById('productDeliveryInstructionsText');

  if (delMethodTextEl) {
    const methodLabels = {
      'email': 'تسليم رسمي عبر البريد الإلكتروني وواتساب',
      'whatsapp': 'بيانات ورابط عبر واتساب والبريد',
      'instant': 'كود تفعيل فوري مع إرسال عبر واتساب',
      'custom': 'تسليم مباشر ومتابعة عبر واتساب'
    };
    delMethodTextEl.textContent = methodLabels[deliveryMethod] || 'تسليم رسمي عبر البريد الإلكتروني وواتساب';
  }
  if (delTimeTextEl) {
    delTimeTextEl.textContent = expectedDelivery;
  }
  if (delInstructionsEl) {
    delInstructionsEl.textContent = deliveryInstructions;
  }

  // Delivery fields: WhatsApp & Email are strictly mandatory for all orders & products across the entire site
  const groupEmail = document.getElementById('groupRecipientEmail');
  const groupPhone = document.getElementById('groupWhatsappPhone');
  const groupAccount = document.getElementById('groupAccountEmail');

  const requiresAccount = requiredFields.includes('account_email');

  // Both Email and WhatsApp are strictly required and ALWAYS visible for every single product!
  if (groupEmail) groupEmail.style.display = 'flex';
  if (groupPhone) groupPhone.style.display = 'flex';
  if (groupAccount) groupAccount.style.display = requiresAccount ? 'flex' : 'none';

  // Pre-fill saved customer contact info if available
  try {
    initProductIntlPhone();
    const rawUser = localStorage.getItem('nexa_customer_user');
    const u = rawUser ? JSON.parse(rawUser) : {};
    const savedEmail = localStorage.getItem('activkeyz_customer_email') || u.email || '';
    const savedPhone = localStorage.getItem('activkeyz_customer_phone') || u.phone || '';
    const emailEl = document.getElementById('deliveryRecipientEmail');
    const phoneEl = document.getElementById('deliveryWhatsappPhone');
    if (emailEl && !emailEl.value && savedEmail) emailEl.value = savedEmail;
    if (phoneEl && savedPhone) {
      if (prodItiInstance && typeof prodItiInstance.setNumber === 'function') {
        try { prodItiInstance.setNumber(savedPhone); } catch(e) { phoneEl.value = savedPhone; }
      } else if (!phoneEl.value) {
        phoneEl.value = savedPhone;
      }
    }
  } catch (e) {}

  // Load Dynamic Variants for this product
  loadAndRenderVariants(prod.id);
}

// Render Recommended & Related Products
function renderRelatedProducts(prod) {
  const container = document.getElementById('relatedProductsGrid');
  if (!container || !window.NexaDB) return;

  const related = window.NexaDB.getRelated(prod.id, 4);

  if (related.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-dim);">لا توجد منتجات مقترحة إضافية</div>`;
    return;
  }

  const catNames = {
    'ai': 'أدوات الذكاء الاصطناعي',
    'creative': 'البرامج الإبداعية والتصميم',
    'office': 'برامج المكتب والإنتاجية',
    'streaming': 'الترفيه والاشتراكات',
    'gaming': 'الألعاب والبطاقات والحماية'
  };

  container.innerHTML = related.map(item => {
    const imgPath = (window.NexaResolveProductImage ? window.NexaResolveProductImage(item) : (item.image || item.featuredImage)) || 'logos/Activkeyzmainlogo.png';
    const retailEgp = Number(item.priceEgp || 0);
    const retailUsd = item.priceUsd ? Number(item.priceUsd).toFixed(2) : (retailEgp / 50).toFixed(2);
    const itemCatName = catNames[item.category] || (window.fixArabicMojibake ? window.fixArabicMojibake(item.catName) : item.catName) || 'أدوات الذكاء الاصطناعي';
    const formattedPrice = window.formatNexaPrice ? window.formatNexaPrice(retailEgp) : { formatted: retailEgp.toLocaleString(), unit: 'ج.م' };

    return `
      <div class="catalog-card" onclick="window.location.href='product.html?id=' + encodeURIComponent('${item.id}')">
        <!-- 1. Hero Showcase Stage with 3D floating visual -->
        <div class="catalog-card-showcase">
          <div class="catalog-card-floating-badges">
            <span class="catalog-duration-badge">
              <i class="fa-regular fa-clock"></i>
              <span>${escapeHtml(item.duration || 'اشتراك رسمي')}</span>
            </span>
            <span class="catalog-stock-pill verified">
              <i class="fa-solid fa-shield-halved"></i> متاح للطلب
            </span>
          </div>
          <div class="catalog-card-visual-stage">
            <img src="${imgPath}" alt="${escapeHtml(item.name)}" class="catalog-card-hero-img" loading="lazy" onerror="this.src='logos/Activkeyzmainlogo.png'">
          </div>
        </div>

        <!-- 2. Card Info Body -->
        <div class="catalog-card-body">
          <div class="catalog-card-category-tag">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>${escapeHtml(itemCatName)}</span>
          </div>
          <h3 class="catalog-card-title">${escapeHtml(item.name)}</h3>
          <p class="catalog-card-desc">${escapeHtml(item.desc || 'اشتراك رسمي معتمد مع ضمان كامل طوال المدة وتسليم فوري.')}</p>
        </div>

        <!-- 3. Card Pricing & CTA Footer -->
        <div class="catalog-card-footer">
          <div class="catalog-price-cluster">
            <div class="catalog-price-main">${formattedPrice.formatted} <span class="currency-unit">${formattedPrice.unit}</span></div>
            <div class="catalog-price-secondary">${(window.getNexaCurrency && window.getNexaCurrency() === 'USD') ? '' : `$${retailUsd}`}</div>
          </div>
          <div class="catalog-actions-cluster">
            <button class="btn-card-quick-cart" 
                    onclick="event.stopPropagation(); addToCart('${item.id}')" 
                    title="إضافة سريعة إلى السلة">
              <i class="fa-solid fa-cart-plus"></i>
            </button>
            <a href="product.html?id=${encodeURIComponent(item.id)}" 
               class="btn-card-action" 
               onclick="event.stopPropagation();" 
               title="عرض تفاصيل واشتراك ${escapeHtml(item.name)}">
              <span>عرض والاشتراك</span>
              <i class="fa-solid fa-arrow-left"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Tab Switching
function initTabs() {
  const tabBtns = document.querySelectorAll('.prod-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane-content').forEach(pane => pane.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// FAQ Accordion Toggle
function toggleFaq(btn) {
  const panel = btn.nextElementSibling;
  const icon = btn.querySelector('i');
  if (!panel) return;

  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if (icon) {
    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}

async function loadAndRenderVariants(productId) {
  const section = document.getElementById('productVariantsSection');
  const container = document.getElementById('productVariantsContainer');
  if (!section || !container) return;

  try {
    let vars = [];
    if (window.NexaSupabase && window.NexaSupabase.variants && typeof window.NexaSupabase.variants.getByProductId === 'function') {
      vars = await window.NexaSupabase.variants.getByProductId(productId);
    }
    productVariantsList = vars.filter(v => v.is_active);

    if (productVariantsList.length === 0) {
      section.style.display = 'none';
      selectedVariant = null;
      return;
    }

    section.style.display = 'block';

    const options = [
      { id: 'base', name: currentProduct.duration || 'المدة الافتراضية', duration: currentProduct.duration, price_egp: currentProduct.priceEgp, price_usd: currentProduct.priceUsd },
      ...productVariantsList
    ];

    const activeVarId = selectedVariant ? selectedVariant.id : 'base';
    container.innerHTML = options.map(opt => `
      <button type="button" class="act-pill-btn ${opt.id === activeVarId ? 'active' : ''}" data-var-id="${opt.id}" onclick="selectProductVariant('${opt.id}')">
        <span>${escapeHtml(opt.name)}</span>
        <strong style="color:#38bdf8; margin-right:4px;">${Number(opt.price_egp).toLocaleString()} ج.م</strong>
      </button>
    `).join('');
  } catch (e) {
    console.warn('Failed to load product variants:', e);
    section.style.display = 'none';
  }
}

window.selectProductVariant = function(variantId) {
  document.querySelectorAll('#productVariantsContainer .act-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.varId === variantId);
  });
  if (variantId === 'base') {
    selectedVariant = null;
  } else {
    selectedVariant = productVariantsList.find(v => v.id === variantId) || null;
  }
  updateDynamicPrice();
};

// Instant Buy Action - Direct to Checkout Page
function handleInstantBuy() {
  if (!currentProduct) return;
  const inv = currentProduct.inventory;
  if ((inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused) || (currentProduct.isActive === false)) {
    showToast('عذراً، هذا المنتج غير متوفر في المخزون حالياً! ⚠️');
    return;
  }
  if (inv && inv.stockType === 'limited' && selectedQuantity > inv.available) {
    showToast(`عذراً، الكمية المتوفرة في المخزون هي ${inv.available} فقط.`);
    return;
  }

  // Grab optional pre-entered customer delivery info if available
  const emailInput = document.getElementById('deliveryRecipientEmail');
  let recipientEmail = '';
  if (emailInput && emailInput.value.trim()) {
    recipientEmail = emailInput.value.trim();
  }

  const phoneInput = document.getElementById('deliveryWhatsappPhone');
  let recipientPhone = '';
  if (phoneInput && phoneInput.value.trim()) {
    const rawVal = phoneInput.value.trim();
    if (prodItiInstance && typeof prodItiInstance.getNumber === 'function') {
      try {
        recipientPhone = prodItiInstance.getNumber() || rawVal;
      } catch (e) {
        recipientPhone = rawVal;
      }
    } else {
      recipientPhone = rawVal;
    }
  }

  // Persist customer inputs for smooth checkout & future purchases
  try {
    if (recipientEmail) localStorage.setItem('activkeyz_customer_email', recipientEmail);
    if (recipientPhone) localStorage.setItem('activkeyz_customer_phone', recipientPhone);
    const rawUser = localStorage.getItem('nexa_customer_user');
    const u = rawUser ? JSON.parse(rawUser) : {};
    if (recipientEmail) u.email = recipientEmail;
    if (recipientPhone) u.phone = recipientPhone;
    localStorage.setItem('nexa_customer_user', JSON.stringify(u));
  } catch (e) {}

  const varParam = selectedVariant ? `&variant=${encodeURIComponent(selectedVariant.id)}` : '';
  const emailParam = recipientEmail ? `&email=${encodeURIComponent(recipientEmail)}&recipient=${encodeURIComponent(recipientEmail)}` : '';
  const phoneParam = recipientPhone ? `&phone=${encodeURIComponent(recipientPhone)}` : '';
  const targetUrl = `checkout.html?id=${encodeURIComponent(currentProduct.id)}&qty=${selectedQuantity}${emailParam}${phoneParam}${varParam}`;
  window.location.href = targetUrl;
}

// Add to Cart Action (Zero-Friction CRO Standard)
function handleAddToCartClick() {
  if (!currentProduct) return;
  const inv = currentProduct.inventory;
  if ((inv && inv.stockType === 'limited' && inv.available <= 0) || (inv && inv.isPaused) || (currentProduct.isActive === false)) {
    showToast('عذراً، هذا المنتج غير متوفر في المخزون حالياً! ⚠️');
    return;
  }
  if (inv && inv.stockType === 'limited' && selectedQuantity > inv.available) {
    showToast(`عذراً، الكمية المتوفرة في المخزون هي ${inv.available} فقط.`);
    return;
  }

  // Optional: Read delivery input if provided, without blocking cart additions
  const emailInput = document.getElementById('deliveryRecipientEmail');
  let recipientEmail = emailInput ? emailInput.value.trim() : '';

  const phoneInput = document.getElementById('deliveryWhatsappPhone');
  let recipientPhone = '';
  if (phoneInput && phoneInput.value.trim()) {
    const rawVal = phoneInput.value.trim();
    if (prodItiInstance && typeof prodItiInstance.getNumber === 'function') {
      try {
        recipientPhone = prodItiInstance.getNumber() || rawVal;
      } catch (e) {
        recipientPhone = rawVal;
      }
    } else {
      recipientPhone = rawVal;
    }
  }

  // Persist customer inputs if provided
  try {
    if (recipientEmail) localStorage.setItem('activkeyz_customer_email', recipientEmail);
    if (recipientPhone) localStorage.setItem('activkeyz_customer_phone', recipientPhone);
    const rawUser = localStorage.getItem('nexa_customer_user');
    const u = rawUser ? JSON.parse(rawUser) : {};
    if (recipientEmail) u.email = recipientEmail;
    if (recipientPhone) u.phone = recipientPhone;
    localStorage.setItem('nexa_customer_user', JSON.stringify(u));
  } catch (e) {}

  const prodToAdd = selectedVariant ? {
    ...currentProduct,
    variantId: selectedVariant.id,
    variantName: selectedVariant.name,
    name: `${currentProduct.name} (${selectedVariant.name})`,
    priceEgp: Number(selectedVariant.price_egp),
    priceUsd: Number(selectedVariant.price_usd),
    duration: selectedVariant.duration || currentProduct.duration,
    recipientEmail,
    recipientPhone
  } : {
    ...currentProduct,
    recipientEmail,
    recipientPhone
  };

  addToCart(prodToAdd, selectedQuantity, 'email', recipientEmail, recipientPhone);
  showToast(`تمت إضافة ${selectedQuantity} × "${prodToAdd.name}" إلى سلة مشترياتك! 🛍️`);
  // Open cart drawer smoothly
  document.getElementById('cartDrawer')?.classList.add('active');
  document.getElementById('cartOverlay')?.classList.add('active');
  document.body.classList.add('cart-drawer-open');
}

// Shopping Cart Functions
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('nexa_cart');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cart = parsed.map(item => item.product ? item : { product: item, quantity: item.quantity || 1, activation: item.activation || 'ready' });
      }
    }
  } catch (e) {
    cart = [];
  }
  renderCart();
}

function saveCartToStorage() {
  try {
    localStorage.setItem('nexa_cart', JSON.stringify(cart));
  } catch (e) {}
}

function addToCart(product, qty = 1, activation = 'email', recipientEmail = '', recipientPhone = '') {
  const recEmail = recipientEmail || product.recipientEmail || '';
  const recPhone = recipientPhone || product.recipientPhone || '';
  const existing = cart.find(item => item.product.id === product.id && (item.recipientEmail || '') === recEmail);
  if (existing) {
    existing.quantity += qty;
    if (recPhone) existing.recipientPhone = recPhone;
  } else {
    cart.push({ product, quantity: qty, activation, recipientEmail: recEmail, recipientPhone: recPhone });
  }
  saveCartToStorage();
  renderCart();
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

function removeFromCart(index) {
  const removed = cart[index];
  cart.splice(index, 1);
  saveCartToStorage();
  renderCart();
  if (removed) showToast(`تم حذف "${removed.product.name}" من السلة`);
}

function renderCart() {
  const badgeCount = document.getElementById('cartBadgeCount');
  const totalItemsCount = document.getElementById('cartTotalItems');
  const cartList = document.getElementById('cartItemsList');
  const subtotalEl = document.getElementById('cartSubtotal');
  const discountEl = document.getElementById('cartDiscount');
  const totalFinalEl = document.getElementById('cartTotalFinal');

  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  if (badgeCount) badgeCount.textContent = totalQty;
  if (totalItemsCount) totalItemsCount.textContent = totalQty;

  if (!cartList) return;

  if (cart.length === 0) {
    cartList.innerHTML = `
      <div style="text-align:center; padding: 45px 10px; color: var(--text-dim);">
        <div style="width:70px; height:70px; border-radius:50%; background:rgba(14,165,233,0.1); border:1px solid rgba(56,189,248,0.3); display:flex; align-items:center; justify-content:center; margin:0 auto 16px auto;">
          <i class="fa-solid fa-basket-shopping" style="font-size: 2rem; color: var(--cyan-primary);"></i>
        </div>
        <h3 style="color:#fff; margin-bottom: 6px; font-size:1.1rem;">سلة مشترياتك فارغة</h3>
        <p style="font-size:0.85rem; color:var(--text-muted);">استكشف اشتراكاتنا الرقمية وأضف ما يناسبك الآن!</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = '0 ج.م';
    if (discountEl) discountEl.textContent = '-0 ج.م';
    if (totalFinalEl) totalFinalEl.textContent = '0 ج.م';
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
            <img src="${(window.NexaResolveProductImage ? window.NexaResolveProductImage(item.product) : (item.product.image || item.product.featuredImage)) || 'logos/Activkeyzmainlogo.png'}" alt="${item.product.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/Activkeyzmainlogo.png'">
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

  const discountLine = document.getElementById('cartDiscountLine');
  const discountLabel = document.getElementById('cartDiscountLabel');
  const promoPct = Number(window.storeGlobalDiscountPct) || 0;
  const discountEgp = promoPct > 0 ? Math.round(subtotalEgp * (promoPct / 100)) : 0;
  const finalTotalEgp = Math.max(0, subtotalEgp - discountEgp);
  const finalTotalUsd = (subtotalUsd * (1 - (promoPct / 100))).toFixed(2);

  if (subtotalEl) subtotalEl.textContent = `${subtotalEgp.toLocaleString()} ج.م`;
  if (discountLine) {
    if (discountEgp > 0) {
      discountLine.style.display = 'flex';
      if (discountLabel) discountLabel.textContent = `خصم العرض (${promoPct}%):`;
      if (discountEl) discountEl.textContent = `-${discountEgp.toLocaleString()} ج.م`;
    } else {
      discountLine.style.display = 'none';
    }
  }
  if (totalFinalEl) totalFinalEl.textContent = `${finalTotalEgp.toLocaleString()} ج.م ($${finalTotalUsd})`;
}

// Cart Drawer Handlers
const cartBtn = document.getElementById('cartBtn');
if (cartBtn) {
  cartBtn.addEventListener('click', () => {
    document.getElementById('cartDrawer')?.classList.add('active');
    document.getElementById('cartOverlay')?.classList.add('active');
    document.body.classList.add('cart-drawer-open');
  });
}

function closeCartDrawer() {
  document.getElementById('cartDrawer')?.classList.remove('active');
  document.getElementById('cartOverlay')?.classList.remove('active');
  document.body.classList.remove('cart-drawer-open');
}

// Toast Notifications
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

// Search Suggestions
function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const suggestionsBox = document.getElementById('searchSuggestions');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

    if (!val) {
      if (suggestionsBox) suggestionsBox.style.display = 'none';
      return;
    }

    const all = window.NexaDB ? window.NexaDB.getAll() : [];
    const matches = all.filter(p => 
      p.name.toLowerCase().includes(val) || 
      (p.desc && p.desc.toLowerCase().includes(val)) ||
      (p.catName && p.catName.toLowerCase().includes(val))
    );

    if (suggestionsBox) {
      if (matches.length > 0) {
        suggestionsBox.innerHTML = matches.slice(0, 6).map(p => `
          <div class="search-suggestion-item" onclick="window.location.href='product.html?id=' + encodeURIComponent('${p.id}');">
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

// Countdown Timer
function initCountdownTimer() {
  let hours = 17, minutes = 59, seconds = 23;
  const hEl = document.getElementById('hoursVal');
  const mEl = document.getElementById('minutesVal');
  const sEl = document.getElementById('secondsVal');

  setInterval(() => {
    seconds--;
    if (seconds < 0) {
      seconds = 59;
      minutes--;
      if (minutes < 0) {
        minutes = 59;
        hours--;
        if (hours < 0) hours = 23;
      }
    }
    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
    if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
    if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
  }, 1000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Mobile Drawer Listeners
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

  window.addEventListener('nexa-currency-changed', () => {
    if (typeof updateDynamicPrice === 'function') updateDynamicPrice();
  });
});

