/**
 * ACTIVKEYZ — IN-APP NOTIFICATION & DIALOG SYSTEM (nexa-ui.js)
 * Replaces browser native alert(), confirm(), prompt() with premium
 * cosmic-themed in-app UI toasts, modal confirmations, and prompt dialogs.
 * 
 * Provides:
 * 1. Customer-Friendly Arabic Error Sanitizer (Zero Technical Jargon)
 * 2. Unified Non-Intrusive In-App Toasts & Dialogs
 * 3. Storefront Header Auth & Account Menu Sync
 */
(function() {
  // Auto Clean /index.html and /index from URL address bar for clean GitHub Pages browsing
  if (typeof window !== 'undefined' && window.location) {
    try {
      const pathname = window.location.pathname;
      if (pathname.endsWith('/index.html') || pathname.endsWith('/index')) {
        const cleanPath = pathname.replace(/\/index(\.html)?$/, '/') + window.location.search + window.location.hash;
        window.history.replaceState(null, '', cleanPath);
      }
    } catch (e) {}
  }

  // ===================================================================
  // 1. IN-APP STYLES (Subtle, Premium, Cosmic Theme)
  // ===================================================================
  if (!document.getElementById('nexa-ui-styles')) {
    const style = document.createElement('style');
    style.id = 'nexa-ui-styles';
    style.textContent = `
      /* --- Nexa In-App Toast Container --- */
      #nexaToastContainer {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 92vw;
        width: 420px;
        direction: rtl;
        font-family: 'Cairo', 'Readex Pro', sans-serif;
      }
      .nexa-toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 12px;
        background: rgba(6, 12, 24, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: #f1f5f9;
        font-size: 0.88rem;
        font-weight: 600;
        line-height: 1.45;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 210, 255, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.25);
        transform: translateY(-15px) scale(0.96);
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .nexa-toast.show {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .nexa-toast-icon {
        font-size: 1.15rem;
        flex-shrink: 0;
      }
      .nexa-toast.toast-success {
        border-color: rgba(34, 197, 94, 0.4);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(34, 197, 94, 0.15);
      }
      .nexa-toast.toast-success .nexa-toast-icon { color: #4ade80; }
      
      .nexa-toast.toast-error {
        border-color: rgba(239, 68, 68, 0.35);
        background: rgba(18, 10, 16, 0.96);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(239, 68, 68, 0.12);
      }
      .nexa-toast.toast-error .nexa-toast-icon { color: #f87171; }
      
      .nexa-toast.toast-warning {
        border-color: rgba(245, 158, 11, 0.35);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(245, 158, 11, 0.12);
      }
      .nexa-toast.toast-warning .nexa-toast-icon { color: #fbbf24; }
      
      .nexa-toast.toast-info {
        border-color: rgba(56, 189, 248, 0.35);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(56, 189, 248, 0.15);
      }
      .nexa-toast.toast-info .nexa-toast-icon { color: #38bdf8; }
      
      .nexa-toast-msg {
        flex: 1;
        word-break: break-word;
      }
      .nexa-toast-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s ease;
      }
      .nexa-toast-close:hover { color: #fff; }

      /* --- Nexa In-App Modal Dialog --- */
      #nexaModalOverlay {
        position: fixed;
        inset: 0;
        background: rgba(3, 7, 18, 0.82);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        z-index: 1000000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        direction: rtl;
        font-family: 'Cairo', 'Readex Pro', sans-serif;
        opacity: 0;
        transition: opacity 0.25s ease;
      }
      #nexaModalOverlay.active {
        display: flex;
        opacity: 1;
      }
      .nexa-modal-card {
        background: linear-gradient(145deg, rgba(11, 20, 38, 0.98) 0%, rgba(6, 12, 24, 0.98) 100%);
        border: 1.5px solid rgba(56, 189, 248, 0.3);
        border-radius: 18px;
        width: 100%;
        max-width: 440px;
        padding: 24px 22px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(0, 210, 255, 0.15);
        display: flex;
        flex-direction: column;
        gap: 14px;
        transform: scale(0.94);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #nexaModalOverlay.active .nexa-modal-card {
        transform: scale(1);
      }
      .nexa-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .nexa-modal-icon-orb {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        flex-shrink: 0;
      }
      .nexa-modal-icon-orb.info { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
      .nexa-modal-icon-orb.success { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); }
      .nexa-modal-icon-orb.destructive, .nexa-modal-icon-orb.error { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
      
      .nexa-modal-title {
        font-size: 1.15rem;
        font-weight: 800;
        color: #fff;
        margin: 0;
      }
      .nexa-modal-body {
        font-size: 0.9rem;
        color: #cbd5e1;
        line-height: 1.6;
      }
      .nexa-modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 8px;
      }
      .nexa-modal-btn {
        padding: 9px 18px;
        border-radius: 10px;
        font-family: inherit;
        font-size: 0.88rem;
        font-weight: 800;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .nexa-modal-btn.btn-confirm {
        background: linear-gradient(135deg, #0284c7 0%, #00d2ff 100%);
        color: #030712;
        box-shadow: 0 0 16px rgba(0, 210, 255, 0.3);
      }
      .nexa-modal-btn.btn-confirm:hover {
        transform: translateY(-1px);
        box-shadow: 0 0 22px rgba(0, 210, 255, 0.5);
      }
      .nexa-modal-btn.btn-destructive {
        background: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%);
        color: #fff;
        box-shadow: 0 0 16px rgba(239, 68, 68, 0.3);
      }
      .nexa-modal-btn.btn-destructive:hover {
        transform: translateY(-1px);
        box-shadow: 0 0 22px rgba(239, 68, 68, 0.5);
      }
      .nexa-modal-btn.btn-cancel {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #cbd5e1;
      }
      .nexa-modal-btn.btn-cancel:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  // ===================================================================
  // 2. CUSTOMER-FACING LANGUAGE SANITIZER (ZERO TECHNICAL JARGON)
  // ===================================================================
  const TECHNICAL_ERROR_MAP = [
    { match: /session.*not.*found|auth.*session|no.*session|login.*required|unauthenticated|غير مسجل/i, text: 'سجل دخولك الأول عشان تكمل.' },
    { match: /jwt|token.*expired|session.*expired|انتهت الجلسة/i, text: 'جلستك انتهت. سجل دخولك تاني.' },
    { match: /insufficient.*balance|balance.*too.*low|رصيد.*غير.*كاف|الرصيد لا يكفي/i, text: 'رصيد Nexa Coins مش كافي لإتمام العملية.' },
    { match: /rpc|function.*unavailable|relation.*does.*not.*exist|table.*not.*found|pgrst/i, text: 'الخدمة مش متاحة دلوقتي. حاول تاني بعد شوية.' },
    { match: /network|failed.*to.*fetch|fetch.*error|timeout|econnrefused|connection.*refused/i, text: 'حصلت مشكلة مؤقتة في الاتصال. جرب مرة تانية.' },
    { match: /database|postgres|sql|syntax.*error|query.*failed|قاعدة بيانات|السحابة/i, text: 'حصلت مشكلة مؤقتة. جرب مرة تانية.' },
    { match: /rate.*limit|too.*many.*requests|flood|exceeded/i, text: 'استنى دقيقة وجرب تاني عشان أمان حسابك.' },
    { match: /user.*uuid|uuid.*missing|invalid.*uid|معرف العميل/i, text: 'مش قادرين نفتح حسابك دلوقتي. حاول تاني.' },
    { match: /no.*record|rows.*returned|not.*found|empty.*result|لا توجد صفوف/i, text: 'مفيش طلبات مسجلة عندك لسه.' },
    { match: /invalid.*otp|token.*invalid|verification.*code|رمز التحقق غير/i, text: 'رمز التحقق مش صحيح أو منتهي. اطلب رمز جديد.' }
  ];

  function sanitizeCustomerMessage(errOrMsg, fallback = 'حصلت مشكلة مؤقتة. جرب مرة تانية.') {
    if (!errOrMsg) return fallback;
    const raw = typeof errOrMsg === 'string' ? errOrMsg : (errOrMsg.message || String(errOrMsg));
    
    // Developer log ONLY - keep technical details here
    if (typeof errOrMsg === 'object' && errOrMsg instanceof Error) {
      console.error('[Nexa Developer Error]', errOrMsg);
    } else {
      console.warn('[Nexa Message]', raw);
    }

    for (const rule of TECHNICAL_ERROR_MAP) {
      if (rule.match.test(raw)) {
        return rule.text;
      }
    }

    // Catch any remaining technical keywords
    const hasTechJargon = /supabase|postgres|database|jwt|rpc|uuid|rls|sql|schema|table|relation|json|status.*code|\b40\d\b|\b50\d\b|pgrst|cst_|nxa-usr|سحابة|سحابي|قاعدة بيانات/i.test(raw);
    if (hasTechJargon) {
      return fallback;
    }

    return raw;
  }

  // Ensure DOM containers exist
  function getToastContainer() {
    let c = document.getElementById('nexaToastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'nexaToastContainer';
      document.body.appendChild(c);
    }
    return c;
  }

  function getModalOverlay() {
    let o = document.getElementById('nexaModalOverlay');
    if (!o) {
      o = document.createElement('div');
      o.id = 'nexaModalOverlay';
      o.innerHTML = `
        <div class="nexa-modal-card" role="dialog" aria-modal="true">
          <div class="nexa-modal-header">
            <div class="nexa-modal-icon-orb info" id="nexaModalIcon">
              <i class="fa-solid fa-circle-info"></i>
            </div>
            <h3 class="nexa-modal-title" id="nexaModalTitle">إشعار</h3>
          </div>
          <div class="nexa-modal-body" id="nexaModalMessage"></div>
          <div class="nexa-modal-actions" id="nexaModalActions">
            <button type="button" class="nexa-modal-btn btn-cancel" id="nexaModalBtnCancel">إلغاء</button>
            <button type="button" class="nexa-modal-btn btn-confirm" id="nexaModalBtnConfirm">موافق</button>
          </div>
        </div>
      `;
      document.body.appendChild(o);
    }
    return o;
  }

  // ===================================================================
  // 3. CORE UI METHODS
  // ===================================================================
  const NexaUI = {
    sanitize: sanitizeCustomerMessage,

    toast(message, type = 'info', duration = 3500) {
      const cleanMsg = (type === 'error' || message instanceof Error) 
        ? sanitizeCustomerMessage(message) 
        : (typeof message === 'string' ? sanitizeCustomerMessage(message, message) : 'تم بنجاح');

      const container = getToastContainer();

      // Avoid overlapping: limit active toasts to max 2
      const existing = container.querySelectorAll('.nexa-toast');
      if (existing.length >= 2) {
        existing[0].remove();
      }

      const toast = document.createElement('div');
      toast.className = `nexa-toast toast-${type}`;

      const iconClass = type === 'success' ? 'fa-solid fa-circle-check' :
                        type === 'error' ? 'fa-solid fa-circle-xmark' :
                        type === 'warning' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-info';

      toast.innerHTML = `
        <i class="${iconClass} nexa-toast-icon"></i>
        <div class="nexa-toast-msg">${cleanMsg}</div>
        <button type="button" class="nexa-toast-close" title="إغلاق"><i class="fa-solid fa-xmark"></i></button>
      `;

      container.appendChild(toast);

      requestAnimationFrame(() => toast.classList.add('show'));

      const remove = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
      };

      toast.querySelector('.nexa-toast-close').addEventListener('click', remove);

      if (duration > 0) {
        setTimeout(remove, duration);
      }
      return toast;
    },

    confirm({
      title = 'تأكيد الإجراء',
      message = 'هل أنت متأكد من المتابعة؟',
      confirmText = 'تأكيد',
      cancelText = 'إلغاء',
      isDestructive = false
    } = {}) {
      return new Promise((resolve) => {
        const overlay = getModalOverlay();
        const titleEl = document.getElementById('nexaModalTitle');
        const msgEl = document.getElementById('nexaModalMessage');
        const iconEl = document.getElementById('nexaModalIcon');
        const btnCancel = document.getElementById('nexaModalBtnCancel');
        const btnConfirm = document.getElementById('nexaModalBtnConfirm');

        titleEl.textContent = title;
        msgEl.innerHTML = typeof message === 'string' ? message.replace(/\n/g, '<br/>') : message;

        iconEl.className = `nexa-modal-icon-orb ${isDestructive ? 'destructive' : 'info'}`;
        iconEl.innerHTML = `<i class="fa-solid ${isDestructive ? 'fa-triangle-exclamation' : 'fa-circle-question'}"></i>`;

        btnConfirm.textContent = confirmText;
        btnConfirm.className = `nexa-modal-btn ${isDestructive ? 'btn-destructive' : 'btn-confirm'}`;
        btnCancel.style.display = 'inline-flex';
        btnCancel.textContent = cancelText;

        overlay.classList.add('active');

        const cleanup = () => {
          overlay.classList.remove('active');
          btnConfirm.onclick = null;
          btnCancel.onclick = null;
        };

        btnConfirm.onclick = () => {
          cleanup();
          resolve(true);
        };

        btnCancel.onclick = () => {
          cleanup();
          resolve(false);
        };
      });
    },

    alert(message, type = 'info', title = null) {
      if (typeof message === 'object' && message !== null) {
        title = message.title || title;
        type = message.type || type;
        message = message.message || message;
      }

      const cleanMsg = sanitizeCustomerMessage(message);

      // Short alerts use toasts for minimal disruption
      if (typeof cleanMsg === 'string' && cleanMsg.length < 80 && !cleanMsg.includes('<br')) {
        NexaUI.toast(cleanMsg, type);
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const overlay = getModalOverlay();
        const titleEl = document.getElementById('nexaModalTitle');
        const msgEl = document.getElementById('nexaModalMessage');
        const iconEl = document.getElementById('nexaModalIcon');
        const btnCancel = document.getElementById('nexaModalBtnCancel');
        const btnConfirm = document.getElementById('nexaModalBtnConfirm');

        titleEl.textContent = title || (type === 'error' ? 'تنبيه' : 'إشعار');
        msgEl.innerHTML = typeof cleanMsg === 'string' ? cleanMsg.replace(/\n/g, '<br/>') : cleanMsg;

        iconEl.className = `nexa-modal-icon-orb ${type}`;
        iconEl.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-xmark' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}"></i>`;

        btnConfirm.textContent = 'حسناً، فهمت';
        btnConfirm.className = 'nexa-modal-btn btn-confirm';
        btnCancel.style.display = 'none';

        overlay.classList.add('active');

        const cleanup = () => {
          overlay.classList.remove('active');
          btnConfirm.onclick = null;
        };

        btnConfirm.onclick = () => {
          cleanup();
          resolve();
        };
      });
    },

    // ===================================================================
    // 4. SHARED STOREFRONT HEADER & AUTH CONTROLLER
    // ===================================================================
    async initHeaderAuth() {
      const accountBtn = document.getElementById('accountBtn');
      const accountBtnText = document.getElementById('accountBtnText') || accountBtn?.querySelector('span');
      const userMenuWrapper = document.getElementById('userMenuWrapper');
      const userDropdownMenu = document.getElementById('userDropdownMenu');
      const dropdownUserName = document.getElementById('dropdownUserName');
      const dropdownUserEmail = document.getElementById('dropdownUserEmail');
      const mobileAccountLink = document.getElementById('mobileAccountLink');
      const mobileAccountText = document.getElementById('mobileAccountText');
      const loggedInElements = document.querySelectorAll('.logged-in-only');

      if (!accountBtn && !mobileAccountLink) return;

      let user = null;
      if (window.NexaSupabase && window.NexaSupabase.getClient) {
        try {
          const client = window.NexaSupabase.getClient();
          if (client) {
            const { data } = await client.auth.getUser();
            user = data?.user || null;
          }
        } catch (e) {
          // Silent fallback
        }
      }

      if (user) {
        // --- Authenticated State ---
        const displayName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'حسابي';
        const fullName = user.user_metadata?.full_name || 'عميل Nexa';
        
        if (accountBtnText) accountBtnText.textContent = displayName;
        if (accountBtn) {
          accountBtn.title = 'حسابي والقائمة';
          accountBtn.href = 'account.html';
        }
        
        if (dropdownUserName) dropdownUserName.textContent = fullName;
        if (dropdownUserEmail) dropdownUserEmail.textContent = user.email || '';

        // Mobile drawer updates for authenticated customer
        const mobileUserAuthBox = document.getElementById('mobileUserAuthBox');
        const mobileUserGuestBox = document.getElementById('mobileUserGuestBox');
        const mobileUserName = document.getElementById('mobileUserName');
        const mobileUserEmail = document.getElementById('mobileUserEmail');
        const mobileOrdersCount = document.getElementById('mobileOrdersCount');
        const mobileLogoutWrap = document.getElementById('mobileLogoutWrap');

        if (mobileUserAuthBox) mobileUserAuthBox.style.display = 'block';
        if (mobileUserGuestBox) mobileUserGuestBox.style.display = 'none';
        if (mobileLogoutWrap) mobileLogoutWrap.style.display = 'block';
        if (mobileUserName) mobileUserName.textContent = fullName;
        if (mobileUserEmail) mobileUserEmail.textContent = user.email || '';

        // Check customer orders count
        try {
          const localOrders = JSON.parse(localStorage.getItem('nexa_orders') || '[]');
          const cId = user.id;
          const uEmail = (user.email || '').trim().toLowerCase();
          const userOrders = localOrders.filter(o => 
            (o.customerAccountId && o.customerAccountId === cId) ||
            (o.customerIdentityId && o.customerIdentityId === cId) ||
            (o.customerEmail && o.customerEmail.trim().toLowerCase() === uEmail)
          );
          
          const updateCountUI = (count) => {
            if (mobileOrdersCount) {
              if (count > 0) {
                mobileOrdersCount.textContent = count;
                mobileOrdersCount.style.display = 'inline-block';
              } else {
                mobileOrdersCount.style.display = 'none';
              }
            }
          };

          updateCountUI(userOrders.length);

          if (userOrders.length === 0 && window.NexaSupabase?.orders?.list) {
            window.NexaSupabase.orders.list().then(remoteOrders => {
              if (Array.isArray(remoteOrders)) {
                const rem = remoteOrders.filter(o =>
                  (o.customerAccountId && o.customerAccountId === cId) ||
                  (o.customer_account_id && o.customer_account_id === cId) ||
                  (o.customerEmail && o.customerEmail.trim().toLowerCase() === uEmail) ||
                  (o.customer_email && o.customer_email.trim().toLowerCase() === uEmail)
                );
                if (rem.length > 0) updateCountUI(rem.length);
              }
            }).catch(() => {});
          }
        } catch (e) {}

        if (mobileAccountText) mobileAccountText.textContent = 'حسابي (' + displayName + ')';
        loggedInElements.forEach(el => el.style.display = 'flex');

        // Update footer auth visibility (PRIORITY 3)
        const footerVisitorLinks = document.getElementById('footerVisitorLinks');
        const footerCustomerLinks = document.getElementById('footerCustomerLinks');
        const footerAccountHeading = document.getElementById('footerAccountHeading');
        if (footerVisitorLinks) footerVisitorLinks.style.display = 'none';
        if (footerCustomerLinks) footerCustomerLinks.style.display = 'block';
        if (footerAccountHeading) footerAccountHeading.textContent = 'بوابة حسابي';

        // Toggle dropdown on button click if dropdown exists
        if (userDropdownMenu && accountBtn) {
          accountBtn.onclick = function(e) {
            e.preventDefault();
            userDropdownMenu.classList.toggle('show');
          };

          // Attach outside-click and escape listeners once
          if (!userMenuWrapper._hasAuthMenuListeners) {
            userMenuWrapper._hasAuthMenuListeners = true;
            document.addEventListener('click', function(e) {
              if (userMenuWrapper && !userMenuWrapper.contains(e.target)) {
                userDropdownMenu.classList.remove('show');
              }
            });
            document.addEventListener('keydown', function(e) {
              if (e.key === 'Escape') {
                userDropdownMenu.classList.remove('show');
              }
            });
          }
        }
      } else {
        // --- Logged-Out State ---
        if (accountBtnText) accountBtnText.textContent = 'تسجيل الدخول';
        if (accountBtn) {
          accountBtn.href = 'account.html';
          accountBtn.onclick = null;
        }

        if (userDropdownMenu) userDropdownMenu.classList.remove('show');

        const mobileUserAuthBox = document.getElementById('mobileUserAuthBox');
        const mobileUserGuestBox = document.getElementById('mobileUserGuestBox');
        const mobileLogoutWrap = document.getElementById('mobileLogoutWrap');

        if (mobileUserAuthBox) mobileUserAuthBox.style.display = 'none';
        if (mobileUserGuestBox) mobileUserGuestBox.style.display = 'block';
        if (mobileLogoutWrap) mobileLogoutWrap.style.display = 'none';

        if (mobileAccountText) mobileAccountText.textContent = 'تسجيل الدخول / إنشاء حساب';
        loggedInElements.forEach(el => el.style.display = 'none');

        // Update footer auth visibility (PRIORITY 3)
        const footerVisitorLinks = document.getElementById('footerVisitorLinks');
        const footerCustomerLinks = document.getElementById('footerCustomerLinks');
        const footerAccountHeading = document.getElementById('footerAccountHeading');
        if (footerVisitorLinks) footerVisitorLinks.style.display = 'block';
        if (footerCustomerLinks) footerCustomerLinks.style.display = 'none';
        if (footerAccountHeading) footerAccountHeading.textContent = 'الحساب والخدمات';
      }
    }
  };

  // Global log out action
  window.handleStoreLogout = async function(e) {
    if (e) e.preventDefault();
    try {
      if (window.NexaSupabase?.auth?.signOut) {
        await window.NexaSupabase.auth.signOut();
      } else if (window.NexaSupabase?.getClient) {
        await window.NexaSupabase.getClient().auth.signOut();
      }
    } catch (err) {
      console.warn('Signout note:', err);
    }
    NexaUI.toast('تم تسجيل الخروج بنجاح. مع السلامة!', 'info');
    await NexaUI.initHeaderAuth();
    if (window.location.pathname.includes('account.html')) {
      if (typeof window.renderAuthView === 'function') {
        window.renderAuthView();
      } else {
        window.location.href = 'account.html';
      }
    } else {
      window.location.reload();
    }
  };

  // Global mobile drawer actions
  window.openMobileDrawer = function() {
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');
    const burger = document.getElementById('mobileMenuBtn');
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    if (burger) burger.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  window.closeMobileDrawer = function() {
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');
    const burger = document.getElementById('mobileMenuBtn');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (burger) burger.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  window.toggleMobileDrawer = function(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const drawer = document.getElementById('mobileDrawer');
    if (drawer && drawer.classList.contains('active')) {
      window.closeMobileDrawer();
    } else {
      window.openMobileDrawer();
    }
  };

  // ===================================================================
  // 4. 3D HERO FAN DECK CONTROLLER (INTERACTIVE COVER FLOW & ROTATION)
  // ===================================================================
  function initHeroFanDeck() {
    const stage = document.getElementById('cardsFanStage') || document.querySelector('.cards-fan-stage');
    if (!stage) return;

    const cards = Array.from(stage.querySelectorAll('.fan-card'));
    if (cards.length !== 5) return;

    const POSITIONS = [
      ['card-pos-1'],
      ['card-pos-2'],
      ['card-pos-3', 'active-center'],
      ['card-pos-4'],
      ['card-pos-5']
    ];

    let centerIndex = 2; // AI Card is initially at index 2
    let autoCycleTimer = null;

    function applyPositions() {
      const count = cards.length;
      cards.forEach((card, idx) => {
        card.classList.remove('card-pos-1', 'card-pos-2', 'card-pos-3', 'card-pos-4', 'card-pos-5', 'active-center');

        let offset = (idx - centerIndex) % count;
        if (offset < -Math.floor(count / 2)) offset += count;
        if (offset > Math.floor(count / 2)) offset -= count;

        const slot = offset + 2;
        if (POSITIONS[slot]) {
          card.classList.add(...POSITIONS[slot]);
        }
      });

      // Synchronize glowing LED laser beam circuit on newly active card
      const activeCard = cards[centerIndex];
      if (activeCard) {
        const beam = activeCard.querySelector('.card-led-beam');
        if (beam) {
          beam.style.animation = 'none';
          void beam.offsetWidth;
          beam.style.animation = '';
        }
      }

      syncPills();
    }

    function syncPills() {
      const activeCard = cards[centerIndex];
      if (!activeCard) return;
      const href = activeCard.getAttribute('href') || '';
      const match = href.match(/cat=([a-z0-9_-]+)/i);
      if (match && match[1]) {
        const cat = match[1].toLowerCase();
        const pillMap = {
          'gaming': 'pillGaming',
          'streaming': 'pillStreaming',
          'ai': 'pillAi',
          'creative': 'pillCreative',
          'office': 'pillOffice'
        };
        const targetId = pillMap[cat];
        if (targetId) {
          const pill = document.getElementById(targetId);
          const pillsWrapper = document.querySelector('.pills-row-wrapper');
          if (pill && pillsWrapper && window.innerWidth <= 768) {
            const pRect = pill.getBoundingClientRect();
            const wRect = pillsWrapper.getBoundingClientRect();
            const delta = pRect.left - wRect.left - (wRect.width / 2) + (pRect.width / 2);
            pillsWrapper.scrollBy({ left: delta, behavior: 'smooth' });
          }
        }
      }
    }

    function rotateNext() {
      centerIndex = (centerIndex + 1) % cards.length;
      applyPositions();
    }

    function rotatePrev() {
      centerIndex = (centerIndex - 1 + cards.length) % cards.length;
      applyPositions();
    }

    function setCenter(idx) {
      if (centerIndex === idx) return;
      centerIndex = idx;
      applyPositions();
    }

    function startAuto() {
      stopAuto();
      autoCycleTimer = setInterval(() => {
        rotateNext();
      }, 4000);
    }

    function stopAuto() {
      if (autoCycleTimer) {
        clearInterval(autoCycleTimer);
        autoCycleTimer = null;
      }
    }

    // Interactive Tap on Card
    cards.forEach((card, idx) => {
      card.addEventListener('click', (e) => {
        if (idx !== centerIndex) {
          e.preventDefault();
          setCenter(idx);
          stopAuto();
          setTimeout(startAuto, 8000);
        }
      });
    });

    // Touch Swipe Support on mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchActive = false;

    stage.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isTouchActive = true;
        stopAuto();
      }
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      if (!isTouchActive) return;
      isTouchActive = false;
      if (e.changedTouches && e.changedTouches[0]) {
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX < 0) {
            rotateNext();
          } else {
            rotatePrev();
          }
        }
      }
      setTimeout(startAuto, 8000);
    }, { passive: true });

    // Pause on hover
    stage.addEventListener('mouseenter', stopAuto);
    stage.addEventListener('mouseleave', startAuto);

    applyPositions();
    startAuto();

    window.heroFanDeck = {
      next: rotateNext,
      prev: rotatePrev,
      setCenter: setCenter,
      start: startAuto,
      stop: stopAuto
    };
  }

  // ===================================================================
  // 5. HERO LIVE SOCIAL PROOF ANIMATED COUNTERS (+3200 & +7000)
  // High-fidelity count-up with energetic tactile final jump pop
  // ===================================================================
  function initHeroCounters() {
    const clientsEl = document.getElementById('counterClients');
    const ordersEl = document.getElementById('counterOrders');
    if (!clientsEl || !ordersEl) return;

    let hasRun = false;

    function runCounters() {
      if (hasRun) return;
      hasRun = true;

      const items = [
        { el: clientsEl, target: 3200, duration: 1700 },
        { el: ordersEl, target: 7000, duration: 1950 }
      ];

      items.forEach(({ el, target, duration }) => {
        const startTime = performance.now();

        function step(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Snappy easeOutCubic curve
          const ease = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(ease * target);

          el.textContent = current.toLocaleString('en-US');

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = target.toLocaleString('en-US');
            // Trigger energetic tactile jump on the final count!
            el.classList.remove('jump-pop');
            void el.offsetWidth;
            el.classList.add('jump-pop');
          }
        }

        requestAnimationFrame(step);
      });
    }

    // Run when hero is visible
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          runCounters();
          observer.disconnect();
        }
      }, { threshold: 0.1 });
      const strip = document.getElementById('heroLiveCounters');
      if (strip) {
        observer.observe(strip);
      } else {
        runCounters();
      }
    } else {
      setTimeout(runCounters, 300);
    }
  }

  // ===================================================================
  // 6. GLOBAL MOBILE REAL-TIME SEARCH (CONNECTED TO DATABASE CATALOG)
  // ===================================================================
  function initMobileSearch() {
    const searchInput = document.getElementById('mobileSearchInput');
    const searchBtn = document.getElementById('mobileSearchBtn');
    const clearBtn = document.getElementById('mobileSearchClear');
    const dropdown = document.getElementById('mobileSearchSuggestions');
    const searchRow = document.getElementById('mobileSearchRow');

    if (!searchInput) return;

    window.focusMobileSearch = function(e) {
      if (e) e.preventDefault();
      if (searchRow) {
        searchRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      setTimeout(() => {
        searchInput.focus();
        if (searchInput.value.trim().length > 0) {
          triggerSearch(searchInput.value.trim());
        }
      }, 50);
    };

    if (searchBtn) {
      searchBtn.addEventListener('click', window.focusMobileSearch);
    }

    function getProductsList() {
      if (typeof getCatalog === 'function') {
        const cat = getCatalog();
        if (Array.isArray(cat) && cat.length > 0) return cat;
      }
      if (window.NexaDB && typeof window.NexaDB.getAll === 'function') {
        const all = window.NexaDB.getAll();
        if (Array.isArray(all) && all.length > 0) return all;
      }
      if (Array.isArray(window._localProducts) && window._localProducts.length > 0) {
        return window._localProducts;
      }
      return [];
    }

    function getActiveCurrency() {
      try {
        return localStorage.getItem('nexa_currency') || 'EGP';
      } catch (e) {
        return 'EGP';
      }
    }

    function formatPrice(p, currency) {
      if (currency === 'SAR' && p.priceSar) return `${p.priceSar} ر.س`;
      if (currency === 'USD' && p.priceUsd) return `$${p.priceUsd}`;
      const egp = p.priceEgp || p.price || 0;
      return `${egp} ج.م`;
    }

    function triggerSearch(val) {
      const q = val.trim().toLowerCase();
      if (!dropdown) return;

      if (clearBtn) {
        clearBtn.style.display = q ? 'inline-flex' : 'none';
      }

      if (q.length === 0) {
        dropdown.classList.remove('show');
        dropdown.innerHTML = '';
        return;
      }

      const products = getProductsList();
      const curr = getActiveCurrency();

      const matches = products.filter(p => {
        if (!p) return false;
        if (p.isArchived || p.isActive === false) return false;
        const name = (p.name || p.title || '').toLowerCase();
        const desc = (p.desc || p.description || '').toLowerCase();
        const cat = (p.catName || p.category || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q);
      });

      if (matches.length > 0) {
        const sliced = matches.slice(0, 6);
        let html = sliced.map(p => {
          const img = p.image || p.thumbnail || 'CARD1.jpg';
          const name = p.name || 'منتج رقمي';
          const cat = p.catName || p.category || 'اشتراك رقمي';
          const price = formatPrice(p, curr);
          const clickHandler = `if(typeof openProductModal==='function'){ openProductModal('${p.id}'); document.getElementById('mobileSearchSuggestions').classList.remove('show'); } else { window.location.href='product.html?id=${encodeURIComponent(p.id)}'; }`;
          return `
            <div class="mobile-search-item" onclick="${clickHandler}">
              <img src="${img}" alt="${name}" class="mobile-search-item-img" onerror="this.src='CARD1.jpg'">
              <div class="mobile-search-item-info">
                <span class="mobile-search-item-title">${name}</span>
                <span class="mobile-search-item-cat">${cat}</span>
              </div>
              <span class="mobile-search-item-price">${price}</span>
            </div>
          `;
        }).join('');

        html += `
          <a href="category.html?search=${encodeURIComponent(q)}" class="mobile-search-view-all">
            <i class="fa-solid fa-magnifying-glass"></i>
            <span>عرض جميع نتائج البحث عن "${val}" (${matches.length})</span>
          </a>
        `;
        dropdown.innerHTML = html;
        dropdown.classList.add('show');
      } else {
        dropdown.innerHTML = `
          <div class="mobile-search-empty">
            <i class="fa-solid fa-magnifying-glass" style="margin-bottom:6px; opacity:0.6; font-size:1.2rem;"></i>
            <div>لا توجد نتائج مطابقة لـ "${val}"</div>
            <div style="font-size:0.7rem; color:var(--m-text-muted); margin-top:4px;">جرّب كتابة كلمة بحث أخرى أو تصفح الأقسام</div>
          </div>
        `;
        dropdown.classList.add('show');
      }
    }

    searchInput.addEventListener('input', (e) => {
      triggerSearch(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (val) {
          dropdown.classList.remove('show');
          window.location.href = 'category.html?search=' + encodeURIComponent(val);
        }
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        if (dropdown) {
          dropdown.classList.remove('show');
          dropdown.innerHTML = '';
        }
        searchInput.focus();
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#mobileSearchRow') && !e.target.closest('#mobileSearchBtn') && dropdown) {
        dropdown.classList.remove('show');
      }
    });
  }

  // Global Exports
  window.NexaUI = NexaUI;
  window.ActivKeyzUI = NexaUI;
  window.ActivkeyzUI = NexaUI;
  window.showToast = NexaUI.toast;
  window.showNexaToast = NexaUI.toast;
  window.initHeroFanDeck = initHeroFanDeck;
  window.initHeroCounters = initHeroCounters;
  window.initMobileSearch = initMobileSearch;

  // Auto-init on page load
  document.addEventListener('DOMContentLoaded', () => {
    initHeroFanDeck();
    initHeroCounters();
    initMobileSearch();
    setTimeout(NexaUI.initHeaderAuth, 120);

    // Real-time auth state subscription
    try {
      if (window.NexaSupabase?.auth?.onAuthStateChange) {
        window.NexaSupabase.auth.onAuthStateChange(() => {
          NexaUI.initHeaderAuth();
        });
      }
    } catch (e) {}

    const burger = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('drawerCloseBtn');
    const overlay = document.getElementById('mobileDrawerOverlay');

    if (burger) {
      burger.addEventListener('click', (e) => {
        window.toggleMobileDrawer(e);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.closeMobileDrawer();
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        window.closeMobileDrawer();
      });
    }

    // Outside click listener
    document.addEventListener('click', (e) => {
      const drawer = document.getElementById('mobileDrawer');
      const bBtn = document.getElementById('mobileMenuBtn');
      if (drawer && drawer.classList.contains('active')) {
        if (!drawer.contains(e.target) && !bBtn?.contains(e.target)) {
          window.closeMobileDrawer();
        }
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeMobileDrawer();
      }
    });

    // Global quick search shortcut (Ctrl+K / Cmd+K)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const desktopInput = document.getElementById('searchInput');
        const mobileInput = document.getElementById('mobileSearchInput');
        if (window.innerWidth > 768 && desktopInput) {
          desktopInput.focus();
          desktopInput.select();
        } else if (mobileInput) {
          if (typeof window.focusMobileSearch === 'function') {
            window.focusMobileSearch(e);
          } else {
            mobileInput.focus();
          }
        }
      }
    });
  });
})();
