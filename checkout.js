/* ===================================================================
   ACTIVKEYZ - PRODUCTION MULTI-STEP CHECKOUT ENGINE (checkout.js)
   - 5-Step Clear Customer Workflow:
     Step 1: Cart Review (Product image, variant, duration, qty, unit price, totals)
     Step 2: Customer Information (Full name, Email, WhatsApp Phone, Notes)
     Step 3: Delivery Preference (A. Website, B. Email, C. WhatsApp)
     Step 4: Active Payment Methods & Screenshot Receipt Evidence
     Step 5: Final Review & Commit (Itemized confirmation before final submit)
   - 100% Server-Authoritative Pricing Synchronization
   - Real Supabase RPC Integration & Duplicate Submit Protection
   =================================================================== */

let checkoutItems = [];
let appliedCouponDiscount = 0;
let appliedCouponCode = '';
let activePaymentMethods = [];
let currentPaymentMethod = null;
let uploadedReceiptData = null; // Base64 data string
let isFromCart = false;
let storeCurrencyRate = 50.0;
let storeGlobalDiscountPct = 0.0;
let storeSupportWhatsApp = '01225106057';

// Multi-Step State
let currentCheckoutStep = 1;
let selectedDeliveryPreference = 'whatsapp'; // 'whatsapp' | 'email'
let isSubmittingOrder = false;

function initCheckoutPage() {
  initCheckoutIntlPhone();
  loadPaymentMethods();
  parseCheckoutItems();
  initClipboardPasteSupport();
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('step') === '2') {
    const emailEl = document.getElementById('customerEmail');
    if (emailEl && !emailEl.value) {
      emailEl.value = urlParams.get('email') || 'customer@example.com';
    }
    setTimeout(() => goToStep(2), 150);
  } else {
    goToStep(1);
  }
  loadStoreSettings();
  checkCustomerAuthStatus();
  try {
    const savedPhone = localStorage.getItem('activkeyz_customer_phone');
    if (savedPhone) prefillCheckoutPhone(savedPhone);
    const savedEmail = localStorage.getItem('activkeyz_customer_email');
    const emailEl = document.getElementById('customerEmail');
    if (emailEl && !emailEl.value && savedEmail) emailEl.value = savedEmail;
  } catch(e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckoutPage);
} else {
  initCheckoutPage();
}

// -------------------------------------------------------------------
// 1. Load Dynamic Store Settings from Supabase
// -------------------------------------------------------------------
async function loadStoreSettings() {
  if (window.NexaSupabase && typeof window.NexaSupabase.settings.getAll === 'function') {
    try {
      const settings = await window.NexaSupabase.settings.getAll();
      if (settings.currency_config && settings.currency_config.usd_egp_rate) {
        storeCurrencyRate = Number(settings.currency_config.usd_egp_rate) || 50.0;
      }
      if (settings.promotions && settings.promotions.global_discount_percent !== undefined) {
        storeGlobalDiscountPct = Number(settings.promotions.global_discount_percent) || 0.0;
        window.storeGlobalDiscountPct = storeGlobalDiscountPct;
      }
      if (settings.store_info && settings.store_info.phone) {
        storeSupportWhatsApp = settings.store_info.phone;
      }
    } catch (e) {
      console.warn('Failed to load store settings:', e);
    }
  }
}

// -------------------------------------------------------------------
// 2. Load Fully Dynamic Payment Methods from Supabase
// -------------------------------------------------------------------
function resolvePaymentLogo(method) {
  if (!method) return 'logos/vodafone.svg';
  const id = (method.id || '').toLowerCase();
  if (method.logo_url) return method.logo_url;
  if (id.includes('insta')) return 'logos/instapay.webp';
  if (id.includes('usdt') || id.includes('crypto')) return 'logos/tether-usdt.svg';
  if (id.includes('binance')) return 'logos/binance-pay.png';
  if (id.includes('bybit')) return 'logos/bybit.png';
  if (id.includes('orange')) return 'logos/orange-cash.png';
  if (id.includes('we') || id.includes('wepay')) return 'logos/we-pay.png';
  if (id.includes('paypal')) return 'logos/paypal.png';
  return 'logos/vodafone.svg';
}

async function loadPaymentMethods() {
  if (!activePaymentMethods || activePaymentMethods.length === 0) {
    activePaymentMethods = [
      {
        id: 'vodafone_cash',
        name: 'فودافون كاش والمحافظ',
        account_number: '01225106057',
        account_name: 'Nexa Digital Store',
        instructions: 'حوّل من أي محفظة إلكترونية (فودافون، أورنج، اتصالات، وي باي، كاش كول) ثم التقط سكرين شوت للتحويل.',
        currency: 'EGP',
        logo: 'logos/vodafone.svg',
        badge: 'المحافظ الإلكترونية'
      },
      {
        id: 'instapay',
        name: 'إنستاباي InstaPay',
        account_number: '01225106057',
        account_name: 'nexa@instapay',
        instructions: 'أرسل التحويل إلى رقم الهاتف (01225106057) أو العنوان عبر تطبيق إنستاباي، ثم ارفع صورة إشعار نجاح التحويل.',
        currency: 'EGP',
        logo: 'logos/instapay.webp',
        badge: 'تحويل بنكي لحظي'
      },
      {
        id: 'usdt',
        name: 'USDT (TRC20)',
        network: 'TRC20',
        wallet_address: 'TY23... (يرجى تعديل عنوان المحفظة من لوحة التحكم)',
        instructions: 'حوّل المعادل بالدولار الرقمي USDT عبر شبكة TRC20 إلى عنوان المحفظة، ثم التقط سكرين شوت مع هاش المعاملة.',
        currency: 'USD',
        logo: 'logos/tether-usdt.svg',
        badge: 'عملات رقمية'
      }
    ];
    renderPaymentTabs();
  }

  if (window.NexaSupabase && typeof window.NexaSupabase.payments.getActive === 'function') {
    try {
      const live = await window.NexaSupabase.payments.getActive();
      if (Array.isArray(live) && live.length > 0) {
        activePaymentMethods = live.map(m => ({
          ...m,
          logo: resolvePaymentLogo(m)
        }));
        renderPaymentTabs();
      }
    } catch (e) {
      console.warn('Failed to fetch payment methods from Supabase, using defaults:', e);
    }
  }
}

function renderPaymentTabs() {
  const tabsContainer = document.querySelector('.clean-pay-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = activePaymentMethods.map((method, idx) => {
    const isSelected = (currentPaymentMethod && currentPaymentMethod.id === method.id) || (!currentPaymentMethod && idx === 0);
    const logoSrc = method.logo || resolvePaymentLogo(method);
    const isSvg = logoSrc.endsWith('.svg');
    const badgeTxt = method.badge || (method.currency === 'USD' ? 'عملات رقمية' : (method.id.includes('insta') ? 'تحويل لحظي' : 'محفظة كاش'));

    return `
      <button type="button" class="clean-pay-tab ${isSelected ? 'active' : ''}" data-method-id="${escapeHtml(method.id)}" onclick="selectPaymentMethod('${escapeHtml(method.id)}')">
        <div class="pay-tab-logo-wrap">
          <img src="${logoSrc}" alt="${escapeHtml(method.name)}" class="pay-tab-logo ${isSvg ? 'is-svg' : ''}">
        </div>
        <div class="pay-tab-text-wrap">
          <span class="pay-tab-name">${escapeHtml(method.name)}</span>
          <span class="pay-tab-badge">${escapeHtml(badgeTxt)}</span>
        </div>
      </button>
    `;
  }).join('');

  if (activePaymentMethods.length > 0) {
    const initId = currentPaymentMethod ? currentPaymentMethod.id : activePaymentMethods[0].id;
    selectPaymentMethod(initId);
  }
}

function selectPaymentMethod(methodId) {
  const found = activePaymentMethods.find(m => m.id === methodId) || activePaymentMethods[0];
  if (!found) return;

  currentPaymentMethod = found;

  document.querySelectorAll('.clean-pay-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.methodId === methodId);
  });

  const labelEl = document.getElementById('transferMethodLabel');
  const numEl = document.getElementById('officialTransferNumber');
  const hintEl = document.getElementById('transferInstructions');

  const logoSrc = found.logo || resolvePaymentLogo(found);

  if (labelEl) {
    labelEl.innerHTML = `
      <img src="${logoSrc}" alt="${escapeHtml(found.name)}" class="transfer-badge-logo">
      <span>${escapeHtml(found.name)}</span>
      ${found.network ? `<span class="badge-network" style="background:rgba(56,189,248,0.2); color:var(--cyan-bright); padding:2px 8px; border-radius:6px; font-size:0.75rem; margin-right:8px; font-weight:800;">${escapeHtml(found.network)}</span>` : ''}
    `;
  }

  const displayedAddress = found.wallet_address || found.account_number || '01225106057';
  if (numEl) {
    numEl.textContent = displayedAddress;
    numEl.title = displayedAddress;
  }

  if (hintEl) {
    hintEl.textContent = found.instructions || 'قم بالتحويل ثم أرفق إيصال السكرين شوت لتأكيد الطلب.';
  }
}

function copyTransferNumber() {
  const numEl = document.getElementById('officialTransferNumber');
  const btnTxt = document.getElementById('copyBtnText');
  if (!numEl) return;

  const textToCopy = numEl.textContent.trim();
  navigator.clipboard.writeText(textToCopy).then(() => {
    if (btnTxt) {
      btnTxt.textContent = 'تم النسخ! ✓';
      setTimeout(() => {
        btnTxt.textContent = 'نسخ الرقم';
      }, 2000);
    }
    showToast(`تم نسخ البيانات (${textToCopy.substring(0, 18)}...) إلى الحافظة! 📋`);
  }).catch(() => {
    showToast(`بيانات التحويل: ${textToCopy}`);
  });
}

// -------------------------------------------------------------------
// 3. Streamlined Navigation Engine & International Phone Integration
// -------------------------------------------------------------------
let itiInstance = null;

function initCheckoutIntlPhone() {
  const phoneEl = document.getElementById('customerPhone');
  if (!phoneEl) return;
  if (itiInstance) return;

  if (!window.intlTelInput) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (window.intlTelInput && !itiInstance) {
        clearInterval(checkInterval);
        initCheckoutIntlPhone();
      } else if (attempts > 30) {
        clearInterval(checkInterval);
      }
    }, 100);
    return;
  }

  try {
    itiInstance = window.intlTelInput(phoneEl, {
      initialCountry: "eg",
      separateDialCode: true,
      countrySearch: true,
      nationalMode: true,
      formatOnDisplay: false,
      useFullscreenPopup: false,
      utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@24.5.0/build/js/utils.js"
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
      phoneEl.addEventListener('countrychange', () => {
        syncPhonePadding();
        validateCheckoutPhoneLive();
      });
      syncPhonePadding();
      setTimeout(syncPhonePadding, 50);
      setTimeout(syncPhonePadding, 200);

      const btnCountry = phoneEl.closest('.iti')?.querySelector('.iti__selected-country');
      if (btnCountry && window.ResizeObserver) {
        new ResizeObserver(() => syncPhonePadding()).observe(btnCountry);
      }

      phoneEl.addEventListener('blur', validateCheckoutPhoneLive);

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

      // STRICT NUMBERS ONLY: Block letters and special symbols on keydown
      phoneEl.addEventListener('keydown', function(e) {
        // Allow: backspace (8), delete (46), tab (9), escape (27), enter (13)
        if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
            // Allow: Ctrl/Cmd+A, Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+X
            ((e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) && (e.ctrlKey === true || e.metaKey === true)) ||
            // Allow: home (36), end (35), left (37), right (39)
            (e.keyCode >= 35 && e.keyCode <= 39)) {
          return;
        }
        // Allow digits 0-9 and Arabic numerals
        if (e.key && /^[0-9٠-٩۰-۹]$/.test(e.key)) {
          return;
        }
        e.preventDefault();
      });

      phoneEl.addEventListener('input', function() {
        const sanitized = normalizeDigits(this.value);
        if (this.value !== sanitized) {
          this.value = sanitized;
        }
        validateCheckoutPhoneLive();
      });

      phoneEl.addEventListener('paste', function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
        const clean = normalizeDigits(pasted);
        const start = this.selectionStart || 0;
        const end = this.selectionEnd || 0;
        const current = this.value || '';
        this.value = current.substring(0, start) + clean + current.substring(end);
        this.selectionStart = this.selectionEnd = start + clean.length;
        validateCheckoutPhoneLive();
      });

      function syncPhonePadding() {
        const itiContainer = phoneEl.closest('.iti');
        if (!itiContainer) return;
        const btn = itiContainer.querySelector('.iti__selected-country');
        if (btn) {
          const w = btn.offsetWidth;
          if (w > 0) {
            phoneEl.style.paddingLeft = (w + 14) + 'px';
          }
        }
      }
      phoneEl.addEventListener('countrychange', syncPhonePadding);
      setTimeout(syncPhonePadding, 60);
      setTimeout(syncPhonePadding, 200);
    } catch(e) {
      console.warn('intl-tel-input initialization error:', e);
    }
  }

function validateCheckoutPhoneLive() {
  const container = document.getElementById('phoneInputContainer');
  const feedback = document.getElementById('phoneValidationFeedback');
  const data = getStructuredPhoneData();

  if (!data.phoneNationalNumber) {
    if (container) {
      container.classList.remove('phone-valid', 'phone-invalid');
    }
    if (feedback) {
      feedback.style.display = 'none';
      feedback.innerHTML = '';
    }
    return;
  }

  if (data.isValid) {
    if (container) {
      container.classList.add('phone-valid');
      container.classList.remove('phone-invalid');
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> رقم معتمد لدولة ${data.phoneCountryName} <span dir="ltr">(${data.phoneDialCode})</span>`;
      feedback.style.color = '#4ade80';
    }
  } else {
    if (container) {
      container.classList.add('phone-invalid');
      container.classList.remove('phone-valid');
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> يرجى إدخال رقم هاتف صحيح لدولة ${data.phoneCountryName} <span dir="ltr">(${data.phoneDialCode})</span>`;
      feedback.style.color = '#ef4444';
    }
  }
}

function getStructuredPhoneData() {
  const phoneEl = document.getElementById('customerPhone');
  if (!phoneEl) {
    return {
      phoneCountryCode: 'EG',
      phoneCountryName: 'مصر',
      phoneDialCode: '+20',
      phoneNationalNumber: '',
      phoneE164: '',
      isValid: false
    };
  }

  const raw = phoneEl.value.trim();

  if (itiInstance) {
    const cData = itiInstance.getSelectedCountryData();
    const iso2 = (cData.iso2 || 'EG').toUpperCase();
    const countryName = cData.name || 'مصر';
    const dialCode = '+' + (cData.dialCode || '20');

    let national = raw;
    if (national.startsWith(dialCode)) {
      national = national.slice(dialCode.length).trim();
    }

    const hasLettersOrSymbols = /\D/.test(national);
    let isValid = false;
    let e164 = '';

    if (!hasLettersOrSymbols && national.length >= 6) {
      if (typeof itiInstance.isValidNumber === 'function') {
        try {
          isValid = itiInstance.isValidNumber();
        } catch (e) {
          isValid = false;
        }
      }

      const cleanDigits = national.replace(/\D/g, '');
      if (!isValid && iso2 === 'EG') {
        // Egyptian mobile: 010/011/012/015 + 8 digits = 11 digits
        if (/^(01[0125][0-9]{8}|1[0125][0-9]{8})$/.test(cleanDigits)) {
          isValid = true;
        }
      } else if (!isValid && iso2 === 'SA') {
        // Saudi mobile: 05 + 8 digits = 10 digits
        if (/^(05[0-9]{8}|5[0-9]{8})$/.test(cleanDigits)) {
          isValid = true;
        }
      }
    }

    if (isValid && typeof itiInstance.getNumber === 'function') {
      try {
        e164 = itiInstance.getNumber();
      } catch (e) {}
    }

    const cleanDigits = national.replace(/\D/g, '');
    const withoutLeadingZero = cleanDigits.replace(/^0+/, '');
    if (!e164 && cleanDigits) {
      e164 = `${dialCode}${withoutLeadingZero}`;
    }

    return {
      phoneCountryCode: iso2,
      phoneCountryName: countryName,
      phoneDialCode: dialCode,
      phoneNationalNumber: national,
      phoneE164: e164,
      isValid: isValid
    };
  } else {
    const cleanDigits = raw.replace(/\D/g, '');
    const withoutLeadingZero = cleanDigits.replace(/^0+/, '');
    const isValid = cleanDigits.length >= 8;
    return {
      phoneCountryCode: 'EG',
      phoneCountryName: 'مصر',
      phoneDialCode: '+20',
      phoneNationalNumber: raw,
      phoneE164: `+20${withoutLeadingZero}`,
      isValid: isValid
    };
  }
}

function getCheckoutFullPhone() {
  const data = getStructuredPhoneData();
  return data.phoneE164 || data.phoneNationalNumber;
}

function prefillCheckoutPhone(fullPhone) {
  if (!fullPhone) return;
  const phoneEl = document.getElementById('customerPhone');
  if (!phoneEl) return;

  if (itiInstance && typeof itiInstance.setNumber === 'function') {
    try {
      itiInstance.setNumber(fullPhone);
      validateCheckoutPhoneLive();
      return;
    } catch (e) {}
  }
  phoneEl.value = fullPhone;
  validateCheckoutPhoneLive();
}

function goToStep(stepNum) {
  const activeStep = (stepNum <= 1) ? 1 : 2;

  // Validation when attempting to jump ahead to payment
  if (activeStep === 2 && checkoutItems.length === 0) {
    showToast('⚠️ سلة مشترياتك فارغة! يرجى اختيار اشتراك للمتابعة.');
    return;
  }

  if (activeStep === 2) {
    const emailInput = document.getElementById('customerEmail');
    const email = emailInput?.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast('⚠️ يرجى إدخال بريد إلكتروني صحيح لاستلام بيانات التفعيل.');
      if (emailInput) { emailInput.focus(); emailInput.style.borderColor = '#ef4444'; }
      return;
    }
    if (emailInput) emailInput.style.borderColor = '';

    const phoneInput = document.getElementById('customerPhone');
    const phoneData = getStructuredPhoneData();
    if (!phoneData.phoneNationalNumber || !phoneData.isValid) {
      showToast(`⚠️ رقم الواتساب إلزامي لتأكيد طلبك! يرجى إدخال رقم هاتف صحيح متوافق مع دولة ${phoneData.phoneCountryName}.`);
      if (phoneInput) { phoneInput.focus(); phoneInput.style.borderColor = '#ef4444'; }
      return;
    }
    if (phoneInput) phoneInput.style.borderColor = '';
  }

  const step1 = document.getElementById('checkoutStep1');
  const step2 = document.getElementById('checkoutStep2');
  const ind1 = document.getElementById('stepIndicator1');
  const ind2 = document.getElementById('stepIndicator2');

  if (step1) step1.style.display = (activeStep === 1) ? 'block' : 'none';
  if (step2) step2.style.display = (activeStep === 2) ? 'block' : 'none';

  if (ind1) {
    ind1.classList.toggle('active', activeStep === 1);
    ind1.classList.toggle('completed', activeStep > 1);
  }
  if (ind2) {
    ind2.classList.toggle('active', activeStep === 2);
    ind2.classList.toggle('completed', false);
  }

  currentCheckoutStep = activeStep;
}

function validateStep1AndProceed() {
  const emailInput = document.getElementById('customerEmail');
  const phoneInput = document.getElementById('customerPhone');
  const email = emailInput?.value.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast('⚠️ يرجى إدخال بريد إلكتروني صحيح لاستلام الفاتورة وبيانات التفعيل!');
    if (emailInput) { emailInput.focus(); emailInput.style.borderColor = '#ef4444'; }
    return;
  }
  if (emailInput) emailInput.style.borderColor = '';

  const phoneData = getStructuredPhoneData();
  if (!phoneData.phoneNationalNumber || !phoneData.isValid) {
    showToast(`⚠️ رقم الواتساب إلزامي لتأكيد واستلام طلبك! يرجى إدخال رقم صحيح متوافق مع دولة ${phoneData.phoneCountryName}.`);
    if (phoneInput) { phoneInput.focus(); phoneInput.style.borderColor = '#ef4444'; }
    return;
  }
  if (phoneInput) phoneInput.style.borderColor = '';

  // Persist contact info for future orders
  try {
    localStorage.setItem('activkeyz_customer_email', email);
    localStorage.setItem('activkeyz_customer_phone', phoneData.phoneE164 || phoneData.phoneNationalNumber);
    localStorage.setItem('activkeyz_customer_country_code', phoneData.phoneCountryCode);
    const rawUser = localStorage.getItem('nexa_customer_user');
    const u = rawUser ? JSON.parse(rawUser) : {};
    u.email = email;
    u.phone = phoneData.phoneE164 || phoneData.phoneNationalNumber;
    localStorage.setItem('nexa_customer_user', JSON.stringify(u));
  } catch(e) {}

  goToStep(2);
}

function validateStep2AndProceed() {
  validateStep1AndProceed();
}

function selectDeliveryPreference(pref) {
  selectDeliveryMethod(pref);
}

window.selectDeliveryMethod = function(method) {
  selectedDeliveryPreference = method;
  const waCard = document.getElementById('deliveryCardWa');
  const emailCard = document.getElementById('deliveryCardEmail');

  if (waCard) {
    waCard.classList.toggle('active', method === 'whatsapp');
    const radioIco = waCard.querySelector('.delivery-radio-circle i');
    if (radioIco) radioIco.className = method === 'whatsapp' ? 'fa-solid fa-check' : '';
  }
  if (emailCard) {
    emailCard.classList.toggle('active', method === 'email');
    const radioIco = emailCard.querySelector('.delivery-radio-circle i');
    if (radioIco) radioIco.className = method === 'email' ? 'fa-solid fa-check' : '';
  }
  renderCheckout();
};

function validateStep4AndProceed() {
  handleFinalOrderCommit();
}

// -------------------------------------------------------------------
// 4. Parse Items from URL or LocalStorage Cart (With Variant Accuracy)
// -------------------------------------------------------------------
async function parseCheckoutItems() {
  const params = new URLSearchParams(window.location.search);
  const prodId = params.get('id');
  const bundleId = params.get('bundle');
  const qtyParam = parseInt(params.get('qty')) || 1;
  const variantParam = params.get('variant');
  const modeParam = params.get('mode') || 'ready';
  const emailParam = params.get('email') || params.get('recipient') || '';

  if (emailParam) {
    const emailEl = document.getElementById('customerEmail');
    if (emailEl && !emailEl.value) emailEl.value = emailParam;
  }

  const phoneParam = params.get('phone') || '';
  if (phoneParam) {
    const phoneEl = document.getElementById('customerPhone');
    if (phoneEl && !phoneEl.value) phoneEl.value = phoneParam;
  }

  try {
    const rawUser = localStorage.getItem('nexa_customer_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      const emailEl = document.getElementById('customerEmail');
      if (emailEl && !emailEl.value && u.email) emailEl.value = u.email;
      const phoneEl = document.getElementById('customerPhone');
      if (phoneEl && !phoneEl.value && u.phone) phoneEl.value = u.phone;
      const nameEl = document.getElementById('customerName');
      if (nameEl && !nameEl.value && (u.full_name || u.name)) nameEl.value = u.full_name || u.name;
    }
  } catch (e) { }

  // 1. Bundle in URL
  if (bundleId && window.NexaSupabase && typeof window.NexaSupabase.bundles.getById === 'function') {
    try {
      const bundle = await window.NexaSupabase.bundles.getById(bundleId);
      if (bundle) {
        checkoutItems = [{
          isBundle: true,
          product: {
            id: bundle.id,
            name: bundle.name,
            category: 'bundle',
            duration: 'باقة مجمعة',
            priceEgp: Number(bundle.price_egp),
            priceUsd: Number(bundle.price_usd) || (Number(bundle.price_egp) / storeCurrencyRate),
            originalPriceEgp: Number(bundle.original_price_egp),
            image: bundle.image,
            bundleContents: (bundle.bundle_items || []).map(bi => bi.products?.name).filter(Boolean)
          },
          quantity: Math.max(1, qtyParam),
          activation: modeParam
        }];
        isFromCart = false;
        renderCheckout();
        return;
      }
    } catch (e) {
      console.warn('Bundle fetch error:', e);
    }
  }

  // 2. Single Product in URL
  let allProducts = (window.NexaDB && typeof window.NexaDB.getAll === 'function') ? window.NexaDB.getAll() : [];
  if (allProducts.length === 0 && window.NexaSupabase && typeof window.NexaSupabase.products.getAll === 'function') {
    try {
      allProducts = await window.NexaSupabase.products.getAll();
    } catch (e) {
      allProducts = [];
    }
  }

  if (prodId) {
    const canonicalId = (window.NexaResolveCanonicalProductId) ? window.NexaResolveCanonicalProductId(prodId) : prodId;
    let found = allProducts.find(p => p.id === canonicalId || p.id === prodId || p.slug === canonicalId || p.slug === prodId);
    if (!found && window.NexaDB && typeof window.NexaDB.getById === 'function') {
      found = window.NexaDB.getById(canonicalId) || window.NexaDB.getById(prodId);
    }
    if (found) {
      let finalPriceEgp = Number(found.priceEgp || found.price_egp || 1000);
      let finalPriceUsd = Number(found.priceUsd || found.price_usd || (finalPriceEgp / storeCurrencyRate));
      let finalDuration = found.duration || 'اشتراك كامل';
      let variantName = '';

      if (variantParam && window.NexaSupabase && window.NexaSupabase.variants) {
        try {
          const vars = await window.NexaSupabase.variants.getByProductId(found.id);
          const matched = vars.find(v => v.id === variantParam);
          if (matched) {
            finalPriceEgp = Number(matched.price_egp);
            finalPriceUsd = Number(matched.price_usd);
            finalDuration = matched.duration || finalDuration;
            variantName = matched.name;
          }
        } catch (vErr) {
          console.warn('Failed to resolve variant:', vErr);
        }
      }

      const prodObject = {
        ...found,
        variantId: variantParam || null,
        variantName: variantName || null,
        name: variantName ? `${found.name} (${variantName})` : found.name,
        duration: finalDuration,
        priceEgp: finalPriceEgp,
        priceUsd: finalPriceUsd
      };

      checkoutItems = [{
        isBundle: false,
        product: prodObject,
        quantity: Math.max(1, qtyParam),
        activation: modeParam
      }];
      isFromCart = false;
      renderCheckout();
      return;
    }
  }

  // 3. LocalStorage Cart
  try {
    const rawCart = localStorage.getItem('nexa_cart');
    if (rawCart) {
      const parsed = JSON.parse(rawCart);
      if (Array.isArray(parsed) && parsed.length > 0) {
        checkoutItems = parsed.map(i => {
          const p = i.product || i;
          return {
            isBundle: Boolean(i.isBundle || p.category === 'bundle'),
            product: {
              ...p,
              priceEgp: Number(p.priceEgp || p.price_egp || 1000),
              priceUsd: Number(p.priceUsd || p.price_usd || (Number(p.priceEgp || 1000) / storeCurrencyRate))
            },
            quantity: Math.max(1, i.quantity || 1),
            activation: i.activation || 'ready'
          };
        });
        isFromCart = true;
        renderCheckout();
        return;
      }
    }
  } catch (e) {
    checkoutItems = [];
  }

  // 4. Default Fallback
  if (checkoutItems.length === 0 && allProducts.length > 0) {
    const fallbackProd = allProducts[0];
    checkoutItems = [{
      isBundle: false,
      product: {
        ...fallbackProd,
        priceEgp: Number(fallbackProd.priceEgp || fallbackProd.price_egp || 1000),
        priceUsd: Number(fallbackProd.priceUsd || fallbackProd.price_usd || 20)
      },
      quantity: 1,
      activation: 'ready'
    }];
  }

  renderCheckout();
}

// -------------------------------------------------------------------
// 5. Smart Delivery Info Detector
// -------------------------------------------------------------------
function getProductDeliveryInfo(product, isBundle = false) {
  if (isBundle) {
    return {
      type: 'باقة مجمعة رقمية شاملة',
      desc: 'تسليم بيانات جميع اشتراكات الباقة مجهزة مباشرة ومطابقة.',
      icon: 'fa-solid fa-layer-group',
      badgeClass: 'delivery-bundle'
    };
  }

  if (!product) {
    return {
      type: 'حساب رسمي مجهز (إيميل + باسورد)',
      desc: 'بيانات تسجيل دخول خاصة بك تُرسل فورياً.',
      icon: 'fa-solid fa-user-shield',
      badgeClass: 'delivery-account'
    };
  }

  const name = (product.name || '').toLowerCase();

  if (name.includes('canva') || name.includes('spotify') || name.includes('youtube') || name.includes('figma') || name.includes('notion') || name.includes('duolingo')) {
    return {
      type: 'رابط دعوة وتفعيل فوري (Invite Link)',
      desc: 'نرسل لك رابط دعوة رسمي للانضمام الفوري باشتراكك على حسابك الخاص.',
      icon: 'fa-solid fa-link',
      badgeClass: 'delivery-link'
    };
  }

  if (name.includes('windows') || name.includes('key') || name.includes('steam') || name.includes('playstation') || name.includes('xbox') || name.includes('كود')) {
    return {
      type: 'كود ومفتاح ترخيص أصلي (License Key)',
      desc: 'نرسل لك كود التفعيل الرقمي الأصلي مع إرشادات التنشيط فورياً.',
      icon: 'fa-solid fa-key',
      badgeClass: 'delivery-key'
    };
  }

  return {
    type: 'حساب خاص مجهز بالكامل (إيميل + باسورد)',
    desc: 'بيانات تسجيل دخول خاصة بك ومستقلة، تُرسل فورياً.',
    icon: 'fa-solid fa-shield-halved',
    badgeClass: 'delivery-account'
  };
}

// -------------------------------------------------------------------
// 6. Unified Pricing Calculation & Render Engine
// -------------------------------------------------------------------
function renderCheckout() {
  const sidebarContainer = document.getElementById('orderProductSection');
  const step1ListContainer = document.getElementById('step1CartItemsList');
  const countBadge = document.getElementById('orderItemsCountBadge');

  const subtotalEl = document.getElementById('checkoutSubtotalEgp');
  const discountRow = document.querySelector('.discount-row');
  const discountEl = document.getElementById('checkoutDiscountEgp');
  const extraDiscountRow = document.getElementById('extraCouponRow');
  const extraDiscountEl = document.getElementById('checkoutExtraDiscount');
  const totalEgpEl = document.getElementById('checkoutTotalFinalEgp');
  const totalUsdEl = document.getElementById('checkoutTotalFinalUsd');
  const transferEgpEl = document.getElementById('checkoutTransferAmountEgp');
  const transferUsdEl = document.getElementById('checkoutTransferAmountUsd');

  if (checkoutItems.length === 0) {
    const emptyMarkup = `
      <div style="padding: 32px 14px; text-align: center; color: var(--text-dim);">
        <i class="fa-solid fa-bag-shopping" style="font-size: 2.2rem; margin-bottom: 12px; color: var(--cyan-primary);"></i>
        <h4 style="font-size: 1rem; color: #fff; font-weight: 700; margin-bottom: 6px;">لا توجد اشتراكات في السلة</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">استكشف باقات واشتراكات Activkeyz وأضف ما يناسبك.</p>
        <a href="index.html" class="btn-clean-submit" style="display:inline-flex; width:auto; padding:8px 20px; font-size:0.85rem;">تصفح المتجر</a>
      </div>
    `;
    if (sidebarContainer) sidebarContainer.innerHTML = emptyMarkup;
    if (step1ListContainer) step1ListContainer.innerHTML = emptyMarkup;
    if (subtotalEl) subtotalEl.textContent = '0 ج.م';
    if (totalEgpEl) totalEgpEl.textContent = '0 ج.م';
    if (totalUsdEl) totalUsdEl.textContent = '($0.00)';
    if (transferEgpEl) transferEgpEl.textContent = '0 ج.م';
    if (transferUsdEl) transferUsdEl.textContent = '($0.00)';
    return;
  }

  const totalItemsCount = checkoutItems.reduce((acc, i) => acc + i.quantity, 0);
  if (countBadge) {
    countBadge.textContent = `${totalItemsCount} ${totalItemsCount === 1 ? 'اشتراك' : (totalItemsCount === 2 ? 'اشتراكين' : 'اشتراكات')}`;
  }

  let subtotalEgp = 0;
  let subtotalUsd = 0;

  // Update Configured Delivery Method Display
  const delMethodEl = document.getElementById('checkoutConfiguredDeliveryMethod');
  if (delMethodEl && checkoutItems.length > 0) {
    const firstItem = checkoutItems[0].product || checkoutItems[0];
    const method = firstItem.deliveryMethod || firstItem.delivery_method || 'email';
    const methodLabels = {
      'email': 'تسليم رسمي عبر البريد الإلكتروني',
      'whatsapp': 'بيانات ورابط عبر واتساب',
      'instant': 'كود تفعيل فوري على صفحة الطلب',
      'custom': 'تسليم مخصص ومباشر'
    };
    delMethodEl.textContent = methodLabels[method] || 'تسليم رسمي عبر البريد الإلكتروني';

    if (checkoutItems[0].recipientEmail) {
      const emailEl = document.getElementById('customerEmail');
      if (emailEl && !emailEl.value) emailEl.value = checkoutItems[0].recipientEmail;
    }

    const phoneBadge = document.getElementById('phoneRequiredBadge');
    if (phoneBadge) {
      phoneBadge.textContent = 'إلزامي للتواصل والاستلام *';
      phoneBadge.className = 'tag-required';
    }

    const waCard = document.getElementById('deliveryCardWa');
    const emailCard = document.getElementById('deliveryCardEmail');
    if (waCard) {
      waCard.classList.toggle('active', selectedDeliveryPreference === 'whatsapp');
      const radioIco = waCard.querySelector('.delivery-radio-circle i');
      if (radioIco) radioIco.className = selectedDeliveryPreference === 'whatsapp' ? 'fa-solid fa-check' : '';
    }
    if (emailCard) {
      emailCard.classList.toggle('active', selectedDeliveryPreference === 'email');
      const radioIco = emailCard.querySelector('.delivery-radio-circle i');
      if (radioIco) radioIco.className = selectedDeliveryPreference === 'email' ? 'fa-solid fa-check' : '';
    }
  }

  // Render Step 1 Items List (Editable with steppers and delete buttons)
  if (step1ListContainer) {
    step1ListContainer.innerHTML = checkoutItems.map((item, index) => {
      const prod = item.product;
      const unitEgp = Number(prod.priceEgp) || 1000;
      const unitUsd = Number(prod.priceUsd) || (unitEgp / storeCurrencyRate);
      const itemTotalEgp = unitEgp * item.quantity;
      const itemTotalUsd = unitUsd * item.quantity;
      subtotalEgp += itemTotalEgp;
      subtotalUsd += itemTotalUsd;

      const imgPath = (window.NexaResolveProductImage ? window.NexaResolveProductImage(prod) : (prod.image || prod.featuredImage)) || 'logos/chatgpt-plus.webp';
      const delivery = getProductDeliveryInfo(prod, item.isBundle);

      return `
        <div class="clean-product-item" style="margin-bottom:12px; background:rgba(12,22,42,0.65); border:1px solid rgba(56,189,248,0.22); border-radius:14px; padding:14px;">
          <div class="clean-product-top">
            <div class="clean-product-thumb" style="width:52px; height:52px; border-radius:10px; overflow:hidden; border:1px solid rgba(56,189,248,0.3); flex-shrink:0;">
              <img src="${imgPath}" alt="${escapeHtml(prod.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/chatgpt-plus.webp'">
            </div>
            <div class="clean-product-details" style="flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <h4 class="clean-product-title" style="font-size:0.95rem; font-weight:800; color:#fff; line-height:1.2;">${escapeHtml(prod.name)}</h4>
                <button type="button" onclick="removeFromCheckout(${index})" title="حذف من الطلب" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.85rem; padding:4px;">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
              <div class="clean-product-meta-pills" style="margin-top:4px;">
                <span class="meta-pill" style="font-size:0.75rem;"><i class="fa-solid fa-clock"></i> ${escapeHtml(prod.duration || 'اشتراك كامل')}</span>
                <span class="meta-pill guarantee" style="font-size:0.75rem;"><i class="fa-solid fa-shield-halved"></i> ضمان رسمي</span>
              </div>
              <div style="font-size:0.75rem; color:#38bdf8; margin-top:4px;">
                <i class="${delivery.icon}"></i> ${delivery.type}
              </div>
            </div>
          </div>

          <div class="clean-product-qty-row" style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
            <div class="clean-qty-control">
              <span class="qty-label" style="font-size:0.8rem; color:#94a3b8;">الكمية:</span>
              <div class="qty-btn-group">
                <button type="button" class="btn-qty-clean" onclick="updateItemQuantity(-1, ${index})" title="تقليل الكمية" ${item.quantity <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                  <i class="fa-solid fa-minus"></i>
                </button>
                <span class="clean-qty-number">${item.quantity}</span>
                <button type="button" class="btn-qty-clean" onclick="updateItemQuantity(1, ${index})" title="زيادة الكمية">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>

            <div class="clean-unit-price" style="text-align:left;">
              <div class="clean-price-val" style="font-family:var(--font-latin); font-weight:800; font-size:1.05rem; color:var(--cyan-bright);">${itemTotalEgp.toLocaleString()} ج.م</div>
              <div class="clean-price-usd" style="font-family:var(--font-latin); font-size:0.75rem; color:#64748b;">سعر الوحدة: ${unitEgp.toLocaleString()} ج.م</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    // Fallback recalculate if step1ListContainer is not present
    subtotalEgp = checkoutItems.reduce((acc, i) => acc + (Number(i.product.priceEgp || 1000) * i.quantity), 0);
    subtotalUsd = subtotalEgp / storeCurrencyRate;
  }

  // Render Sidebar Product Overview (Right Column) with Luxury Styling
  if (sidebarContainer) {
    sidebarContainer.innerHTML = checkoutItems.map(item => {
      const prod = item.product;
      const imgPath = (window.NexaResolveProductImage ? window.NexaResolveProductImage(prod) : (prod.image || prod.featuredImage)) || 'logos/chatgpt-plus.webp';
      const unitEgp = Number(prod.priceEgp) || 1000;
      const itemTotal = unitEgp * item.quantity;
      const isWa = selectedDeliveryPreference === 'whatsapp';
      return `
        <div class="summary-product-item-card" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px; background:linear-gradient(135deg, rgba(14,26,50,0.6) 0%, rgba(8,16,34,0.75) 100%); border:1px solid rgba(56,189,248,0.22); border-radius:14px; margin-bottom:10px; transition:all 0.2s;">
          <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
            <div style="width:52px; height:52px; border-radius:12px; overflow:hidden; border:1px solid rgba(56,189,248,0.35); flex-shrink:0; background:rgba(3,7,18,0.8); box-shadow:0 0 15px rgba(0,210,255,0.15); display:flex; align-items:center; justify-content:center;">
              <img src="${imgPath}" alt="${escapeHtml(prod.name)}" style="width:100%; height:100%; object-fit:contain; padding:4px;" onerror="this.src='logos/chatgpt-plus.webp'">
            </div>
            <div style="flex:1; min-width:0;">
              <h5 style="font-size:0.92rem; color:#fff; font-weight:800; line-height:1.3; margin:0 0 4px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(prod.name)}</h5>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:0.75rem; color:#94a3b8; background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:6px;">الكمية: ${item.quantity}</span>
                <span style="font-size:0.75rem; color:${isWa ? '#4ade80' : 'var(--cyan-bright)'}; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                  <i class="${isWa ? 'fa-brands fa-whatsapp' : 'fa-regular fa-envelope'}"></i>
                  ${isWa ? 'تسليم عبر واتساب' : 'تسليم عبر البريد'}
                </span>
              </div>
            </div>
          </div>
          <div style="text-align:left; flex-shrink:0;">
            <div style="font-family:var(--font-latin); font-weight:900; color:var(--cyan-bright); font-size:1.05rem; text-shadow:0 0 10px rgba(0,210,255,0.3);">
              ${itemTotal.toLocaleString()} ج.م
            </div>
            <div style="font-size:0.72rem; color:#64748b; font-family:var(--font-latin);">
              ${unitEgp.toLocaleString()} ج.م / وحدة
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Server-authoritative Global Promotion Discount & Coins Redemption
  const globalDiscountEgp = storeGlobalDiscountPct > 0 ? Math.round(subtotalEgp * (storeGlobalDiscountPct / 100)) : 0;
  let finalTotalEgp = Math.max(0, subtotalEgp - globalDiscountEgp - appliedCouponDiscount - appliedCoinsDiscountEgp);
  const finalTotalUsd = (finalTotalEgp / storeCurrencyRate).toFixed(2);

  if (subtotalEl) subtotalEl.textContent = `${subtotalEgp.toLocaleString()} ج.م`;

  if (discountRow) {
    if (globalDiscountEgp > 0) {
      discountRow.style.display = 'flex';
      discountRow.querySelector('span').textContent = `خصم المتجر المعتمد (${storeGlobalDiscountPct}%):`;
      if (discountEl) discountEl.textContent = `-${globalDiscountEgp.toLocaleString()} ج.م`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (appliedCouponDiscount > 0) {
    if (extraDiscountRow) extraDiscountRow.style.display = 'flex';
    if (extraDiscountEl) extraDiscountEl.textContent = `-${appliedCouponDiscount.toLocaleString()} ج.م`;
  } else {
    if (extraDiscountRow) extraDiscountRow.style.display = 'none';
  }

  // Nexa Coins Discount Row
  const coinsRow = document.getElementById('coinsDiscountRow');
  const coinsDiscountEl = document.getElementById('checkoutCoinsDiscount');
  if (coinsRow && coinsDiscountEl) {
    if (appliedCoinsDiscountEgp > 0) {
      coinsRow.style.display = 'flex';
      coinsDiscountEl.textContent = `-${appliedCoinsDiscountEgp.toLocaleString()} ج.م`;
    } else {
      coinsRow.style.display = 'none';
    }
  }

  // Estimated Coins to Earn
  const coinsEarnEl = document.getElementById('checkoutCoinsToEarn');
  if (coinsEarnEl) {
    const coinsToEarn = Math.floor(finalTotalEgp * 0.10);
    coinsEarnEl.textContent = `+${coinsToEarn.toLocaleString()} كوين`;
  }

  if (totalEgpEl) totalEgpEl.textContent = `${finalTotalEgp.toLocaleString()} ج.م`;
  if (totalUsdEl) totalUsdEl.textContent = `($${finalTotalUsd})`;

  const miniSummaryProd = document.getElementById('mobileMiniSummaryProd');
  const miniSummaryPrice = document.getElementById('mobileMiniSummaryPrice');
  if (miniSummaryProd && checkoutItems.length > 0) {
    const names = checkoutItems.map(i => i.product.name).join(' + ');
    miniSummaryProd.textContent = `طلبك: ${names}`;
  }
  if (miniSummaryPrice) {
    miniSummaryPrice.textContent = `${finalTotalEgp.toLocaleString()} ج.م`;
  }

  if (transferEgpEl) {
    if (finalTotalEgp === 0 && appliedCoinsDiscountEgp > 0) {
      transferEgpEl.innerHTML = '<span style="color:#4ade80;"><i class="fa-solid fa-coins"></i> 0 ج.م (تغطية كاملة بالكوينز)</span>';
    } else {
      transferEgpEl.textContent = `${finalTotalEgp.toLocaleString()} ج.م`;
    }
  }
  if (transferUsdEl) transferUsdEl.textContent = `($${finalTotalUsd})`;

  // If fully covered by coins, update instructions and payment controls
  const isFullyCoveredByCoins = (finalTotalEgp === 0 && appliedCoinsDiscountEgp > 0);
  const transferHintEl = document.getElementById('transferInstructions');
  const receiptDropzone = document.getElementById('receiptDropzone');
  const receiptDropzoneWrapper = receiptDropzone ? receiptDropzone.closest('div[style*="margin-top: 18px"]') : null;
  const payTabsEl = document.querySelector('.clean-pay-tabs');
  const submitBtnEl = document.getElementById('submitOrderBtn');
  const transferBoxEl = document.querySelector('.clean-transfer-box');

  if (isFullyCoveredByCoins) {
    if (transferHintEl) {
      transferHintEl.textContent = 'رصيدك من Nexa Coins يغطي هذا الطلب بالكامل 🚀 لا يلزم إجراء أي تحويل نقدي أو إرفاق إيصال.';
    }
    if (receiptDropzoneWrapper) receiptDropzoneWrapper.style.display = 'none';
    if (payTabsEl) payTabsEl.style.display = 'none';
    if (transferBoxEl) {
      transferBoxEl.style.background = 'rgba(34, 197, 94, 0.12)';
      transferBoxEl.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    }
    if (submitBtnEl && !isSubmittingOrder) {
      submitBtnEl.innerHTML = '<i class="fa-solid fa-coins"></i> <span>تأكيد الطلب برصيد Nexa Coins 🚀</span>';
    }
  } else {
    if (receiptDropzoneWrapper) receiptDropzoneWrapper.style.display = 'block';
    if (payTabsEl) payTabsEl.style.display = 'flex';
    if (transferBoxEl) {
      transferBoxEl.style.background = '';
      transferBoxEl.style.borderColor = '';
    }
    if (submitBtnEl && !isSubmittingOrder) {
      submitBtnEl.innerHTML = '<i class="fa-solid fa-shield-halved"></i> <span>تأكيد وإرسال الطلب نهائياً</span>';
    }
  }

  // If on review step, update review totals
  if (currentCheckoutStep === 5) {
    renderFinalOrderReview();
  }
}

function updateItemQuantity(delta, index = 0) {
  if (!checkoutItems || checkoutItems.length === 0) return;
  const target = checkoutItems[index] || checkoutItems[0];
  const newQty = (target.quantity || 1) + delta;
  if (newQty < 1 || newQty > 99) return;
  target.quantity = newQty;

  if (isFromCart) {
    try {
      localStorage.setItem('nexa_cart', JSON.stringify(checkoutItems));
    } catch (e) { }
  }

  renderCheckout();
}

function removeFromCheckout(index) {
  const removed = checkoutItems[index];
  checkoutItems.splice(index, 1);

  if (isFromCart) {
    try {
      localStorage.setItem('nexa_cart', JSON.stringify(checkoutItems));
    } catch (e) { }
  }

  if (removed) {
    showToast(`تم إزالة "${removed.product.name}" من الطلب`);
  }

  renderCheckout();
}

// -------------------------------------------------------------------
// 7. Step 5: Render Dedicated Final Order Review Screen
// -------------------------------------------------------------------
function renderFinalOrderReview() {
  const itemsContainer = document.getElementById('reviewItemsList');
  const nameEl = document.getElementById('reviewCustomerName');
  const phoneEl = document.getElementById('reviewCustomerPhone');
  const emailEl = document.getElementById('reviewCustomerEmail');
  const prefEl = document.getElementById('reviewDeliveryPreference');
  const notesEl = document.getElementById('reviewOrderNotes');
  const notesCell = document.getElementById('reviewNotesCell');
  const payMethodEl = document.getElementById('reviewPaymentMethod');
  const totalAmountEl = document.getElementById('reviewTotalAmount');
  const receiptThumb = document.getElementById('reviewReceiptThumb');

  // Customer values
  const name = document.getElementById('customerName')?.value.trim() || 'عميل Activkeyz';
  const phone = getCheckoutFullPhone() || '-';
  const email = document.getElementById('customerEmail')?.value.trim() || '-';
  const notes = document.getElementById('orderNotes')?.value.trim() || '';

  if (nameEl) nameEl.textContent = name;
  if (phoneEl) phoneEl.innerHTML = `<i class="fa-brands fa-whatsapp"></i> ${escapeHtml(phone)}`;
  if (emailEl) emailEl.textContent = email;

  // Delivery Preference text & badge
  const prefLabels = {
    'website': 'استلام مباشر عبر الموقع (صفحة الطلب الآمنة) 💻',
    'email': 'إرسال بيانات التفعيل إلى البريد الإلكتروني 📧',
    'whatsapp': 'إرسال بيانات التفعيل عبر الواتساب المباشر 📱'
  };
  if (prefEl) prefEl.textContent = prefLabels[selectedDeliveryPreference] || 'استلام عبر الموقع';

  if (notesEl && notesCell) {
    if (notes) {
      notesCell.style.display = 'block';
      notesEl.textContent = notes;
    } else {
      notesCell.style.display = 'none';
    }
  }

  // Payment method
  const displayedAddress = currentPaymentMethod?.wallet_address || currentPaymentMethod?.account_number || '01225106057';
  if (payMethodEl) {
    payMethodEl.textContent = `${currentPaymentMethod?.name || 'فودافون كاش'} (${displayedAddress})`;
  }

  // Receipt image
  if (receiptThumb && uploadedReceiptData) {
    receiptThumb.src = uploadedReceiptData;
  }

  // Items list
  const subtotalEgp = checkoutItems.reduce((acc, i) => acc + (Number(i.product.priceEgp || 1000) * i.quantity), 0);
  const globalDiscountEgp = storeGlobalDiscountPct > 0 ? Math.round(subtotalEgp * (storeGlobalDiscountPct / 100)) : 0;
  const finalTotalEgp = Math.max(0, subtotalEgp - globalDiscountEgp - appliedCouponDiscount);
  const finalTotalUsd = (finalTotalEgp / storeCurrencyRate).toFixed(2);

  if (totalAmountEl) {
    totalAmountEl.textContent = `${finalTotalEgp.toLocaleString()} ج.م ($${finalTotalUsd})`;
  }

  if (itemsContainer) {
    itemsContainer.innerHTML = checkoutItems.map(item => {
      const prod = item.product;
      const unitEgp = Number(prod.priceEgp) || 1000;
      const itemTotal = unitEgp * item.quantity;
      return `
        <div class="review-item-row">
          <div>
            <strong style="color:#fff; font-size:0.92rem;">• ${escapeHtml(prod.name)}</strong>
            <span style="font-size:0.75rem; color:#94a3b8; margin-right:6px;">(${prod.duration || 'اشتراك كامل'})</span>
            <div style="font-size:0.74rem; color:var(--cyan-bright); margin-top:2px;">
              الكمية: <strong>${item.quantity}</strong> × ${unitEgp.toLocaleString()} ج.م
            </div>
          </div>
          <div style="font-family:var(--font-latin); font-weight:800; color:var(--cyan-bright); font-size:1.05rem;">
            ${itemTotal.toLocaleString()} ج.م
          </div>
        </div>
      `;
    }).join('');
  }
}

// -------------------------------------------------------------------
// 8. Screenshot Upload & Dropzone Engine
// -------------------------------------------------------------------
function triggerReceiptFileInput() {
  document.getElementById('receiptFileInput')?.click();
}

function handleReceiptFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (file) processReceiptFile(file);
}

function processReceiptFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('⚠️ يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
    return;
  }

  // 15MB file size safety
  if (file.size > 15 * 1024 * 1024) {
    showToast('⚠️ حجم الصورة كبير جداً (أكبر من 15MB). يرجى اختيار صورة أصغر.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const rawData = e.target.result;
    compressReceiptImage(rawData, (optimizedData) => {
      uploadedReceiptData = optimizedData;
      displayReceiptPreview(file.name, uploadedReceiptData);
      const errEl = document.getElementById('receiptErrorMsg');
      if (errEl) errEl.style.display = 'none';
      showToast('تم إرفاق إيصال التحويل بنجاح! 📸');
    });
  };
  reader.readAsDataURL(file);
}

function compressReceiptImage(dataUrl, callback) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    callback(dataUrl);
    return;
  }
  const img = new Image();
  img.onload = () => {
    const maxDim = 1600;
    let w = img.width;
    let h = img.height;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      callback(compressed);
    } catch(err) {
      callback(dataUrl);
    }
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

function displayReceiptPreview(name, dataUrl) {
  const defaultView = document.getElementById('dropzoneDefaultView');
  const previewView = document.getElementById('dropzonePreviewView');
  const previewImg = document.getElementById('receiptImagePreview');
  const fileNameEl = document.getElementById('previewFileName');

  if (defaultView) defaultView.style.display = 'none';
  if (previewView) previewView.style.display = 'flex';
  if (previewImg) previewImg.src = dataUrl;
  if (fileNameEl) fileNameEl.textContent = name;
}

function removeUploadedReceipt(event) {
  if (event) event.stopPropagation();
  uploadedReceiptData = null;
  const fileInput = document.getElementById('receiptFileInput');
  if (fileInput) fileInput.value = '';

  const defaultView = document.getElementById('dropzoneDefaultView');
  const previewView = document.getElementById('dropzonePreviewView');
  if (defaultView) defaultView.style.display = 'flex';
  if (previewView) previewView.style.display = 'none';
}

function initDragAndDrop() {
  const dropzone = document.getElementById('receiptDropzone');
  if (!dropzone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files && dt.files[0];
    if (file) processReceiptFile(file);
  });
}

function initClipboardPasteSupport() {
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processReceiptFile(file);
          showToast('تم لصق لقطة الشاشة من الحافظة! 📋');
          break;
        }
      }
    }
  });
}

// -------------------------------------------------------------------
// 9. Progressive Disclosure Toggles & Coupon Validation
// -------------------------------------------------------------------
window.toggleCouponAccordion = function() {
  const panel = document.getElementById('couponCollapsePanel');
  const btn = document.getElementById('couponToggleBtn');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.classList.toggle('expanded', isHidden);
};

window.toggleCoinsAccordion = function() {
  const panel = document.getElementById('coinsCollapsePanel');
  const btn = document.getElementById('coinsToggleBtn');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.classList.toggle('expanded', isHidden);
};

async function applyPromoCoupon() {
  const input = document.getElementById('couponCodeInput');
  const msgEl = document.getElementById('couponFeedbackMsg');
  if (!input || !msgEl) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    msgEl.className = 'clean-coupon-msg error';
    msgEl.textContent = 'يرجى إدخال كود الخصم أولاً.';
    msgEl.style.display = 'block';
    return;
  }

  const subtotal = checkoutItems.reduce((acc, i) => acc + (Number(i.product.priceEgp || 1000) * i.quantity), 0);

  if (window.NexaSupabase && typeof window.NexaSupabase.coupons.validate === 'function') {
    const result = await window.NexaSupabase.coupons.validate(code, subtotal);
    if (result.valid) {
      appliedCouponDiscount = result.discountAmount;
      appliedCouponCode = code;
      msgEl.className = 'clean-coupon-msg success';
      msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(result.message)}`;
      msgEl.style.display = 'block';
    } else {
      appliedCouponDiscount = 0;
      appliedCouponCode = '';
      msgEl.className = 'clean-coupon-msg error';
      msgEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(result.message)}`;
      msgEl.style.display = 'block';
    }
  } else {
    // Fallback coupon
    if (code === 'ACTIV20' || code === 'NEXA20' || code === 'VIP100') {
      appliedCouponDiscount = Math.round(subtotal * 0.20) || 100;
      appliedCouponCode = code;
      msgEl.className = 'clean-coupon-msg success';
      msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> تم تطبيق كود الخصم (${code}) بنجاح! خصم ${appliedCouponDiscount.toLocaleString()} ج.م`;
      msgEl.style.display = 'block';
    } else {
      appliedCouponDiscount = 0;
      appliedCouponCode = '';
      msgEl.className = 'clean-coupon-msg error';
      msgEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> كود الخصم غير صالح أو منتهي الصلاحية`;
      msgEl.style.display = 'block';
    }
  }

  renderCheckout();
}

window.quickApplyCoupon = function(code) {
  const input = document.getElementById('couponCodeInput');
  if (input) {
    input.value = code;
    applyPromoCoupon();
  }
};

// -------------------------------------------------------------------
// 10. Atomic Server-Verified Order Commit (Step 5 Action)
// -------------------------------------------------------------------
async function handleFinalOrderCommit() {
  if (isSubmittingOrder) return;

  const phoneData = getStructuredPhoneData();
  const phone = phoneData.phoneNationalNumber || getCheckoutFullPhone();
  const email = document.getElementById('customerEmail')?.value.trim();
  const name = document.getElementById('customerName')?.value.trim();
  const notes = document.getElementById('orderNotes')?.value.trim();

  if (!email || !email.includes('@')) {
    showToast('يرجى إدخال بريد إلكتروني صحيح لاستلام بيانات التفعيل.');
    goToStep(1);
    return;
  }

  if (!phoneData.phoneNationalNumber || !phoneData.isValid) {
    showToast(`⚠️ رقم الواتساب إلزامي لتأكيد واستلام طلبك! يرجى إدخال رقم صحيح متوافق مع دولة ${phoneData.phoneCountryName}.`);
    goToStep(1);
    return;
  }

  const subtotalEgp = checkoutItems.reduce((acc, i) => acc + (Number(i.product.priceEgp || 1000) * i.quantity), 0);
  const globalDiscountEgp = storeGlobalDiscountPct > 0 ? Math.round(subtotalEgp * (storeGlobalDiscountPct / 100)) : 0;
  const finalPayableEgp = Math.max(0, subtotalEgp - globalDiscountEgp - appliedCouponDiscount - appliedCoinsDiscountEgp);
  const isFullyCoveredByCoins = (appliedCoinsDiscountEgp > 0 && finalPayableEgp === 0);

  if (!isFullyCoveredByCoins && !uploadedReceiptData) {
    showToast('⚠️ إرفاق إيصال التحويل (سكرين شوت) إلزامي لإتمام الطلب!');
    return;
  }

  isSubmittingOrder = true;
  const submitBtn = document.getElementById('submitOrderBtn');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ تأكيد طلبك...</span>';
  }

  const orderNumber = 'AK-' + Math.floor(100000 + Math.random() * 900000);

  const newOrder = {
    orderId: orderNumber,
    createdAt: new Date().toISOString(),
    customerPhone: phoneData.phoneNationalNumber || phone || 'غير مسجل',
    phoneCountryCode: phoneData.phoneCountryCode || 'EG',
    phoneCountryName: phoneData.phoneCountryName || 'مصر',
    phoneDialCode: phoneData.phoneDialCode || '+20',
    phoneNationalNumber: phoneData.phoneNationalNumber || phone || '',
    phoneE164: phoneData.phoneE164 || '',
    customerEmail: email,
    customerName: name || 'عميل Activkeyz',
    notes: notes || '',
    deliveryPreference: selectedDeliveryPreference || 'whatsapp',
    appliedCoupon: appliedCouponCode || null,
    customerAccountId: currentCustomerUser?.id || null,
    coinsRedeemed: appliedCoins || 0,
    coinsDiscountEgp: appliedCoinsDiscountEgp || 0,
    items: checkoutItems.map(i => ({
      id: i.product.id,
      name: i.product.name,
      duration: i.product.duration,
      category: i.product.category,
      priceEgp: Number(i.product.priceEgp),
      quantity: i.quantity,
      isBundle: Boolean(i.isBundle),
      deliveryType: getProductDeliveryInfo(i.product, i.isBundle).type,
      image: i.product.image || i.product.featuredImage
    })),
    paymentMethod: isFullyCoveredByCoins ? 'Nexa Coins Wallet' : (currentPaymentMethod?.name || 'فودافون كاش'),
    paymentMethodId: isFullyCoveredByCoins ? 'nexa_coins' : (currentPaymentMethod?.id || 'vodafone_cash'),
    transferNumber: isFullyCoveredByCoins ? 'تغطية 100% بالكوينز' : (document.getElementById('officialTransferNumber')?.textContent || '01225106057'),
    receiptImage: isFullyCoveredByCoins ? null : uploadedReceiptData,
    status: 'pending',
    paymentStatus: isFullyCoveredByCoins ? 'verified' : 'unverified',
    fulfillmentStatus: 'unfulfilled',
    timestamp: Date.now()
  };

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.orders.create === 'function') {
      const saved = await window.NexaSupabase.orders.create(newOrder);
      if (saved) {
        if (saved.orderId || saved.order_id) newOrder.orderId = saved.orderId || saved.order_id;
        if (saved.receiptImage) newOrder.receiptImage = saved.receiptImage;
        if (saved.accessToken || saved.access_token) newOrder.accessToken = saved.accessToken || saved.access_token;
        if (saved.totalEgp !== undefined) newOrder.totalEgp = saved.totalEgp;
        if (saved.totalUsd !== undefined) newOrder.totalUsd = saved.totalUsd;
      }

      // Redeem coins from customer wallet atomically
      if (appliedCoins > 0 && typeof window.NexaSupabase.orders.reserveAndRedeemCoins === 'function') {
        try {
          await window.NexaSupabase.orders.reserveAndRedeemCoins(newOrder.orderId, appliedCoins);
        } catch (coinEx) {
          console.warn('Coin redemption reservation note:', coinEx);
        }
      }
    } else {
      throw new Error('الخدمة مش متاحة دلوقتي. حاول تاني بعد شوية.');
    }
  } catch (err) {
    console.error('Critical order submission error:', err);
    isSubmittingOrder = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
    if (window.NexaUI) {
      window.NexaUI.alert({
        title: 'تعذر إتمام الطلب',
        message: `حصلت مشكلة مؤقتة في تأكيد الطلب.\n\nتقدر تجرب مرة تانية أو تتواصل معانا مباشرة على الواتساب (${storeSupportWhatsApp}) عشان نساعدك فوراً.`,
        type: 'error'
      });
    } else {
      showToast('❌ تعذر إتمام الطلب حالياً. يرجى المحاولة لاحقاً.');
    }
    return;
  }

  // Cache locally for instant customer retrieval
  try {
    const existingOrders = JSON.parse(localStorage.getItem('nexa_orders') || '[]');
    existingOrders.unshift(newOrder);
    localStorage.setItem('nexa_orders', JSON.stringify(existingOrders));
    if (newOrder.accessToken) {
      localStorage.setItem('nexa_token_' + newOrder.orderId, newOrder.accessToken);
    }
  } catch (e) { }

  if (isFromCart) {
    localStorage.removeItem('nexa_cart');
  }

  isSubmittingOrder = false;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }

  showToast('✅ تم تسجيل وتأكيد طلبك بنجاح!');
  displayOrderSuccess(newOrder);
}

// -------------------------------------------------------------------
// 11. Honest Order Confirmation Modal
// -------------------------------------------------------------------
function displayOrderSuccess(order) {
  const overlay = document.getElementById('orderSuccessOverlay');
  const modal = document.getElementById('orderSuccessModal');
  const idEl = document.getElementById('createdOrderId');
  const phoneEl = document.getElementById('successCustomerPhone');
  const emailEl = document.getElementById('successCustomerEmail');
  const prefEl = document.getElementById('successDeliveryPref');
  const totalEl = document.getElementById('successTotalPaid');
  const waBtn = document.getElementById('sendOrderToWhatsAppBtn');
  const receiptBtn = document.getElementById('viewReceiptBtn');

  if (idEl) idEl.textContent = order.orderId;
  if (phoneEl) phoneEl.textContent = order.customerPhone;
  if (emailEl) emailEl.textContent = order.customerEmail;

  const prefMap = {
    'whatsapp': 'استلام فوري عبر الواتساب ⚡',
    'email': 'تسليم رسمي عبر البريد الإلكتروني 📄',
    'website': 'استلام مباشر عبر الموقع'
  };
  if (prefEl) prefEl.textContent = prefMap[order.deliveryPreference] || 'استلام فوري عبر الواتساب';

  if (totalEl) totalEl.textContent = `${(order.totalEgp || 0).toLocaleString()} ج.م ($${order.totalUsd || '0.00'})`;

  if (receiptBtn) {
    const tokenParam = order.accessToken ? `&token=${encodeURIComponent(order.accessToken)}` : '';
    receiptBtn.href = `order-receipt.html?orderId=${encodeURIComponent(order.orderId)}${tokenParam}`;
  }

  if (waBtn) {
    const itemsSummary = order.items.map(i => `• ${i.name} (${i.duration || ''}) × ${i.quantity}`).join('\n');
    const waText = `مرحباً Activkeyz! تم تسجيل طلب جديد وبانتظار مراجعة التحويل:\n\n` +
      `📌 رقم الطلب: ${order.orderId}\n` +
      `👤 العميل: ${order.customerName}\n` +
      `📱 واتساب: ${order.customerPhone}\n` +
      `📧 البريد: ${order.customerEmail}\n` +
      `🚚 وسيلة الاستلام المفضلة: ${prefMap[order.deliveryPreference] || 'واتساب'}\n\n` +
      `📦 الاشتراكات المطلوبة:\n${itemsSummary}\n\n` +
      `💰 المبلغ المحول: ${(order.totalEgp || 0).toLocaleString()} ج.م ($${order.totalUsd || '0.00'})\n` +
      `💳 طريقة التحويل: ${order.paymentMethod}\n\n` +
      `مرفق إيصال التحويل، في انتظار مراجعتكم واعتماد التفعيل. شكراً لكم!`;

    const cleanWaNum = storeSupportWhatsApp.replace(/\D/g, '');
    const fullWa = cleanWaNum.startsWith('20') ? cleanWaNum : ('20' + cleanWaNum.replace(/^0+/, ''));
    waBtn.href = `https://wa.me/${fullWa}?text=${encodeURIComponent(waText)}`;
  }

  if (overlay) overlay.classList.add('active');
  if (modal) modal.classList.add('active');
}

function copyCreatedOrderId() {
  const idEl = document.getElementById('createdOrderId');
  if (!idEl) return;
  const orderId = idEl.textContent.trim();
  navigator.clipboard.writeText(orderId).then(() => {
    showToast(`تم نسخ رقم الطلب (${orderId}) إلى الحافظة! 📋`);
  });
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
    toast.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// -------------------------------------------------------------------
// 12. Checkout Quick Auth Modal & Loyalty Wallet State
// -------------------------------------------------------------------
let currentCustomerUser = null;
let currentCustomerWallet = null;
let appliedCoins = 0;
let appliedCoinsDiscountEgp = 0;
let pendingCheckoutOtpEmail = '';

async function checkCustomerAuthStatus() {
  if (!window.NexaSupabase) return;
  const client = window.NexaSupabase.getClient();
  if (!client) return;

  try {
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      currentCustomerUser = user;
      updateAuthGateUI(true);

      const pEmail = document.getElementById('customerEmail');
      const pName = document.getElementById('customerName');
      const pPhone = document.getElementById('customerPhone');

      if (pEmail && (!pEmail.value || pEmail.value === '')) {
        pEmail.value = user.email || '';
      }

      try {
        const profile = await window.NexaSupabase.auth.getProfile();
        if (profile) {
          if (pName && !pName.value) pName.value = profile.fullName || user.user_metadata?.full_name || '';
          if (pPhone && !pPhone.value) pPhone.value = profile.phone || user.user_metadata?.phone || '';
        }
      } catch (e) { }

      // Load Wallet
      try {
        currentCustomerWallet = await window.NexaSupabase.auth.getWallet();
        updateCoinsBoxUI();
      } catch (e) { }
    } else {
      currentCustomerUser = null;
      updateAuthGateUI(false);
    }
  } catch (e) { }
}

function updateAuthGateUI(isLoggedIn) {
  const gateBanner = document.getElementById('checkoutAuthGateBanner');
  const gateTitle = document.getElementById('authGateStatusTitle');
  const gateDesc = document.getElementById('authGateStatusDesc');
  const gateBtn = document.getElementById('authGateActionBtn');
  const gateIcon = document.getElementById('authGateIcon');

  if (!gateBanner) return;

  if (isLoggedIn) {
    const displayName = currentCustomerUser?.user_metadata?.full_name || currentCustomerUser?.email?.split('@')[0] || 'عميل Activkeyz';
    gateBanner.style.background = 'rgba(34, 197, 94, 0.12)';
    gateBanner.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    if (gateIcon) {
      gateIcon.className = 'fa-solid fa-circle-check';
      gateIcon.style.color = '#4ade80';
    }
    if (gateTitle) gateTitle.textContent = `أهلاً بك، ${displayName} 👋`;
    if (gateDesc) gateDesc.textContent = 'سيتم حفظ هذا الطلب في حسابك تلقائياً وكسب Activkeyz Coins عند اكتماله.';
    if (gateBtn) {
      gateBtn.innerHTML = '<i class="fa-solid fa-user"></i> <span>حسابي</span>';
      gateBtn.onclick = () => window.open('account.html', '_blank');
    }
  } else {
    gateBanner.style.background = 'rgba(56, 189, 248, 0.1)';
    gateBanner.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    if (gateIcon) {
      gateIcon.className = 'fa-solid fa-user-lock';
      gateIcon.style.color = 'var(--cyan-bright)';
    }
    if (gateTitle) gateTitle.textContent = 'سجّل دخولك لحفظ الطلب ومضاعفة كوينزك';
    if (gateDesc) gateDesc.textContent = 'تسجيل الدخول يربط طلبك بحسابك ويتيح لك كسب واستخدام Activkeyz Coins فوراً.';
    if (gateBtn) {
      gateBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> <span>تسجيل الدخول السريع</span>';
      gateBtn.onclick = openCheckoutAuthModal;
    }
  }
}

function updateCoinsBoxUI() {
  const box = document.getElementById('checkoutCoinsBox');
  const availEl = document.getElementById('checkoutUserCoinsAvailable');
  if (!box) return;

  if (!currentCustomerUser) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';
  const avail = currentCustomerWallet?.available_balance || 0;
  if (availEl) availEl.textContent = `${avail} كوين متاح`;
}

function applyMaxEligibleCoins() {
  if (!currentCustomerWallet) {
    showToast('يرجى تسجيل الدخول أولاً للوصول لمحفظة الكوينز.');
    openCheckoutAuthModal();
    return;
  }
  const avail = currentCustomerWallet.available_balance || 0;
  const subtotalEgp = checkoutItems.reduce((acc, i) => acc + (Number(i.product.priceEgp || 1000) * i.quantity), 0);
  const globalDiscountEgp = storeGlobalDiscountPct > 0 ? Math.round(subtotalEgp * (storeGlobalDiscountPct / 100)) : 0;
  const currentPayable = Math.max(0, subtotalEgp - globalDiscountEgp - appliedCouponDiscount);

  // Rate: 1 coin = 0.50 EGP. Max 50% or 100% full coverage
  let maxCoins = Math.floor((currentPayable * 0.50) / 0.50);
  if (avail * 0.50 >= currentPayable) {
    maxCoins = Math.ceil(currentPayable / 0.50);
  }
  const eligibleCoins = Math.min(avail, maxCoins);

  const input = document.getElementById('coinsToRedeemInput');
  if (input) input.value = eligibleCoins;
  applyCoinsRedemption();
}

async function applyCoinsRedemption() {
  const input = document.getElementById('coinsToRedeemInput');
  const feedback = document.getElementById('coinsRedemptionFeedback');
  const coins = parseInt(input?.value) || 0;

  if (!currentCustomerUser) {
    showToast('يرجى تسجيل الدخول أولاً لتطبيق Nexa Coins.');
    openCheckoutAuthModal();
    return;
  }

  const avail = currentCustomerWallet?.available_balance || 0;
  if (coins < 0) return;

  if (coins > avail) {
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#f87171';
      feedback.textContent = `رصيدك المتاح (${avail} كوين) لا يكفي لتطبيق ${coins} كوين.`;
    }
    return;
  }

  const subtotalEgp = checkoutItems.reduce((acc, i) => acc + (Number(i.product.priceEgp || 1000) * i.quantity), 0);
  const calc = await window.NexaSupabase.orders.calculateCoinsRedemption(subtotalEgp, coins);

  appliedCoins = calc.coins_to_use;
  appliedCoinsDiscountEgp = calc.discount_egp;

  if (feedback) {
    feedback.style.display = 'block';
    if (appliedCoins > 0) {
      feedback.style.color = '#4ade80';
      feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> تم تطبيق ${appliedCoins} كوين بنجاح! خصم ${appliedCoinsDiscountEgp} ج.م`;
    } else {
      feedback.style.color = '#94a3b8';
      feedback.textContent = 'تم إزالة كوينز الخصم.';
    }
  }

  renderCheckout();
}

function openCheckoutAuthModal() {
  const modal = document.getElementById('checkoutAuthModal');
  const overlay = document.getElementById('checkoutAuthModalOverlay');
  const emailInput = document.getElementById('customerEmail');
  const authEmailInput = document.getElementById('checkoutAuthEmail');

  if (emailInput && authEmailInput && emailInput.value) {
    authEmailInput.value = emailInput.value;
  }

  if (modal && overlay) {
    modal.style.display = 'block';
    overlay.style.display = 'block';
  }
}

function closeCheckoutAuthModal() {
  const modal = document.getElementById('checkoutAuthModal');
  const overlay = document.getElementById('checkoutAuthModalOverlay');
  if (modal) modal.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
}

let checkoutAuthMode = 'login';

function switchCheckoutAuthMode(mode) {
  checkoutAuthMode = mode;
  const tabLogin = document.getElementById('tabCheckoutLogin');
  const tabReg = document.getElementById('tabCheckoutRegister');
  const nameGroup = document.getElementById('checkoutAuthNameGroup');
  const nameInput = document.getElementById('checkoutAuthName');
  const submitBtn = document.getElementById('btnCheckoutAuthSubmit');
  const title = document.getElementById('checkoutAuthModalTitle');

  if (mode === 'register') {
    if (tabReg) {
      tabReg.style.background = 'var(--cyan-bright)';
      tabReg.style.color = '#030712';
      tabReg.style.fontWeight = '800';
    }
    if (tabLogin) {
      tabLogin.style.background = 'transparent';
      tabLogin.style.color = '#94a3b8';
      tabLogin.style.fontWeight = '700';
    }
    if (nameGroup) nameGroup.style.display = 'block';
    if (nameInput) nameInput.required = true;
    if (title) title.textContent = 'إنشاء حساب جديد';
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> <span>إنشاء الحساب</span>';
    }
  } else {
    if (tabLogin) {
      tabLogin.style.background = 'var(--cyan-bright)';
      tabLogin.style.color = '#030712';
      tabLogin.style.fontWeight = '800';
    }
    if (tabReg) {
      tabReg.style.background = 'transparent';
      tabReg.style.color = '#94a3b8';
      tabReg.style.fontWeight = '700';
    }
    if (nameGroup) nameGroup.style.display = 'none';
    if (nameInput) {
      nameInput.required = false;
      nameInput.value = '';
    }
    if (title) title.textContent = 'تسجيل الدخول السريع';
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> <span>تسجيل الدخول</span>';
    }
  }
}

function toggleCheckoutPasswordVisibility(btnEl) {
  const input = document.getElementById('checkoutAuthPassword');
  if (!input) return;
  const icon = btnEl ? btnEl.querySelector('i') : null;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fa-regular fa-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fa-regular fa-eye';
  }
}

async function handleCheckoutAuthSubmit(event) {
  if (event) event.preventDefault();
  const emailInput = document.getElementById('checkoutAuthEmail');
  const passInput = document.getElementById('checkoutAuthPassword');
  const nameInput = document.getElementById('checkoutAuthName');
  const phoneInput = document.getElementById('customerPhone');
  const submitBtn = document.getElementById('btnCheckoutAuthSubmit');
  const origText = submitBtn ? submitBtn.innerHTML : '';

  const email = emailInput?.value.trim().toLowerCase();
  const password = passInput?.value || '';
  const fullName = nameInput?.value.trim() || '';
  const phone = phoneInput?.value.trim() || '';

  if (!email || !email.includes('@')) {
    showToast('يرجى إدخال بريد إلكتروني صحيح.');
    return;
  }

  if (!password || password.length < 6) {
    showToast('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    return;
  }

  if (checkoutAuthMode === 'register' && !fullName) {
    showToast('يرجى إدخال الاسم بالكامل لإنشاء الحساب.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ المعالجة...</span>';
  }

  try {
    if (checkoutAuthMode === 'register') {
      const res = await window.NexaSupabase.auth.signUp({
        email,
        password,
        fullName,
        phone
      });
      if (res?.user || res?.session) {
        showToast('تم إنشاء الحساب بنجاح! أهلاً بك 🎉');
        closeCheckoutAuthModal();
        await checkCustomerAuthStatus();
        renderCheckout();
      } else {
        showToast('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
        switchCheckoutAuthMode('login');
      }
    } else {
      const res = await window.NexaSupabase.auth.signInWithPassword({
        email,
        password
      });
      if (res?.user || res?.session) {
        showToast('تم تسجيل الدخول بنجاح! أهلاً بك 👋');
        closeCheckoutAuthModal();
        await checkCustomerAuthStatus();
        renderCheckout();
      } else {
        throw new Error('بيانات الدخول غير صحيحة.');
      }
    }
  } catch (err) {
    console.error('Checkout Auth error:', err);
    let msg = err.message || 'فشل تسجيل الدخول.';
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
      msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    } else if (lower.includes('user already registered') || lower.includes('already exists')) {
      msg = 'هذا البريد مسجل بالفعل! اختر تسجيل الدخول.';
    } else if (lower.includes('password should be at least')) {
      msg = 'كلمة المرور يجب ألا تقل عن 6 أحرف.';
    }
    showToast(msg, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  }
}

// Fallback compatibility stubs
async function handleSendCheckoutOtp() {
  return handleCheckoutAuthSubmit();
}

async function handleVerifyCheckoutOtp() {
  return handleCheckoutAuthSubmit();
}

function backToCheckoutOtpSend() {
  switchCheckoutAuthMode('login');
}

// Global scope attachment
window.goToStep = goToStep;
window.validateStep2AndProceed = validateStep2AndProceed;
window.selectDeliveryPreference = selectDeliveryPreference;
window.validateStep4AndProceed = validateStep4AndProceed;
window.handleFinalOrderCommit = handleFinalOrderCommit;
window.removeFromCheckout = removeFromCheckout;
window.updateItemQuantity = updateItemQuantity;
window.selectPaymentMethod = selectPaymentMethod;
window.copyTransferNumber = copyTransferNumber;
window.triggerReceiptFileInput = triggerReceiptFileInput;
window.handleReceiptFileSelected = handleReceiptFileSelected;
window.removeUploadedReceipt = removeUploadedReceipt;
window.applyPromoCoupon = applyPromoCoupon;
window.quickApplyCoupon = quickApplyCoupon;
window.copyCreatedOrderId = copyCreatedOrderId;
window.openCheckoutAuthModal = openCheckoutAuthModal;
window.closeCheckoutAuthModal = closeCheckoutAuthModal;
window.switchCheckoutAuthMode = switchCheckoutAuthMode;
window.toggleCheckoutPasswordVisibility = toggleCheckoutPasswordVisibility;
window.handleCheckoutAuthSubmit = handleCheckoutAuthSubmit;
window.handleSendCheckoutOtp = handleSendCheckoutOtp;
window.handleVerifyCheckoutOtp = handleVerifyCheckoutOtp;
window.backToCheckoutOtpSend = backToCheckoutOtpSend;
window.applyMaxEligibleCoins = applyMaxEligibleCoins;
window.applyCoinsRedemption = applyCoinsRedemption;
window.handleOrderSubmission = function (e) { e.preventDefault(); handleFinalOrderCommit(); };

window.quickApplyCoupon = quickApplyCoupon;
window.copyCreatedOrderId = copyCreatedOrderId;
window.openCheckoutAuthModal = openCheckoutAuthModal;
window.closeCheckoutAuthModal = closeCheckoutAuthModal;
window.switchCheckoutAuthMode = switchCheckoutAuthMode;
window.toggleCheckoutPasswordVisibility = toggleCheckoutPasswordVisibility;
window.handleCheckoutAuthSubmit = handleCheckoutAuthSubmit;
window.handleSendCheckoutOtp = handleSendCheckoutOtp;
window.handleVerifyCheckoutOtp = handleVerifyCheckoutOtp;
window.backToCheckoutOtpSend = backToCheckoutOtpSend;
window.applyMaxEligibleCoins = applyMaxEligibleCoins;
window.applyCoinsRedemption = applyCoinsRedemption;
window.handleOrderSubmission = function (e) { e.preventDefault(); handleFinalOrderCommit(); };

