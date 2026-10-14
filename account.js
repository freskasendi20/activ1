/* ===================================================================
   Activkeyz - CUSTOMER ACCOUNT PORTAL CONTROLLER (account.js)
   - Real Supabase Auth (Passwordless Email OTP / Session Persistence)
   - Canonical Customer Identity (auth.uid())
   - 4 Clean Customer Tabs: Overview, Orders, Activkeyz Coins, Profile
   - Graceful Fallback for Pending Loyalty Tables
   - Natural Egyptian Arabic & Zero Technical Jargon in UI
   =================================================================== */

let currentUser = null;
let currentProfile = null;
let currentWallet = null;
let currentOrders = [];
let pendingOtpEmail = '';
let isRegisterMode = false;

document.addEventListener('DOMContentLoaded', () => {
  initAccountPortal();
});

async function initAccountPortal() {
  if (!window.NexaSupabase) {
    setTimeout(initAccountPortal, 100);
    return;
  }

  const loadingEl = document.getElementById('accountLoadingState');

  // Initial check
  const client = window.NexaSupabase.getClient();
  if (client) {
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        currentUser = user;
        if (loadingEl) loadingEl.style.display = 'none';
        await loadAuthenticatedPortal();
        setupAuthListener();
        return;
      }
    } catch (e) {
      console.warn('Initial session check note:', e);
    }
  }

  if (loadingEl) loadingEl.style.display = 'none';
  renderAuthView();
  setupAuthListener();
}

function setupAuthListener() {
  if (window._accountAuthListenerAttached) return;
  window._accountAuthListenerAttached = true;
  if (window.NexaSupabase.auth?.onAuthStateChange) {
    window.NexaSupabase.auth.onAuthStateChange(async (event, session) => {
      const loadingEl = document.getElementById('accountLoadingState');
      if (loadingEl) loadingEl.style.display = 'none';
      if (session?.user) {
        if (!currentUser || currentUser.id !== session.user.id) {
          currentUser = session.user;
          await loadAuthenticatedPortal();
        }
      } else {
        if (currentUser) {
          currentUser = null;
          renderAuthView();
        }
      }
    });
  }
}

// -------------------------------------------------------------------
// 1. Auth View / Mode Switcher
// -------------------------------------------------------------------
function renderAuthView() {
  const loadingEl = document.getElementById('accountLoadingState');
  if (loadingEl) loadingEl.style.display = 'none';
  const authSec = document.getElementById('authSection');
  const portalSec = document.getElementById('portalSection');
  if (authSec) authSec.style.display = 'block';
  if (portalSec) portalSec.style.display = 'none';

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'register') {
    switchAuthMode('register');
  } else {
    switchAuthMode('login');
  }
}
window.renderAuthView = renderAuthView;

function switchAuthMode(mode) {
  isRegisterMode = (mode === 'register');
  const tabLogin = document.getElementById('tabOtpLoginBtn') || document.getElementById('tabLoginBtn');
  const tabReg = document.getElementById('tabRegisterBtn');
  const nameGroup = document.getElementById('fullNameInputGroup');
  const phoneGroup = document.getElementById('phoneInputGroup');
  const passwordHint = document.getElementById('authPasswordHint');
  const submitBtn = document.getElementById('authSubmitBtn');
  const titleEl = document.getElementById('authTitle');
  const subtitleEl = document.getElementById('authSubtitle');
  const toggleHintText = document.getElementById('authToggleHintText');
  const toggleActionBtn = document.getElementById('authToggleActionBtn');
  const nameInput = document.getElementById('authFullName');
  const phoneInput = document.getElementById('authPhone');
  const passInput = document.getElementById('authPassword');

  const errBox = document.getElementById('authInlineError');
  if (errBox) errBox.style.display = 'none';

  if (isRegisterMode) {
    tabReg?.classList.add('active');
    tabLogin?.classList.remove('active');
    if (nameGroup) nameGroup.style.display = 'block';
    if (phoneGroup) phoneGroup.style.display = 'block';
    if (passwordHint) passwordHint.style.display = 'block';
    if (nameInput) nameInput.required = true;
    if (phoneInput) phoneInput.required = true;
    if (passInput) passInput.setAttribute('autocomplete', 'new-password');
    if (titleEl) titleEl.textContent = 'إنشاء حساب جديد';
    if (subtitleEl) subtitleEl.textContent = 'انضم إلى Activkeyz للحصول على نقاط Activkeyz Coins ومتابعة اشتراكاتك فوراً.';
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> <span>إنشاء الحساب</span>';
    }
    if (toggleHintText) toggleHintText.textContent = 'لديك حساب بالفعل؟';
    if (toggleActionBtn) toggleActionBtn.textContent = 'تسجيل الدخول';
  } else {
    tabLogin?.classList.add('active');
    tabReg?.classList.remove('active');
    if (nameGroup) nameGroup.style.display = 'none';
    if (phoneGroup) phoneGroup.style.display = 'none';
    if (passwordHint) passwordHint.style.display = 'none';
    if (nameInput) {
      nameInput.required = false;
      nameInput.value = '';
    }
    if (phoneInput) {
      phoneInput.required = false;
      phoneInput.value = '';
    }
    if (passInput) passInput.setAttribute('autocomplete', 'current-password');
    if (titleEl) titleEl.textContent = 'تسجيل الدخول إلى حسابك';
    if (subtitleEl) subtitleEl.textContent = 'استعرض طلباتك، استلم اشتراكاتك فوراً، وتابع رصيدك من مكافآت Activkeyz Coins.';
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> <span>تسجيل الدخول</span>';
    }
    if (toggleHintText) toggleHintText.textContent = 'ليس لديك حساب بعد؟';
    if (toggleActionBtn) toggleActionBtn.textContent = 'إنشاء حساب جديد';
  }
}

function toggleAuthMode() {
  switchAuthMode(isRegisterMode ? 'login' : 'register');
}

function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btnEl ? btnEl.querySelector('i') : null;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.className = 'fa-regular fa-eye-slash';
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.className = 'fa-regular fa-eye';
    }
  }
}

// Direct Email + Password Form Submission
async function handleAuthSubmit(event) {
  event.preventDefault();
  const errBox = document.getElementById('authInlineError');
  if (errBox) errBox.style.display = 'none';

  const emailInput = document.getElementById('authEmail');
  const passInput = document.getElementById('authPassword');
  const nameInput = document.getElementById('authFullName');
  const phoneInput = document.getElementById('authPhone');
  const submitBtn = document.getElementById('authSubmitBtn');
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';

  const email = emailInput?.value.trim().toLowerCase();
  const password = passInput?.value || '';
  const fullName = nameInput?.value.trim() || '';
function getAuthFullPhone() {
  const codeEl = document.getElementById('authCountryCode');
  const phoneEl = document.getElementById('authPhone');
  if (!phoneEl) return '';
  const raw = phoneEl.value.trim();
  if (!raw) return '';
  const code = codeEl ? codeEl.value : '+20';
  if (raw.startsWith('+')) return raw;
  if (code && raw.startsWith(code.replace('+', ''))) return '+' + raw;
  const digitsOnly = raw.replace(/^0+/, '');
  return code ? `${code}${digitsOnly}` : raw;
}

function getProfileFullPhone() {
  const codeEl = document.getElementById('profileCountryCode');
  const phoneEl = document.getElementById('profilePhone');
  if (!phoneEl) return '';
  const raw = phoneEl.value.trim();
  if (!raw) return '';
  const code = codeEl ? codeEl.value : '+20';
  if (raw.startsWith('+')) return raw;
  if (code && raw.startsWith(code.replace('+', ''))) return '+' + raw;
  const digitsOnly = raw.replace(/^0+/, '');
  return code ? `${code}${digitsOnly}` : raw;
}

function setPhoneWithCountryCode(codeId, phoneId, fullPhone) {
  if (!fullPhone) return;
  const codeEl = document.getElementById(codeId);
  const phoneEl = document.getElementById(phoneId);
  if (!phoneEl) return;
  if (fullPhone.startsWith('+') && codeEl) {
    for (const opt of codeEl.options) {
      if (opt.value && fullPhone.startsWith(opt.value)) {
        codeEl.value = opt.value;
        phoneEl.value = fullPhone.slice(opt.value.length);
        return;
      }
    }
  }
  phoneEl.value = fullPhone;
}

  const phone = getAuthFullPhone();

  if (!email || !email.includes('@')) {
    if (errBox) { errBox.textContent = 'يرجى إدخال بريد إلكتروني صحيح.'; errBox.style.display = 'block'; }
    if (window.NexaUI) window.NexaUI.toast('يرجى إدخال بريد إلكتروني صحيح.', 'warning');
    return;
  }

  if (!password || password.length < 6) {
    if (errBox) { errBox.textContent = 'كلمة المرور يجب ألا تقل عن 6 أحرف.'; errBox.style.display = 'block'; }
    if (window.NexaUI) window.NexaUI.toast('كلمة المرور يجب ألا تقل عن 6 أحرف.', 'warning');
    return;
  }

  if (isRegisterMode && !fullName) {
    if (errBox) { errBox.textContent = 'يرجى إدخال الاسم بالكامل لإنشاء الحساب.'; errBox.style.display = 'block'; }
    if (window.NexaUI) window.NexaUI.toast('يرجى إدخال الاسم بالكامل لإنشاء الحساب.', 'warning');
    nameInput?.focus();
    return;
  }

  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (isRegisterMode && (!cleanPhone || cleanPhone.length < 8)) {
    if (errBox) { errBox.textContent = 'يرجى إدخال رقم واتساب صحيح مع رمز الدولة.'; errBox.style.display = 'block'; }
    if (window.NexaUI) window.NexaUI.toast('رقم الواتساب إلزامي لإنشاء الحساب وتفعيل الاشتراكات.', 'warning');
    phoneInput?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = isRegisterMode
      ? '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ إنشاء الحساب...</span>'
      : '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ تسجيل الدخول...</span>';
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo') || (params.get('from') === 'checkout' ? 'checkout.html' : null);

    if (isRegisterMode) {
      // 1. Create Account via Supabase Auth
      const res = await window.NexaSupabase.auth.signUp({
        email,
        password,
        fullName,
        phone
      });

      if (res?.user || res?.session) {
        currentUser = res.user || res.session?.user;
        if (window.NexaUI) {
          window.NexaUI.toast('تم إنشاء حسابك وتسجيل الدخول بنجاح! أهلاً بك 🎉', 'success');
        }
        if (returnTo) {
          window.location.href = returnTo;
          return;
        }
        await loadAuthenticatedPortal();
      } else {
        if (window.NexaUI) {
          window.NexaUI.toast('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', 'success');
        }
        switchAuthMode('login');
      }
    } else {
      // 2. Sign In via Supabase Auth
      const res = await window.NexaSupabase.auth.signInWithPassword({
        email,
        password
      });

      if (res?.user || res?.session) {
        currentUser = res.user || res.session?.user;
        if (window.NexaUI) {
          window.NexaUI.toast('تم تسجيل الدخول بنجاح! أهلاً بك 👋', 'success');
        }
        if (returnTo) {
          window.location.href = returnTo;
          return;
        }
        await loadAuthenticatedPortal();
      } else {
        throw new Error('بيانات الدخول غير صحيحة.');
      }
    }
  } catch (err) {
    console.error('Auth error:', err);
    let errorMsg = err.message || 'حدث خطأ أثناء المعالجة. حاول مرة ثانية.';
    const lower = errorMsg.toLowerCase();
    if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
      errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التأكد وإعادة المحاولة.';
    } else if (lower.includes('user already registered') || lower.includes('already exists')) {
      errorMsg = 'هذا البريد مسجل بالفعل في المتجر! يمكنك تسجيل الدخول بحسابك.';
    } else if (lower.includes('password should be at least')) {
      errorMsg = 'كلمة المرور يجب ألا تقل عن 6 أحرف.';
    } else if (lower.includes('email not confirmed')) {
      errorMsg = 'يرجى تأكيد بريدك الإلكتروني، أو انتظر لحظات لتعطيل شرط التأكيد من الإعدادات.';
    }

    if (errBox) {
      errBox.textContent = errorMsg;
      errBox.style.display = 'block';
    }
    if (window.NexaUI) {
      window.NexaUI.toast(errorMsg, 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

// Fallback compatibility bridges
async function handleSendOtpSubmit(event) {
  return handleAuthSubmit(event);
}

async function handleVerifyOtpSubmit(event) {
  return handleAuthSubmit(event);
}

function cancelOtpStep() {
  switchAuthMode('login');
}

// -------------------------------------------------------------------
// 2. Authenticated Portal Loader
// -------------------------------------------------------------------
async function loadAuthenticatedPortal() {
  const loadingEl = document.getElementById('accountLoadingState');
  if (loadingEl) loadingEl.style.display = 'none';
  const authSec = document.getElementById('authSection');
  const portalSec = document.getElementById('portalSection');
  if (authSec) authSec.style.display = 'none';
  if (portalSec) portalSec.style.display = 'grid';

  if (!currentUser) return;

  // Load Profile
  try {
    currentProfile = await window.NexaSupabase.auth.getProfile();
  } catch (e) {
    console.warn('Profile load note:', e);
  }

  // Populate Sidebar
  const displayName = currentProfile?.fullName || currentUser.user_metadata?.full_name || (currentUser.email ? currentUser.email.split('@')[0] : 'عميل Activkeyz');
  const userEmail = currentUser.email || '';

  const nameEl = document.getElementById('userDisplayName');
  const emailEl = document.getElementById('userDisplayEmail');
  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = userEmail;

  // Populate Profile Form
  const pEmail = document.getElementById('profileEmail');
  const pName = document.getElementById('profileFullName');
  const pPhone = document.getElementById('profilePhone');
  if (pEmail) pEmail.value = userEmail;
  if (pName) pName.value = currentProfile?.fullName || currentUser.user_metadata?.full_name || '';
  if (pPhone) {
    const rawP = currentProfile?.phone || currentUser.user_metadata?.phone || '';
    setPhoneWithCountryCode('profileCountryCode', 'profilePhone', rawP);
  }

  // Parallel load Wallet and Orders
  await Promise.all([
    loadAccountWallet(),
    loadAccountOrders()
  ]);

  // Check URL tab parameter
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get('tab');
  if (requestedTab && document.getElementById('tab-' + requestedTab)) {
    switchPortalTab(requestedTab);
  }
}

// -------------------------------------------------------------------
// 3. Tab Navigation Controller (4 Simple Tabs)
// -------------------------------------------------------------------
function switchPortalTab(tabName) {
  // Update sidebar buttons
  document.querySelectorAll('.portal-nav-link').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick')?.includes(`'${tabName}'`)) {
      btn.classList.add('active');
    }
  });

  // Switch content panels
  document.querySelectorAll('.portal-tab-content').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById('tab-' + tabName);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  // Update URL query state smoothly without reload
  const url = new URL(window.location);
  url.searchParams.set('tab', tabName);
  window.history.replaceState({}, '', url);
}

// -------------------------------------------------------------------
// 4. Activkeyz Coins Wallet (Graceful Fallback for Pending Migration)
// -------------------------------------------------------------------
async function loadAccountWallet() {
  let isAvailable = false;
  let avail = 0;
  let earned = 0;
  let txs = [];

  if (window.NexaSupabase?.auth?.getWallet) {
    try {
      currentWallet = await window.NexaSupabase.auth.getWallet();
      if (currentWallet && currentWallet.is_available) {
        isAvailable = true;
        avail = currentWallet.available_balance || 0;
        earned = currentWallet.lifetime_earned || 0;
      }
    } catch (err) {
      console.warn('Wallet table query note:', err);
    }
  }

  if (isAvailable && window.NexaSupabase?.auth?.getWalletTransactions) {
    try {
      txs = await window.NexaSupabase.auth.getWalletTransactions();
    } catch (err) {
      console.warn('Wallet transactions query note:', err);
    }
  }

  // Overview widgets
  const dashCoins = document.getElementById('dashCoinsAvailable');
  const dashCoinsVal = document.getElementById('dashCoinsEgpValue');
  const sideCoins = document.getElementById('sidebarCoinsBadge');

  // Wallet tab widgets
  const wAvail = document.getElementById('walletAvailableBalance');
  const wEarned = document.getElementById('walletLifetimeEarned');
  const wEqv = document.getElementById('walletEgpEquivalent');

  if (isAvailable) {
    const egpValue = (avail * 0.50).toFixed(2);
    if (dashCoins) dashCoins.textContent = avail.toLocaleString();
    if (dashCoinsVal) dashCoinsVal.textContent = `يعادل ${egpValue} ج.م خصم`;
    if (sideCoins) sideCoins.textContent = `${avail} كوين`;

    if (wAvail) wAvail.textContent = avail.toLocaleString();
    if (wEarned) wEarned.textContent = `${earned.toLocaleString()} كوين`;
    if (wEqv) wEqv.textContent = `يعادل ${egpValue} ج.م خصم مباشر عند الدفع`;
    renderWalletLedger(txs, true);
  } else {
    // Loyalty migration pending / backend not installed yet
    if (dashCoins) {
      dashCoins.innerHTML = '<span style="font-size:1.05rem; color:#fbbf24; font-weight:800;">قيد التفعيل ⏳</span>';
    }
    if (dashCoinsVal) {
      dashCoinsVal.textContent = 'برنامج المكافآت قيد التجهيز قريباً';
    }
    if (sideCoins) {
      sideCoins.textContent = 'قريباً';
    }

    if (wAvail) {
      wAvail.innerHTML = '<span style="font-size:1.35rem; color:#fbbf24; font-weight:800;">قيد التفعيل قريباً</span>';
    }
    if (wEarned) {
      wEarned.textContent = 'قريباً';
    }
    if (wEqv) {
      wEqv.textContent = 'سيتم تفعيل رصيد الكوينز تلقائياً فور انطلاق البرنامج لجميع الحسابات';
    }
    renderWalletLedger([], false);
  }
}

function renderWalletLedger(txs, isAvailable = true) {
  const tbody = document.getElementById('walletLedgerTbody');
  if (!tbody) return;

  if (!isAvailable) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:32px 14px; color:#94a3b8;">
          <i class="fa-solid fa-hourglass-half" style="font-size:1.8rem; color:#fbbf24; margin-bottom:10px; display:block;"></i>
          <span style="font-weight:700; color:#fff; display:block; margin-bottom:4px;">برنامج المكافآت Activkeyz Coins قيد التجهيز</span>
          <span>جاري تجهيز نظام النقاط والمكافآت، وسيتم إتاحته لجميع العملاء تلقائياً قريباً.</span>
        </td>
      </tr>
    `;
    return;
  }

  if (!txs || txs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding:28px 12px; color:#94a3b8;">
          <i class="fa-solid fa-coins" style="font-size:1.8rem; color:rgba(251,191,36,0.3); margin-bottom:8px; display:block;"></i>
          لا توجد حركات كوينز مسجلة حتى الآن. ستكسب كوينز تلقائياً مع طلباتك القادمة!
        </td>
      </tr>
    `;
    return;
  }

  const typeLabels = {
    'purchase_reward': 'مكافأة شراء 🎁',
    'redemption_deduction': 'خصم مشتريات 💎',
    'reservation_hold': 'حجز للطلب ⏳',
    'reservation_release': 'إلغاء حجز ↩️',
    'refund_reversal': 'استرداد مكافأة 🔄',
    'admin_adjustment': 'تسوية رصيد 🛡️',
    'promotional_bonus': 'هدية ترويجية ✨'
  };

  tbody.innerHTML = txs.map(t => {
    const isCredit = t.amount > 0;
    const amountColor = isCredit ? '#4ade80' : '#f87171';
    const amountStr = (isCredit ? '+' : '') + t.amount.toLocaleString();
    const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) : 'حديثاً';

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <td style="padding:10px 12px; color:#94a3b8;">${dateStr}</td>
        <td style="padding:10px 12px; font-weight:700;">${typeLabels[t.transaction_type] || 'حركة نقاط'}</td>
        <td style="padding:10px 12px; font-weight:800; color:${amountColor}; font-family:var(--font-latin);">${amountStr} كوين</td>
        <td style="padding:10px 12px; color:#cbd5e1; font-size:0.8rem;">${escapeHtml(t.description || '')}</td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------------
// 5. My Orders Loader
// -------------------------------------------------------------------
async function loadAccountOrders() {
  const client = window.NexaSupabase?.getClient();
  if (!client || !currentUser) return;

  const ordersListEl = document.getElementById('accountOrdersList');
  const recentListEl = document.getElementById('dashRecentOrdersList');
  if (ordersListEl) ordersListEl.innerHTML = '<div style="text-align:center; padding:24px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.6rem; color:var(--cyan-bright);"></i><p style="color:#94a3b8; font-size:0.85rem; margin-top:8px;">جارٍ تحميل طلباتك...</p></div>';

  let serverOrders = [];
  try {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*)')
      .or(`customer_account_id.eq.${currentUser.id},customer_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      serverOrders = data.map(o => ({
        orderId: o.order_id,
        createdAt: o.created_at,
        customerName: o.customer_name,
        totalEgp: Number(o.total_egp),
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        fulfillmentStatus: o.fulfillment_status,
        status: o.status,
        accessToken: o.access_token,
        coinsEarned: o.coins_earned || 0,
        coinsRedeemed: o.coins_redeemed || 0,
        items: (o.order_items || []).map(i => ({
          name: i.name,
          quantity: i.quantity,
          duration: i.duration,
          image: i.image,
          priceEgp: i.price_egp
        }))
      }));
    }
  } catch (err) {
    console.warn('Orders fetch note:', err);
  }

  // Merge with locally cached orders if any
  try {
    const local = JSON.parse(localStorage.getItem('nexa_orders') || '[]');
    const existingIds = new Set(serverOrders.map(o => o.orderId));
    local.forEach(lo => {
      if (lo.orderId && !existingIds.has(lo.orderId)) {
        serverOrders.push(lo);
      }
    });
  } catch (e) {}

  currentOrders = serverOrders;

  // Update counters
  const total = currentOrders.length;
  const countBadge = document.getElementById('ordersCountBadge');
  const dashTotal = document.getElementById('dashTotalOrders');
  if (countBadge) countBadge.textContent = total;
  if (dashTotal) dashTotal.textContent = total;

  // Render lists
  renderOrdersList(ordersListEl, currentOrders);
  renderRecentOrdersList(recentListEl, currentOrders.slice(0, 2));
}

function renderOrdersList(container, orders) {
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <i class="fa-solid fa-receipt empty-icon"></i>
        <h3 class="empty-title">مفيش طلبات عندك لسه</h3>
        <p class="empty-desc">لم تقم بإجراء أي طلبات باستخدام هذا الحساب حتى الآن. استكشف باقات واشتراكات المتجر واطلب الآن!</p>
        <a href="category.html?cat=all" class="btn-view-order">
          <i class="fa-solid fa-bag-shopping"></i> تصفح المنتجات
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(o => renderOrderCardHtml(o)).join('');
}

function renderRecentOrdersList(container, orders) {
  if (!container) return;
  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:18px; color:#94a3b8; font-size:0.85rem;">
        مفيش طلبات مسجلة في حسابك لسه.
      </div>
    `;
    return;
  }
  container.innerHTML = orders.map(o => renderOrderCardHtml(o)).join('');
}

function renderOrderCardHtml(order) {
  const token = localStorage.getItem('nexa_token_' + order.orderId) || order.accessToken || '';
  const targetUrl = `order-receipt.html?orderId=${encodeURIComponent(order.orderId)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : 'حديثاً';

  const firstItem = (order.items && order.items[0]) || { name: 'اشتراك رقمي', duration: 'كامل' };
  const itemsCount = (order.items && order.items.length) || 1;
  const itemsTitle = firstItem.name + (itemsCount > 1 ? ` (+ ${itemsCount - 1} منتجات)` : '');
  const thumbUrl = firstItem.image || (window.NexaResolveProductImage ? window.NexaResolveProductImage(firstItem) : 'logos/chatgpt-plus.webp');

  const isPayVerified = order.paymentStatus === 'verified';
  const payBadge = isPayVerified 
    ? '<span class="order-badge-pill pill-verified"><i class="fa-solid fa-circle-check"></i> الدفع معتمد</span>'
    : '<span class="order-badge-pill pill-unverified"><i class="fa-solid fa-clock"></i> قيد المراجعة</span>';

  const isFulfilled = order.fulfillmentStatus === 'fulfilled';
  const fulBadge = isFulfilled
    ? '<span class="order-badge-pill pill-fulfilled"><i class="fa-solid fa-truck-fast"></i> تم التسليم</span>'
    : '<span class="order-badge-pill pill-unfulfilled"><i class="fa-solid fa-hourglass-half"></i> قيد التجهيز</span>';

  return `
    <div class="order-item-card">
      <div class="order-item-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="order-id-badge">${escapeHtml(order.orderId)}</span>
          <span class="order-date-text"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
        </div>
        <div class="order-badges-group">
          ${payBadge}
          ${fulBadge}
        </div>
      </div>

      <div class="order-item-body">
        <div class="order-products-summary">
          <img src="${escapeHtml(thumbUrl)}" class="order-prod-thumb" alt="${escapeHtml(itemsTitle)}" onerror="this.src='logos/chatgpt-plus.webp'">
          <div class="order-prod-details">
            <span class="order-prod-title">${escapeHtml(itemsTitle)}</span>
            <span class="order-prod-meta">${escapeHtml(firstItem.duration || 'اشتراك كامل')} • وسيلة الدفع: ${escapeHtml(order.paymentMethod || 'محفظة')}</span>
          </div>
        </div>

        <div class="order-item-actions">
          <div class="order-price-display">
            ${(order.totalEgp || 0).toLocaleString()} ج.م
          </div>
          <a href="${targetUrl}" class="btn-view-order">
            <i class="fa-solid fa-key"></i>
            <span>عرض واستلام الطلب</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------------
// 6. Claim Guest Order Action
// -------------------------------------------------------------------
async function handleClaimOrderSubmit(event) {
  event.preventDefault();
  const orderIdInput = document.getElementById('claimOrderId');
  const tokenInput = document.getElementById('claimAccessToken');
  const submitBtn = document.getElementById('claimSubmitBtn');
  const origBtnText = submitBtn ? submitBtn.innerHTML : '';

  const orderId = orderIdInput?.value.trim().toUpperCase();
  const token = tokenInput?.value.trim();

  if (!orderId || !token) {
    if (window.NexaUI) window.NexaUI.toast('يرجى كتابة رقم الطلب ورمز الوصول معاً.', 'warning');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ ربط الطلب...</span>';
  }

  try {
    if (window.NexaSupabase?.auth?.claimGuestOrder) {
      const res = await window.NexaSupabase.auth.claimGuestOrder(orderId, token);
      if (res?.success) {
        if (window.NexaUI) window.NexaUI.toast('تم ربط الطلب بحسابك بنجاح! 🎉', 'success');
        orderIdInput.value = '';
        tokenInput.value = '';
        localStorage.setItem('nexa_token_' + orderId, token);
        await Promise.all([loadAccountOrders(), loadAccountWallet()]);
        switchPortalTab('orders');
      } else {
        throw new Error(res?.message || 'تعذر ربط الطلب. تأكد من البيانات.');
      }
    } else {
      throw new Error('الخدمة مش متاحة دلوقتي. حاول تاني بعد شوية.');
    }
  } catch (err) {
    console.error('Claim order error:', err);
    if (window.NexaUI) {
      window.NexaUI.toast(err.message || 'فشل ربط الطلب. تأكد من رقم الطلب ورمز الوصول.', 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnText;
    }
  }
}

// -------------------------------------------------------------------
// 7. Update Profile Action
// -------------------------------------------------------------------
async function handleUpdateProfile(event) {
  event.preventDefault();
  const nameInput = document.getElementById('profileFullName');
  const phoneInput = document.getElementById('profilePhone');
  const saveBtn = document.getElementById('profileSaveBtn');
  const origBtnText = saveBtn ? saveBtn.innerHTML : '';

  const fullName = nameInput?.value.trim() || '';
  const phone = getProfileFullPhone();

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>جارٍ حفظ التعديلات...</span>';
  }

  try {
    if (phone) localStorage.setItem('activkeyz_customer_phone', phone);
    const rawUser = localStorage.getItem('nexa_customer_user');
    const u = rawUser ? JSON.parse(rawUser) : {};
    if (phone) u.phone = phone;
    if (fullName) u.full_name = fullName;
    localStorage.setItem('nexa_customer_user', JSON.stringify(u));

    if (window.NexaSupabase?.auth?.updateProfile) {
      await window.NexaSupabase.auth.updateProfile({ fullName, phone });
      if (window.NexaUI) window.NexaUI.toast('تم تحديث بياناتك بنجاح! ✅', 'success');
      const nameEl = document.getElementById('userDisplayName');
      if (nameEl && fullName) nameEl.textContent = fullName;
    } else {
      if (window.NexaUI) window.NexaUI.toast('تم حفظ بياناتك بنجاح! ✅', 'success');
    }
  } catch (err) {
    console.error('Update profile error:', err);
    if (window.NexaUI) window.NexaUI.toast('تعذر حفظ البيانات حالياً. جرب مرة تانية.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origBtnText;
    }
  }
}

// -------------------------------------------------------------------
// 8. Logout
// -------------------------------------------------------------------
async function handleLogout() {
  const client = window.NexaSupabase?.getClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {}
  }
  currentUser = null;
  currentProfile = null;
  currentWallet = null;
  currentOrders = [];
  if (window.NexaUI) window.NexaUI.toast('تم تسجيل الخروج بنجاح. نراك قريباً!', 'info');
  renderAuthView();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

// Global scope attachment
window.switchAuthMode = switchAuthMode;
window.toggleAuthMode = toggleAuthMode;
window.handleAuthSubmit = handleAuthSubmit;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleSendOtpSubmit = handleSendOtpSubmit;
window.handleVerifyOtpSubmit = handleVerifyOtpSubmit;
window.cancelOtpStep = cancelOtpStep;
window.switchPortalTab = switchPortalTab;
window.loadAccountOrders = loadAccountOrders;
window.handleClaimOrderSubmit = handleClaimOrderSubmit;
window.handleUpdateProfile = handleUpdateProfile;
window.handleLogout = handleLogout;
