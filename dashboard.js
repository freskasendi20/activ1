/* ===================================================================
   ACTIVKEYZ CONTROL HUB - COMPREHENSIVE PRODUCTION MANAGEMENT SYSTEM
   Full 12-Module Enterprise Operations Suite:
   1. Overview & Live KPIs
   2. Product Management (CRUD, Duplicate, Archive, Variants, Bulk)
   3. Categories Management
   4. Real Inventory & Transactional Restock Engine (Audit Trail)
   5. Dynamic Bundles & Combo Management (Multi-Product Relations)
   6. Dynamic Payment Methods (Vodafone Cash, InstaPay, USDT TRC20)
   7. Orders & Payment Receipts (Separated Payment & Fulfillment Status)
   8. Customers & Profile Roles
   9. Server-Side Coupons & Promotions
   10. Reviews Moderation
   11. Support Tickets
   12. Complete Store Settings & Currency Rates
   100% Persisted Directly to Supabase.
   =================================================================== */

// Global Dashboard State
let currentActiveTab = 'overview';
let productsList = [];
let categoriesList = [];
let inventoryList = [];
let bundlesList = [];
let paymentMethodsList = [];
let ordersList = [];
let customersList = [];
let couponsList = [];
let reviewsList = [];
let ticketsList = [];
let storeSettingsMap = {};

let selectedProductIds = new Set();
let activeFilters = {
  search: '',
  category: 'all',
  status: 'active',
  featured: 'all'
};
let orderFilters = {
  search: '',
  paymentStatus: 'all',
  fulfillmentStatus: 'all'
};

// ===================================================================
// 1. AUTHENTICATION & SECURITY GATE (STRICT SUPABASE SERVER AUTH)
// ===================================================================

async function checkAdminAuth() {
  const overlay = document.getElementById('adminAuthOverlay');
  const syncTxt = document.getElementById('headerSyncStatusText');
  const errorMsg = document.getElementById('cloudAuthErrorMsg');

  if (window.NexaSupabase && window.NexaSupabase.auth && typeof window.NexaSupabase.auth.getUser === 'function') {
    try {
      const user = await window.NexaSupabase.auth.getUser();
      if (user) {
        const isAdm = await window.NexaSupabase.auth.isAdmin();
        if (isAdm) {
          sessionStorage.setItem('nexa_admin_authenticated', 'true');
          document.body.classList.add('admin-verified');
          if (overlay) overlay.classList.add('unlocked');
          if (syncTxt) syncTxt.innerHTML = `<span style="color:#10b981;">✓ متصل كمدير معتمد: ${escapeHtml(user.email || 'Admin')} (سحابة Supabase نشطة)</span>`;
          await loadAllDashboardData();
          return;
        } else {
          sessionStorage.removeItem('nexa_admin_authenticated');
          document.body.classList.remove('admin-verified');
          if (overlay) overlay.classList.remove('unlocked');
          if (errorMsg) {
            errorMsg.textContent = `❌ الحساب (${user.email}) مسجل كعميل في Supabase Auth، ولكن ليس لديه دور المدير (Role: Admin مطلوب في جدول profiles). الدخول مقتصر على مدير المتجر فقط.`;
            errorMsg.style.display = 'block';
          }
          return;
        }
      }
    } catch(e) {
      console.warn('Admin auth check exception:', e);
    }
  }

  // Not authenticated
  sessionStorage.removeItem('nexa_admin_authenticated');
  document.body.classList.remove('admin-verified');
  if (overlay) overlay.classList.remove('unlocked');
  setTimeout(() => {
    document.getElementById('adminEmailInput')?.focus();
  }, 150);
}

async function handleSupabaseAdminLogin() {
  const emailInput = document.getElementById('adminEmailInput');
  const passInput = document.getElementById('adminPasswordInput');
  const errorMsg = document.getElementById('cloudAuthErrorMsg');
  const submitBtn = document.getElementById('cloudAuthSubmitBtn');

  if (!emailInput || !passInput) return;
  const email = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) {
    if (errorMsg) {
      errorMsg.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
      errorMsg.style.display = 'block';
    }
    return;
  }

  const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق من الهوية...';
  }
  if (errorMsg) errorMsg.style.display = 'none';

  try {
    if (!window.NexaSupabase || !window.NexaSupabase.auth) {
      throw new Error('مكتبة Supabase غير متوفرة');
    }

    await window.NexaSupabase.auth.signIn(email, password);
    const isAdm = await window.NexaSupabase.auth.isAdmin();

    if (!isAdm) {
      if (typeof window.NexaSupabase.auth.signOut === 'function') {
        await window.NexaSupabase.auth.signOut();
      }
      throw new Error('تم التحقق من بيانات الدخول، ولكن هذا الحساب ليس لديه صلاحية الإدارة (Role: Admin في profiles). الوصول مرفوض.');
    }

    sessionStorage.setItem('nexa_admin_authenticated', 'true');
    document.body.classList.add('admin-verified');
    const overlay = document.getElementById('adminAuthOverlay');
    if (overlay) overlay.classList.add('unlocked');
    showToast(`مرحباً بك! تم التحقق من هوية المدير: ${email}`);
    await loadAllDashboardData();
  } catch (err) {
    console.error('Supabase admin login failed:', err);
    if (errorMsg) {
      errorMsg.textContent = '❌ ' + (err.message || 'فشل تسجيل الدخول.');
      errorMsg.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

async function lockAdminSession() {
  sessionStorage.removeItem('nexa_admin_authenticated');
  sessionStorage.removeItem('activkeyz_admin_authenticated');
  document.body.classList.remove('admin-verified');
  const overlay = document.getElementById('adminAuthOverlay');
  if (overlay) overlay.classList.remove('unlocked');
  
  if (window.NexaSupabase && window.NexaSupabase.auth && typeof window.NexaSupabase.auth.signOut === 'function') {
    try {
      await window.NexaSupabase.auth.signOut();
    } catch (e) {
      console.warn('Signout exception:', e);
    }
  }
  showToast('تم قفل لوحة التحكم وتسجيل الخروج بنجاح.');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 400);
}

async function ensureAdminCloudAuth() {
  const isAdm = (window.NexaSupabase && window.NexaSupabase.auth && typeof window.NexaSupabase.auth.isAdmin === 'function') 
    ? await window.NexaSupabase.auth.isAdmin() 
    : false;
  if (!isAdm) {
    showToast('❌ هذه العملية تتطلب صلاحيات المدير المعتمد (Admin Role).');
    lockAdminSession();
    return false;
  }
  return true;
}

// ===================================================================
// 2. TAB SWITCHING SYSTEM (12 MODULES)
// ===================================================================
function switchDashboardTab(tabName) {
  currentActiveTab = tabName;

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const sections = {
    overview: 'dashOverviewSection',
    products: 'dashProductsSection',
    categories: 'dashCategoriesSection',
    inventory: 'dashInventorySection',
    bundles: 'dashBundlesSection',
    payments: 'dashPaymentsSection',
    orders: 'dashOrdersSection',
    customers: 'dashCustomersSection',
    loyalty: 'dashLoyaltySection',
    coupons: 'dashCouponsSection',
    reviews: 'dashReviewsSection',
    tickets: 'dashTicketsSection',
    settings: 'dashSettingsSection'
  };

  Object.entries(sections).forEach(([key, sectionId]) => {
    const el = document.getElementById(sectionId);
    if (el) el.style.display = (key === tabName) ? 'block' : 'none';
  });

  // Module-specific initializations
  if (tabName === 'overview') renderOverview();
  else if (tabName === 'products') renderProductsTable();
  else if (tabName === 'categories') renderCategoriesGrid();
  else if (tabName === 'inventory') renderInventoryTable();
  else if (tabName === 'bundles') renderBundlesGrid();
  else if (tabName === 'payments') renderPaymentsGrid();
  else if (tabName === 'orders') renderOrdersTable();
  else if (tabName === 'customers') renderCustomersTable();
  else if (tabName === 'loyalty') renderLoyaltySection();
  else if (tabName === 'coupons') renderCouponsTable();
  else if (tabName === 'reviews') renderReviewsTable();
  else if (tabName === 'tickets') renderTicketsTable();
  else if (tabName === 'settings') renderSettingsForm();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===================================================================
// 3. MASTER DATA LOADER
// ===================================================================
async function loadAllDashboardData() {
  const syncTxt = document.getElementById('headerSyncStatusText');
  if (syncTxt) syncTxt.textContent = 'جاري المزامنة مع سحابة Supabase...';

  const errors = [];

  // 1. Products (reads from admin_products view)
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.products.getAll === 'function') {
      productsList = await window.NexaSupabase.products.getAll(true);
    }
  } catch (err) {
    console.error('Products load failed:', err);
    errors.push(`المنتجات: ${err.message}`);
    productsList = [];
  }

  // 2. Categories
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.categories.getAll === 'function') {
      categoriesList = await window.NexaSupabase.categories.getAll();
    }
  } catch (err) {
    console.error('Categories load failed:', err);
    errors.push(`الأقسام: ${err.message}`);
    categoriesList = [];
  }

  // 3. Inventory
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.inventory.getAll === 'function') {
      inventoryList = await window.NexaSupabase.inventory.getAll();
    }
  } catch (err) {
    console.error('Inventory load failed:', err);
    errors.push(`المخزون: ${err.message}`);
    inventoryList = [];
  }

  // 4. Bundles
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.bundles.getAll === 'function') {
      bundlesList = await window.NexaSupabase.bundles.getAll(true);
    }
  } catch (err) {
    console.error('Bundles load failed:', err);
    errors.push(`الباقات: ${err.message}`);
    bundlesList = [];
  }

  // 5. Payment Methods
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.payments.getAll === 'function') {
      paymentMethodsList = await window.NexaSupabase.payments.getAll();
    }
  } catch (err) {
    console.error('Payment methods load failed:', err);
    errors.push(`وسائل الدفع: ${err.message}`);
    paymentMethodsList = [];
  }

  // 6. Orders
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.orders.getAll === 'function') {
      ordersList = await window.NexaSupabase.orders.getAll();
    }
  } catch (err) {
    console.error('Orders load failed:', err);
    errors.push(`الطلبات: ${err.message}`);
    ordersList = [];
  }

  // 7. Customers / Profiles
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.customers.getAll === 'function') {
      customersList = await window.NexaSupabase.customers.getAll();
    }
  } catch (err) {
    console.error('Customers load failed:', err);
    errors.push(`العملاء: ${err.message}`);
    customersList = [];
  }

  // 8. Coupons
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.coupons.getAll === 'function') {
      couponsList = await window.NexaSupabase.coupons.getAll();
    }
  } catch (err) {
    console.error('Coupons load failed:', err);
    errors.push(`الكوبونات: ${err.message}`);
    couponsList = [];
  }

  // 9. Reviews
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.reviews.getAll === 'function') {
      reviewsList = await window.NexaSupabase.reviews.getAll(true);
    }
  } catch (err) {
    console.error('Reviews load failed:', err);
    errors.push(`التقييمات: ${err.message}`);
    reviewsList = [];
  }

  // 10. Support Tickets
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.tickets.getAll === 'function') {
      ticketsList = await window.NexaSupabase.tickets.getAll();
    }
  } catch (err) {
    console.error('Tickets load failed:', err);
    errors.push(`الدعم: ${err.message}`);
    ticketsList = [];
  }

  // 11. Store Settings
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.settings.getAll === 'function') {
      storeSettingsMap = await window.NexaSupabase.settings.getAll();
    }
  } catch (err) {
    console.error('Settings load failed:', err);
    errors.push(`الإعدادات: ${err.message}`);
    storeSettingsMap = {};
  }

  populateCategoryDropdowns();
  updateNavBadges();
  switchDashboardTab(currentActiveTab);

  if (syncTxt) {
    if (errors.length === 0) {
      syncTxt.innerHTML = '<span style="color:#10b981;">✓ متصل بسحابة Supabase (تزامن حي نشط - كافة الوحدات تعمل)</span>';
    } else {
      syncTxt.innerHTML = `<span style="color:#ef4444;" title="${escapeHtml(errors.join('\n'))}">⚠️ تنبيه مزامنة (${errors.length} وحدات): ${escapeHtml(errors.slice(0, 2).join(' | '))}</span>`;
    }
  }
}

function populateCategoryDropdowns() {
  // Sync category filter in products toolbar
  const catFilter = document.getElementById('dashCategoryFilter');
  if (catFilter) {
    const curVal = catFilter.value || 'all';
    catFilter.innerHTML = '<option value="all">كل الأقسام</option>' + 
      categoriesList.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    catFilter.value = curVal;
  }

  // Sync category select in product modal
  const formCat = document.getElementById('formCategory');
  if (formCat) {
    const curVal = formCat.value || (categoriesList[0]?.id || 'ai');
    formCat.innerHTML = categoriesList.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    if (curVal) formCat.value = curVal;
  }

  // Sync coupon product eligibility select
  const couponElig = document.getElementById('formCouponEligibility');
  if (couponElig) {
    const curVal = couponElig.value || 'all';
    couponElig.innerHTML = '<option value="all">يسري على كافة المنتجات والباقات</option>' +
      productsList.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${p.priceEgp} ج.م)</option>`).join('');
    couponElig.value = curVal;
  }
}

async function syncAllFromSupabase() {
  showToast('جاري التحديث الفوري لكافة البيانات من السحابة... 🔄');
  await loadAllDashboardData();
  showToast('تم تحديث جميع البيانات بنجاح! ✓');
}

function updateNavBadges() {
  const pCount = document.getElementById('navCountProducts');
  const cCount = document.getElementById('navCountCategories');
  const iCount = document.getElementById('navCountInventory');
  const bCount = document.getElementById('navCountBundles');
  const payCount = document.getElementById('navCountPayments');
  const oCount = document.getElementById('navCountOrders');

  if (pCount) pCount.textContent = productsList.length;
  if (cCount) cCount.textContent = categoriesList.length;
  if (iCount) iCount.textContent = productsList.length;
  if (bCount) bCount.textContent = bundlesList.length;
  if (payCount) payCount.textContent = paymentMethodsList.length;

  const pendingOrders = ordersList.filter(o => o.status === 'pending' || o.paymentStatus === 'unverified').length;
  if (oCount) {
    oCount.textContent = pendingOrders;
    oCount.style.display = pendingOrders > 0 ? 'inline-block' : 'none';
  }
}

// ===================================================================
// 4. MODULE 1: OVERVIEW & LIVE KPIS
// ===================================================================
function renderOverview() {
  const revEl = document.getElementById('kpiTotalRevenue');
  const ordEl = document.getElementById('kpiOrdersTotal');
  const pendingEl = document.getElementById('kpiPendingOrders');
  const prodEl = document.getElementById('kpiTotalProducts');
  const bundleEl = document.getElementById('kpiTotalBundles');
  const lowStockEl = document.getElementById('kpiLowStockCount');
  const payEl = document.getElementById('kpiActivePaymentsCount');

  // Revenue from verified/completed orders
  const verifiedOrders = ordersList.filter(o => o.paymentStatus === 'verified' || o.status === 'completed');
  const totalRevenue = verifiedOrders.reduce((acc, o) => acc + (Number(o.totalEgp) || 0), 0);
  if (revEl) revEl.textContent = `${totalRevenue.toLocaleString()} ج.م`;

  const pendingOrdersCount = ordersList.filter(o => o.status === 'pending' || o.paymentStatus === 'unverified').length;
  if (ordEl) ordEl.textContent = ordersList.length;
  if (pendingEl) pendingEl.textContent = `${pendingOrdersCount} قيد المراجعة`;

  if (prodEl) prodEl.textContent = productsList.filter(p => p.isActive).length;
  if (bundleEl) bundleEl.textContent = bundlesList.filter(b => b.is_active).length;

  // Low stock calculation
  const lowStockCount = inventoryList.filter(inv => {
    return inv.stock_type === 'limited' && (inv.quantity_available - inv.quantity_reserved) <= inv.low_stock_threshold;
  }).length;
  if (lowStockEl) lowStockEl.textContent = lowStockCount;

  if (payEl) payEl.textContent = paymentMethodsList.filter(p => p.is_active).length;

  // Recent 5 orders table
  const recentOrdersTbody = document.getElementById('overviewRecentOrdersBody');
  if (recentOrdersTbody) {
    const recent = ordersList.slice(0, 5);
    if (recent.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748b;">لا توجد طلبات واردة حالياً.</td></tr>`;
    } else {
      recentOrdersTbody.innerHTML = recent.map(o => `
        <tr>
          <td><strong style="color:var(--cyan-bright);">${o.orderId}</strong></td>
          <td style="font-size:0.8rem; color:#94a3b8;">${new Date(o.createdAt || Date.now()).toLocaleDateString('ar-EG')}</td>
          <td>${escapeHtml(o.customerName || 'عميل')} (${escapeHtml(o.customerPhone || '')})</td>
          <td style="font-size:0.82rem;">${(o.items || []).length} باقة</td>
          <td><strong>${(o.totalEgp || 0).toLocaleString()} ج.م</strong></td>
          <td style="text-align:center;">${renderPaymentBadge(o.paymentStatus || 'unverified')}</td>
          <td style="text-align:center;">${renderFulfillmentBadge(o.fulfillmentStatus || 'unfulfilled')}</td>
          <td style="text-align:center;">
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px;" onclick="openOrderDetailsModal('${o.orderId}')">
              <i class="fa-solid fa-eye"></i> تفاصيل
            </button>
          </td>
        </tr>
      `).join('');
    }
  }
}

// ===================================================================
// 5. MODULE 2: PRODUCT MANAGEMENT
// ===================================================================
function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  const countEl = document.getElementById('tableShowingCount');
  if (!tbody) return;

  let filtered = [...productsList];

  // Category filter
  if (activeFilters.category !== 'all') {
    filtered = filtered.filter(p => p.category === activeFilters.category);
  }

  // Status filter
  const statusFilterVal = document.getElementById('dashProductStatusFilter')?.value || activeFilters.status || 'active';
  activeFilters.status = statusFilterVal;

  if (statusFilterVal === 'active') {
    filtered = filtered.filter(p => p.isActive && !p.isArchived);
  } else if (statusFilterVal === 'inactive') {
    filtered = filtered.filter(p => !p.isActive && !p.isArchived);
  } else if (statusFilterVal === 'archived') {
    filtered = filtered.filter(p => p.isArchived);
  }

  // Featured filter
  if (activeFilters.featured === 'featured') {
    filtered = filtered.filter(p => p.isFeatured);
  } else if (activeFilters.featured === 'regular') {
    filtered = filtered.filter(p => !p.isFeatured);
  }

  // Search filter
  if (activeFilters.search) {
    const q = activeFilters.search.toLowerCase();
    filtered = filtered.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.desc && p.desc.toLowerCase().includes(q)) ||
      (p.sourceBot && p.sourceBot.toLowerCase().includes(q))
    );
  }

  if (countEl) countEl.textContent = `يعرض ${filtered.length} من ${productsList.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align:center; padding: 40px; color: var(--text-dim);">
          <i class="fa-solid fa-cubes" style="font-size:2.5rem; color:var(--cyan-primary); margin-bottom:12px; display:block;"></i>
          <h4 style="color:#fff; margin-bottom:6px;">لا توجد اشتراكات مطابقة</h4>
          <p style="font-size:0.85rem;">جرّب تغيير فلاتر البحث أو إضافة اشتراك جديد.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isSelected = selectedProductIds.has(p.id);
    const wholesaleEgpVal = (p.wholesaleEgp !== undefined && p.wholesaleEgp !== null) ? Number(p.wholesaleEgp) : 0;
    const wholesaleUsdVal = (p.wholesaleUsd !== undefined && p.wholesaleUsd !== null) ? Number(p.wholesaleUsd) : (wholesaleEgpVal / 50);
    const profitMargin = p.priceEgp - wholesaleEgpVal;
    const profitPercent = wholesaleEgpVal > 0 ? Math.round((profitMargin / wholesaleEgpVal) * 100) : 100;
    const stockStatus = getProductStockBadge(p);

    return `
      <tr class="${isSelected ? 'selected-row' : ''} ${p.isArchived ? 'opacity-75' : ''}">
        <td style="text-align:center;">
          <input type="checkbox" onchange="toggleSelectProduct('${p.id}', this.checked)" ${isSelected ? 'checked' : ''}>
        </td>
        <td>
          <div style="width:40px; height:40px; border-radius:8px; overflow:hidden; border:1px solid rgba(56,189,248,0.3); background:#060d1a;">
            <img src="${(window.NexaResolveProductImage ? window.NexaResolveProductImage(p) : p.image) || 'logos/chatgpt-plus.webp'}" alt="${escapeHtml(p.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/chatgpt-plus.webp'">
          </div>
        </td>
        <td>
          <div style="font-weight:700; color:#fff; font-size:0.92rem;">${escapeHtml(p.name)} ${p.isArchived ? '<span class="meta-pill" style="background:rgba(168,85,247,0.2); color:#c084fc; font-size:0.7rem;">مؤرشف</span>' : ''}</div>
          <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(p.sourceBot || '')}</div>
        </td>
        <td><span class="meta-pill" style="font-size:0.75rem;">${escapeHtml(p.catName || p.category)}</span></td>
        <td style="font-size:0.82rem; color:#cbd5e1;">${escapeHtml(p.duration || '1 شهر')}</td>
        <td style="font-size:0.85rem; color:#94a3b8;">${wholesaleEgpVal} ج.م <span style="font-size:0.75rem; color:#64748b;">($${wholesaleUsdVal.toFixed(1)})</span></td>
        <td style="font-weight:700; color:var(--cyan-bright); font-size:0.95rem;">${p.priceEgp.toLocaleString()} ج.م</td>
        <td style="font-size:0.82rem; color:#94a3b8;">$${(p.priceUsd || (p.priceEgp / 50)).toFixed(2)}</td>
        <td>${stockStatus}</td>
        <td style="text-align:center;">
          <button type="button" class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:${p.isFeatured ? '#fbbf24' : '#64748b'};" onclick="handleToggleFeatured('${p.id}', ${!p.isFeatured})" title="تبديل التمييز">
            <i class="fa-solid fa-star"></i>
          </button>
        </td>
        <td style="text-align:center;">
          <label class="dash-switch">
            <input type="checkbox" ${p.isActive ? 'checked' : ''} onchange="handleToggleActive('${p.id}', this.checked)">
            <span class="switch-slider"></span>
          </label>
        </td>
        <td style="text-align:center;">
          <div style="display:flex; align-items:center; justify-content:center; gap:5px;">
            <button class="dash-btn dash-btn-ghost" style="padding:6px;" onclick="openEditProductModal('${p.id}')" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="dash-btn dash-btn-ghost" style="padding:6px;" onclick="handleDuplicateProduct('${p.id}')" title="تكرار / نسخ"><i class="fa-solid fa-copy"></i></button>
            <button class="dash-btn dash-btn-ghost" style="padding:6px; color:#fbbf24;" onclick="openInventoryForProduct('${p.id}')" title="إدارة المخزون"><i class="fa-solid fa-boxes-stacked"></i></button>
            <button class="dash-btn dash-btn-ghost" style="padding:6px; color:${p.isArchived ? '#10b981' : '#a855f7'};" onclick="handleToggleArchive('${p.id}', ${!p.isArchived})" title="${p.isArchived ? 'إلغاء الأرشفة' : 'أرشفة المنتج'}"><i class="fa-solid fa-${p.isArchived ? 'box-open' : 'box-archive'}"></i></button>
            <button class="dash-btn dash-btn-ghost" style="padding:6px; color:#ef4444;" onclick="handleDeleteProduct('${p.id}')" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getProductStockBadge(product) {
  if (!product.inventory) {
    return `<span class="badge-stock in_stock"><i class="fa-solid fa-infinity"></i> غير محدود</span>`;
  }
  const inv = product.inventory;
  if (inv.isPaused) {
    return `<span class="badge-stock paused"><i class="fa-solid fa-pause"></i> موقوف</span>`;
  }
  if (inv.stockType === 'unlimited') {
    return `<span class="badge-stock in_stock"><i class="fa-solid fa-infinity"></i> غير محدود</span>`;
  }
  if (inv.stockType === 'manual') {
    return `<span class="badge-stock in_stock"><i class="fa-solid fa-handshake"></i> تنفيذ يدوي</span>`;
  }
  const avail = inv.available - inv.reserved;
  if (avail <= 0) {
    return `<span class="badge-stock out_of_stock"><i class="fa-solid fa-ban"></i> نفدت الكمية</span>`;
  }
  if (avail <= inv.threshold) {
    return `<span class="badge-stock low_stock"><i class="fa-solid fa-triangle-exclamation"></i> متبقي ${avail}</span>`;
  }
  return `<span class="badge-stock in_stock"><i class="fa-solid fa-check"></i> متوفر (${avail})</span>`;
}

// Bulk Actions
function toggleSelectAllProducts(checked) {
  if (checked) {
    productsList.forEach(p => selectedProductIds.add(p.id));
  } else {
    selectedProductIds.clear();
  }
  updateBulkToolbar();
  renderProductsTable();
}

function toggleSelectProduct(id, checked) {
  if (checked) selectedProductIds.add(id);
  else selectedProductIds.delete(id);
  updateBulkToolbar();
  renderProductsTable();
}

function updateBulkToolbar() {
  const bar = document.getElementById('productBulkToolbar');
  const countEl = document.getElementById('selectedProductsCount');
  if (bar && countEl) {
    if (selectedProductIds.size > 0) {
      bar.style.display = 'block';
      countEl.textContent = `تم تحديد ${selectedProductIds.size} منتج`;
    } else {
      bar.style.display = 'none';
    }
  }
}

async function handleBulkActivate(isActive) {
  if (selectedProductIds.size === 0) return;
  const ids = Array.from(selectedProductIds);
  try {
    showToast(`جاري تحديث ${ids.length} منتج...`);
    if (window.NexaSupabase && typeof window.NexaSupabase.products.bulkUpdate === 'function') {
      await window.NexaSupabase.products.bulkUpdate(ids, { is_active: isActive });
    }
    productsList.forEach(p => {
      if (selectedProductIds.has(p.id)) p.isActive = isActive;
    });
    selectedProductIds.clear();
    updateBulkToolbar();
    renderProductsTable();
    showToast('تم تحديث المنتجات المحددة بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل التحديث الجماعي: ' + err.message, 'error');
  }
}

async function handleBulkDelete() {
  if (selectedProductIds.size === 0) return;
  const ok = await window.NexaUI.confirm({
    title: 'حذف جماعي للمنتجات',
    message: `هل أنت متأكد من حذف ${selectedProductIds.size} منتج نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`,
    confirmText: 'حذف المنتجات نهائياً',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  const ids = Array.from(selectedProductIds);
  try {
    showToast(`جاري حذف ${ids.length} منتج...`);
    if (window.NexaSupabase && typeof window.NexaSupabase.products.bulkDelete === 'function') {
      await window.NexaSupabase.products.bulkDelete(ids);
    }
    productsList = productsList.filter(p => !selectedProductIds.has(p.id));
    selectedProductIds.clear();
    updateBulkToolbar();
    renderProductsTable();
    showToast('تم حذف المنتجات بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل الحذف الجماعي: ' + err.message, 'error');
  }
}

// Single Product Actions
async function handleToggleActive(id, isActive) {
  const p = productsList.find(item => item.id === id);
  if (!p) return;
  p.isActive = isActive;
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.products.toggleActive === 'function') {
      await window.NexaSupabase.products.toggleActive(id, isActive);
    }
    showToast(`تم ${isActive ? 'تفعيل' : 'تعطيل'} المنتج (${p.name}) في المتجر.`);
  } catch (err) {
    showToast('❌ تعذر الحفظ في السحابة: ' + err.message);
  }
}

async function handleToggleFeatured(id, isFeatured) {
  const p = productsList.find(item => item.id === id);
  if (!p) return;
  p.isFeatured = isFeatured;
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.products.toggleFeatured === 'function') {
      await window.NexaSupabase.products.toggleFeatured(id, isFeatured);
    }
    renderProductsTable();
    showToast(`تم ${isFeatured ? 'تمييز' : 'إلغاء تمييز'} المنتج (${p.name}).`);
  } catch (err) {
    showToast('❌ تعذر الحفظ في السحابة: ' + err.message);
  }
}

async function handleDuplicateProduct(id) {
  try {
    showToast('جاري تكرار المنتج وإنشاء نسخة سحابية...');
    if (window.NexaSupabase && typeof window.NexaSupabase.products.duplicate === 'function') {
      await window.NexaSupabase.products.duplicate(id);
    }
    await loadAllDashboardData();
    showToast('تم نسخ المنتج بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('تعذر نسخ المنتج: ' + err.message, 'error');
  }
}

async function handleDeleteProduct(id) {
  const p = productsList.find(item => item.id === id);
  const ok = await window.NexaUI.confirm({
    title: 'حذف المنتج نهائياً',
    message: `هل أنت متأكد من حذف المنتج (${p ? p.name : id}) نهائياً من قاعدة البيانات؟`,
    confirmText: 'حذف نهائي',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.products.delete === 'function') {
      await window.NexaSupabase.products.delete(id);
    }
    productsList = productsList.filter(item => item.id !== id);
    renderProductsTable();
    showToast('تم حذف المنتج بنجاح.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف المنتج: ' + err.message, 'error');
  }
}

async function handleToggleArchive(id, isArchived) {
  const p = productsList.find(item => item.id === id);
  if (!p) return;
  p.isArchived = isArchived;
  try {
    showToast(isArchived ? 'جاري أرشفة المنتج...' : 'جاري إلغاء أرشفة المنتج...');
    if (window.NexaSupabase && typeof window.NexaSupabase.products.toggleArchive === 'function') {
      await window.NexaSupabase.products.toggleArchive(id, isArchived);
    }
    renderProductsTable();
    showToast(isArchived ? `تم نقل المنتج (${p.name}) للأرشيف بنجاح! 📦` : `تم استعادة المنتج (${p.name}) من الأرشيف! ✓`);
  } catch (err) {
    showToast('❌ تعذر تغيير حالة الأرشفة: ' + err.message);
  }
}

function toggleFormStockType() {
  const stockType = document.getElementById('formStockType')?.value || 'unlimited';
  const qtyGroup = document.getElementById('formQtyGroup');
  const threshGroup = document.getElementById('formThresholdGroup');
  if (qtyGroup) qtyGroup.style.display = (stockType === 'limited') ? 'block' : 'none';
  if (threshGroup) threshGroup.style.display = (stockType === 'limited') ? 'block' : 'none';
}

// Product Form Modal Handlers
function openAddProductModal() {
  document.getElementById('modalTitle').textContent = 'إضافة اشتراك جديد';
  document.getElementById('formProductId').value = '';
  document.getElementById('formName').value = '';
  document.getElementById('formCategory').value = categoriesList[0]?.id || 'ai';
  document.getElementById('formDuration').value = '1 شهر';
  document.getElementById('formSourceBot').value = '';
  document.getElementById('formWholesaleEgp').value = '100';
  const wholeUsdEl = document.getElementById('formWholesaleUsd');
  if (wholeUsdEl) wholeUsdEl.value = '2.00';
  document.getElementById('formPriceEgp').value = '300';
  document.getElementById('formPriceUsd').value = '6.00';
  document.getElementById('formDesc').value = '';
  document.getElementById('formFullDesc').value = '';
  document.getElementById('formActivationGuide').value = '1. يتم إرسال بيانات التفعيل أو الحساب إلى الواتساب أو الإيميل فوراً.\n2. تسجيل الدخول بالمنصة الرسمية وتأكيد الباقة.';
  document.getElementById('formDeliveryInstructions').value = 'تسليم فوري ومباشر إلى بريدك الإلكتروني والواتساب المسجل بالطلب.';
  document.getElementById('formWarranty').value = 'ضمان شامل كامل المدة مع استبدال فوري وحل أي مشكلة خلال دقائق.';
  document.getElementById('formSpecs').value = 'تفعيل رسمي 100%\nضمان كامل طوال المدة\nتسليم فوري ومباشر';
  document.getElementById('formImage').value = 'logos/chatgpt-plus.webp';
  const dispOrderEl = document.getElementById('formDisplayOrder');
  if (dispOrderEl) dispOrderEl.value = productsList.length + 1;
  document.getElementById('formIsFeatured').checked = false;
  document.getElementById('formIsActive').checked = true;
  const isArchivedEl = document.getElementById('formIsArchived');
  if (isArchivedEl) isArchivedEl.checked = false;

  const stockTypeEl = document.getElementById('formStockType');
  if (stockTypeEl) stockTypeEl.value = 'unlimited';
  const qtyAvailEl = document.getElementById('formQuantityAvailable');
  if (qtyAvailEl) qtyAvailEl.value = '100';
  const threshEl = document.getElementById('formLowStockThreshold');
  if (threshEl) threshEl.value = '5';
  const isPausedEl = document.getElementById('formIsPaused');
  if (isPausedEl) isPausedEl.checked = false;
  toggleFormStockType();

  const previewBtn = document.getElementById('btnPreviewStorefront');
  if (previewBtn) previewBtn.style.display = 'none';

  switchProductModalTab('basic');
  updateProfitIndicators();
  loadProductVariantsInModal(null);

  const modal = document.getElementById('productFormModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (modal) { modal.style.display = 'block'; modal.classList.add('active'); }
  if (backdrop) { backdrop.style.display = 'block'; backdrop.classList.add('active'); }
}

function switchProductModalTab(tabName) {
  const tabs = ['basic', 'content', 'variants', 'inventory'];
  tabs.forEach(t => {
    const btn = document.getElementById('btnTab' + t.charAt(0).toUpperCase() + t.slice(1));
    const pane = document.getElementById('paneProduct' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === tabName);
    if (pane) pane.classList.toggle('active', t === tabName);
  });
}

function updateProfitIndicators() {
  const wholeEgp = Number(document.getElementById('formWholesaleEgp')?.value) || 0;
  const priceEgp = Number(document.getElementById('formPriceEgp')?.value) || 0;
  const profit = priceEgp - wholeEgp;
  const marginPct = priceEgp > 0 ? Math.round((profit / priceEgp) * 100) : 0;

  const profitTxt = document.getElementById('calcProfitText');
  const marginTxt = document.getElementById('calcMarginText');
  if (profitTxt) {
    profitTxt.textContent = `${profit >= 0 ? '+' : ''}${profit.toLocaleString()} ج.م ربح`;
    profitTxt.style.color = profit >= 0 ? '#10b981' : '#f87171';
  }
  if (marginTxt) {
    marginTxt.textContent = `(هامش: ${marginPct}%)`;
    marginTxt.style.color = marginPct >= 30 ? 'var(--cyan-bright)' : '#f59e0b';
  }
}

let currentEditingProductId = null;

async function loadProductVariantsInModal(productId) {
  const tbody = document.getElementById('productVariantsTableBody');
  const badge = document.getElementById('modalVariantsBadgeCount');
  if (!tbody) return;

  if (!productId) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:16px; text-align:center; color:#94a3b8;"><i class="fa-solid fa-circle-info"></i> احفظ الاشتراك أولاً لتتمكن من إضافة باقات ومتغيرات له.</td></tr>`;
    if (badge) badge.textContent = '0';
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" style="padding:14px; text-align:center; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> جاري جلب الباقات...</td></tr>`;

  try {
    let variants = [];
    if (window.NexaSupabase && window.NexaSupabase.variants && typeof window.NexaSupabase.variants.getByProductId === 'function') {
      variants = await window.NexaSupabase.variants.getByProductId(productId);
    }

    if (badge) badge.textContent = String(variants.length);

    if (variants.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:16px; text-align:center; color:#94a3b8;">لا توجد باقات بديلة مضافة لهذا المنتج بعد. يمكنك إضافة باقة من النموذج بالأسفل.</td></tr>`;
      return;
    }

    tbody.innerHTML = variants.map(v => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <td style="padding:8px;"><strong style="color:#fff;">${escapeHtml(v.name)}</strong></td>
        <td style="padding:8px; color:#cbd5e1;">${escapeHtml(v.duration || '-')}</td>
        <td style="padding:8px; color:var(--cyan-bright); font-weight:700;">${Number(v.price_egp).toLocaleString()} ج.م</td>
        <td style="padding:8px; color:#94a3b8;">$${Number(v.price_usd).toFixed(2)}</td>
        <td style="padding:8px;">
          <span class="meta-pill" style="${v.is_active ? 'background:rgba(16,185,129,0.15); color:#34d399;' : 'background:rgba(239,68,68,0.15); color:#f87171;'}">
            ${v.is_active ? 'نشطة ✓' : 'معطلة'}
          </span>
        </td>
        <td style="padding:8px; text-align:center;">
          <button type="button" class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="handleDeleteVariantFromModal('${v.id}')" title="حذف الباقة">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading variants:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="padding:14px; text-align:center; color:#f87171;">تعذر جلب الباقات: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function handleAddVariantFromModal() {
  const prodId = document.getElementById('formProductId').value.trim();
  if (!prodId) {
    window.NexaUI.toast('يرجى حفظ المنتج أولاً قبل إضافة باقات له.', 'warning');
    return;
  }

  const name = document.getElementById('newVarName')?.value.trim();
  const duration = document.getElementById('newVarDuration')?.value.trim();
  const priceEgp = Number(document.getElementById('newVarPriceEgp')?.value) || 0;
  const priceUsd = Number(document.getElementById('newVarPriceUsd')?.value) || (priceEgp / 50);
  const isActive = document.getElementById('newVarIsActive')?.checked !== false;

  if (!name || priceEgp <= 0) {
    window.NexaUI.toast('يرجى كتابة اسم الباقة وسعر البيع بشكل صحيح.', 'warning');
    return;
  }

  try {
    showToast('جاري حفظ الباقة الجديدة في Supabase...');
    if (window.NexaSupabase && window.NexaSupabase.variants) {
      await window.NexaSupabase.variants.create({
        productId: prodId,
        name,
        duration: duration || '1 شهر',
        priceEgp,
        priceUsd,
        isActive
      });
    }

    document.getElementById('newVarName').value = '';
    document.getElementById('newVarDuration').value = '';
    document.getElementById('newVarPriceEgp').value = '';
    document.getElementById('newVarPriceUsd').value = '';

    await loadProductVariantsInModal(prodId);
    showToast('تمت إضافة الباقة بنجاح وربطها بالمنتج! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل إضافة الباقة: ' + err.message, 'error');
  }
}

async function handleDeleteVariantFromModal(variantId) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف باقة المنتج',
    message: 'هل أنت متأكد من حذف هذه الباقة من المنتج نهائياً؟',
    confirmText: 'حذف الباقة',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  const prodId = document.getElementById('formProductId').value.trim();
  try {
    if (window.NexaSupabase && window.NexaSupabase.variants) {
      await window.NexaSupabase.variants.delete(variantId);
    }
    await loadProductVariantsInModal(prodId);
    showToast('تم حذف الباقة بنجاح.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف الباقة: ' + err.message, 'error');
  }
}

function openEditProductModal(id) {
  const p = productsList.find(item => item.id === id);
  if (!p) return;
  currentEditingProductId = p.id;

  document.getElementById('modalTitle').textContent = `تعديل وإدارة اشتراك: ${p.name}`;
  document.getElementById('formProductId').value = p.id;
  const slugEl = document.getElementById('formProductSlug');
  if (slugEl) {
    slugEl.value = p.id;
    slugEl.disabled = true;
  }

  document.getElementById('formName').value = p.name;
  document.getElementById('formCategory').value = p.category;
  document.getElementById('formDuration').value = p.duration || '1 شهر';
  document.getElementById('formSourceBot').value = p.sourceBot || '';
  document.getElementById('formWholesaleEgp').value = p.wholesaleEgp;
  const wholeUsdEl = document.getElementById('formWholesaleUsd');
  if (wholeUsdEl) wholeUsdEl.value = (p.wholesaleUsd !== undefined && p.wholesaleUsd !== null) ? p.wholesaleUsd : (p.wholesaleEgp ? (p.wholesaleEgp / 50).toFixed(2) : '0');
  document.getElementById('formPriceEgp').value = p.priceEgp;
  document.getElementById('formPriceUsd').value = p.priceUsd;
  document.getElementById('formDesc').value = p.desc || '';
  document.getElementById('formFullDesc').value = p.fullDesc || '';
  document.getElementById('formSpecs').value = Array.isArray(p.specs) ? p.specs.join('\n') : '';

  const actMethEl = document.getElementById('formActivationMethod');
  if (actMethEl) actMethEl.value = p.activationMethod || 'personal_email';
  const delMethEl = document.getElementById('formDeliveryMethod');
  if (delMethEl) delMethEl.value = p.deliveryMethod || 'whatsapp';
  const expDelEl = document.getElementById('formExpectedDelivery');
  if (expDelEl) expDelEl.value = p.expectedDelivery || 'تسليم فوري خلال دقائق';

  const reqFields = Array.isArray(p.requiredFields) ? p.requiredFields : (Array.isArray(p.required_fields) ? p.required_fields : ['recipient_email']);
  const reqEmailEl = document.getElementById('formReqRecipientEmail');
  if (reqEmailEl) reqEmailEl.checked = reqFields.includes('recipient_email');
  const reqWaEl = document.getElementById('formReqWhatsapp');
  if (reqWaEl) reqWaEl.checked = reqFields.includes('whatsapp_phone');
  const reqAccEl = document.getElementById('formReqAccountEmail');
  if (reqAccEl) reqAccEl.checked = reqFields.includes('account_email');

  document.getElementById('formActivationGuide').value = p.activationGuide || '';
  document.getElementById('formDeliveryInstructions').value = p.deliveryInstructions || '';
  document.getElementById('formWarranty').value = p.warranty || '';
  const purchInstEl = document.getElementById('formPurchaseInstructions');
  if (purchInstEl) purchInstEl.value = p.purchaseInstructions || '';
  const fulTemplEl = document.getElementById('formFulfillmentTemplate');
  if (fulTemplEl) fulTemplEl.value = p.fulfillmentTemplate || '';

  document.getElementById('formImage').value = p.image || '';
  const dispOrderEl = document.getElementById('formDisplayOrder');
  if (dispOrderEl) dispOrderEl.value = p.displayOrder || 1;
  document.getElementById('formIsFeatured').checked = Boolean(p.isFeatured);
  document.getElementById('formIsActive').checked = Boolean(p.isActive);
  const isArchivedEl = document.getElementById('formIsArchived');
  if (isArchivedEl) isArchivedEl.checked = Boolean(p.isArchived);

  const inv = p.inventory || {};
  const stockTypeEl = document.getElementById('formStockType');
  if (stockTypeEl) stockTypeEl.value = inv.stockType || 'unlimited';
  const qtyAvailEl = document.getElementById('formQuantityAvailable');
  if (qtyAvailEl) qtyAvailEl.value = (inv.available !== undefined) ? inv.available : 100;
  const threshEl = document.getElementById('formLowStockThreshold');
  if (threshEl) threshEl.value = (inv.threshold !== undefined) ? inv.threshold : 5;
  const isPausedEl = document.getElementById('formIsPaused');
  if (isPausedEl) isPausedEl.checked = Boolean(inv.isPaused);
  toggleFormStockType();

  const previewBtn = document.getElementById('btnPreviewStorefront');
  if (previewBtn) {
    previewBtn.href = `product.html?id=${encodeURIComponent(p.id)}`;
    previewBtn.style.display = 'inline-flex';
  }

  switchProductModalTab('basic');
  updateProfitIndicators();
  loadProductVariantsInModal(p.id);

  const modal = document.getElementById('productFormModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (modal) { modal.style.display = 'block'; modal.classList.add('active'); }
  if (backdrop) { backdrop.style.display = 'block'; backdrop.classList.add('active'); }
}

function closeProductModal() {
  const modal = document.getElementById('productFormModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
  if (backdrop) { backdrop.style.display = 'none'; backdrop.classList.remove('active'); }
}

function autoCalcSuggestedPrice() {
  const wholesaleInput = document.getElementById('formWholesaleEgp');
  const priceInput = document.getElementById('formPriceEgp');
  const usdInput = document.getElementById('formPriceUsd');
  if (!wholesaleInput || !priceInput) return;

  const wholesale = Number(wholesaleInput.value) || 0;
  if (wholesale <= 0) return;

  let suggestedEgp = wholesale < 300 ? wholesale * 3 : wholesale + 1000;
  priceInput.value = suggestedEgp;
  if (usdInput) usdInput.value = (suggestedEgp / 50).toFixed(2);
  updateProfitIndicators();
}

function applyFormulaPrices() {
  autoCalcSuggestedPrice();
  showToast('تم حساب سعر التجزئة وسعر الدولار طبقاً لمعادلة الأرباح! ⚡');
}

async function handleSaveProduct() {
  const idInput = document.getElementById('formProductId').value.trim();
  const slugInput = document.getElementById('formProductSlug')?.value.trim();
  const name = document.getElementById('formName').value.trim();
  const category = document.getElementById('formCategory').value;
  const duration = document.getElementById('formDuration').value.trim();
  const sourceBot = document.getElementById('formSourceBot').value.trim();
  const wholesaleEgp = Number(document.getElementById('formWholesaleEgp').value) || 0;
  const wholesaleUsd = Number(document.getElementById('formWholesaleUsd')?.value) || (wholesaleEgp / 50);
  const priceEgp = Number(document.getElementById('formPriceEgp').value) || 0;
  const priceUsd = Number(document.getElementById('formPriceUsd').value) || (priceEgp / 50);
  const desc = document.getElementById('formDesc').value.trim();
  const fullDesc = document.getElementById('formFullDesc').value.trim();
  const activationGuide = document.getElementById('formActivationGuide').value.trim();
  const deliveryInstructions = document.getElementById('formDeliveryInstructions').value.trim();
  const warranty = document.getElementById('formWarranty').value.trim();
  const specsRaw = document.getElementById('formSpecs').value.trim();
  const specs = specsRaw ? specsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];

  const activationMethod = document.getElementById('formActivationMethod')?.value || 'personal_email';
  const deliveryMethod = document.getElementById('formDeliveryMethod')?.value || 'email';
  const expectedDelivery = document.getElementById('formExpectedDelivery')?.value.trim() || 'تسليم فوري خلال دقائق';
  const purchaseInstructions = document.getElementById('formPurchaseInstructions')?.value.trim() || '';
  const fulfillmentTemplate = document.getElementById('formFulfillmentTemplate')?.value.trim() || '';

  const requiredFields = [];
  if (document.getElementById('formReqRecipientEmail')?.checked) requiredFields.push('recipient_email');
  if (document.getElementById('formReqWhatsapp')?.checked) requiredFields.push('whatsapp_phone');
  if (document.getElementById('formReqAccountEmail')?.checked) requiredFields.push('account_email');

  const image = document.getElementById('formImage').value.trim() || 'logos/chatgpt-plus.webp';
  const displayOrder = Number(document.getElementById('formDisplayOrder')?.value) || 0;
  const isFeatured = document.getElementById('formIsFeatured').checked;
  const isActive = document.getElementById('formIsActive').checked;
  const isArchived = document.getElementById('formIsArchived')?.checked || false;

  const stockType = document.getElementById('formStockType')?.value || 'unlimited';
  const available = Number(document.getElementById('formQuantityAvailable')?.value) || 0;
  const threshold = Number(document.getElementById('formLowStockThreshold')?.value) || 5;
  const isPaused = document.getElementById('formIsPaused')?.checked || false;

  const id = idInput || (slugInput || (category + '-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000)));

  const productData = {
    id,
    name,
    category,
    duration,
    sourceBot,
    wholesaleEgp,
    wholesaleUsd,
    priceEgp,
    priceUsd,
    desc,
    fullDesc,
    activationGuide,
    deliveryInstructions,
    warranty,
    specs,
    activationMethod,
    deliveryMethod,
    expectedDelivery,
    purchaseInstructions,
    fulfillmentTemplate,
    requiredFields,
    image,
    featuredImage: image,
    displayOrder,
    isFeatured,
    isActive,
    isArchived,
    stockType,
    available,
    threshold,
    isPaused
  };

  try {
    showToast('جاري حفظ وتطبيق المنتج في Supabase...');
    if (idInput) {
      if (window.NexaSupabase && typeof window.NexaSupabase.products.update === 'function') {
        await window.NexaSupabase.products.update(idInput, productData);
      }
    } else {
      if (window.NexaSupabase && typeof window.NexaSupabase.products.create === 'function') {
        await window.NexaSupabase.products.create(productData);
      }
    }

    closeProductModal();
    await loadAllDashboardData();
    showToast('تم حفظ المنتج بنجاح وتحديث المتجر فوراً! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ المنتج: ' + err.message, 'error');
  }
}

// ===================================================================
// 6. MODULE 3: CATEGORIES MANAGEMENT
// ===================================================================
function renderCategoriesGrid() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  grid.innerHTML = categoriesList.map(c => {
    const prodCount = productsList.filter(p => p.category === c.id).length;
    return `
      <div class="management-card">
        <div>
          <div class="card-top-row">
            <div class="card-meta-icon"><i class="${c.icon || 'fa-solid fa-layer-group'}"></i></div>
            <span class="meta-pill">${prodCount} منتج</span>
          </div>
          <h4 class="card-title">${escapeHtml(c.name)}</h4>
          <span style="font-size:0.75rem; color:var(--cyan-bright); font-family:var(--font-latin);">${c.id}</span>
          <p class="card-subtext" style="margin-top:6px;">${escapeHtml(c.description || '')}</p>
        </div>
        <div class="card-actions-bar">
          <span style="font-size:0.76rem; color:#64748b;">ترتيب: ${c.display_order || 1}</span>
          <div style="display:flex; gap:6px;">
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px;" onclick="openEditCategoryModal('${c.id}')"><i class="fa-solid fa-pen"></i> تعديل</button>
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="handleDeleteCategory('${c.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddCategoryModal() {
  document.getElementById('categoryModalTitle').textContent = 'إضافة قسم جديد';
  document.getElementById('formCategoryId').value = '';
  document.getElementById('formCategorySlug').value = '';
  document.getElementById('formCategorySlug').readOnly = false;
  document.getElementById('formCategoryName').value = '';
  document.getElementById('formCategoryIcon').value = 'fa-solid fa-wand-magic-sparkles';
  document.getElementById('formCategoryDesc').value = '';
  document.getElementById('formCategoryOrder').value = categoriesList.length + 1;

  document.getElementById('categoryFormModal').style.display = 'block';
  document.getElementById('categoryModalBackdrop').style.display = 'block';
}

function openEditCategoryModal(id) {
  const c = categoriesList.find(item => item.id === id);
  if (!c) return;

  document.getElementById('categoryModalTitle').textContent = `تعديل القسم: ${c.name}`;
  document.getElementById('formCategoryId').value = c.id;
  document.getElementById('formCategorySlug').value = c.id;
  document.getElementById('formCategorySlug').readOnly = true;
  document.getElementById('formCategoryName').value = c.name;
  document.getElementById('formCategoryIcon').value = c.icon || '';
  document.getElementById('formCategoryDesc').value = c.description || '';
  document.getElementById('formCategoryOrder').value = c.display_order || 1;

  document.getElementById('categoryFormModal').style.display = 'block';
  document.getElementById('categoryModalBackdrop').style.display = 'block';
}

function closeCategoryModal() {
  document.getElementById('categoryFormModal').style.display = 'none';
  document.getElementById('categoryModalBackdrop').style.display = 'none';
}

async function handleSaveCategory() {
  const editId = document.getElementById('formCategoryId').value.trim();
  const slug = document.getElementById('formCategorySlug').value.trim();
  const name = document.getElementById('formCategoryName').value.trim();
  const icon = document.getElementById('formCategoryIcon').value.trim();
  const desc = document.getElementById('formCategoryDesc').value.trim();
  const order = Number(document.getElementById('formCategoryOrder').value) || 1;

  const catData = {
    id: editId || slug,
    name,
    icon,
    description: desc,
    display_order: order
  };

  try {
    showToast('جاري حفظ القسم في Supabase...');
    if (editId) {
      if (window.NexaSupabase && typeof window.NexaSupabase.categories.update === 'function') {
        await window.NexaSupabase.categories.update(editId, catData);
      }
    } else {
      if (window.NexaSupabase && typeof window.NexaSupabase.categories.create === 'function') {
        await window.NexaSupabase.categories.create(catData);
      }
    }
    closeCategoryModal();
    await loadAllDashboardData();
    showToast('تم حفظ القسم بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ القسم: ' + err.message, 'error');
  }
}

async function handleDeleteCategory(id) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف القسم',
    message: `هل أنت متأكد من حذف القسم (${id})؟ تأكد من عدم وجود منتجات تابعة له أولاً.`,
    confirmText: 'حذف القسم',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.categories.delete === 'function') {
      await window.NexaSupabase.categories.delete(id);
    }
    await loadAllDashboardData();
    showToast('تم حذف القسم.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف القسم: ' + err.message, 'error');
  }
}

// ===================================================================
// 7. MODULE 4: INVENTORY MANAGEMENT & AUDIT LOGS
// ===================================================================
function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  const countEl = document.getElementById('inventoryCountPill');
  const filterVal = document.getElementById('dashInventoryFilter')?.value || 'all';
  const searchVal = document.getElementById('dashInventorySearchInput')?.value.trim().toLowerCase() || '';

  if (!tbody) return;

  let filtered = [...productsList];

  if (searchVal) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchVal));
  }

  if (filterVal === 'in_stock') {
    filtered = filtered.filter(p => !p.inventory || p.inventory.stockType === 'unlimited' || (p.inventory.available - p.inventory.reserved) > p.inventory.threshold);
  } else if (filterVal === 'low_stock') {
    filtered = filtered.filter(p => p.inventory && p.inventory.stockType === 'limited' && (p.inventory.available - p.inventory.reserved) <= p.inventory.threshold && (p.inventory.available - p.inventory.reserved) > 0);
  } else if (filterVal === 'out_of_stock') {
    filtered = filtered.filter(p => p.inventory && p.inventory.stockType === 'limited' && (p.inventory.available - p.inventory.reserved) <= 0);
  } else if (filterVal === 'paused') {
    filtered = filtered.filter(p => p.inventory && p.inventory.isPaused);
  }

  if (countEl) countEl.textContent = `${filtered.length} منتج`;

  tbody.innerHTML = filtered.map(p => {
    const inv = p.inventory || { stockType: 'unlimited', available: 100, reserved: 0, sold: 0, threshold: 5, isPaused: false };
    const stockStatus = getProductStockBadge(p);

    const typeLabel = inv.stockType === 'unlimited' ? 'غير محدود (Unlimited)' : (inv.stockType === 'limited' ? 'محدود بالعدد (Limited)' : 'تنفيذ يدوي (Manual)');

    return `
      <tr>
        <td>
          <div style="width:36px; height:36px; border-radius:6px; overflow:hidden; border:1px solid rgba(56,189,248,0.3); background:#060d1a;">
            <img src="${(window.NexaResolveProductImage ? window.NexaResolveProductImage(p) : p.image) || 'logos/chatgpt-plus.webp'}" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/chatgpt-plus.webp'">
          </div>
        </td>
        <td>
          <strong style="color:#fff;">${escapeHtml(p.name)}</strong>
          <div style="font-size:0.75rem; color:#64748b;">${p.id}</div>
        </td>
        <td style="font-size:0.8rem;">${typeLabel}</td>
        <td style="font-weight:700; color:var(--cyan-bright); font-size:1rem;">${inv.stockType === 'unlimited' ? '∞' : inv.available}</td>
        <td style="color:#f59e0b;">${inv.reserved}</td>
        <td style="color:#34d399;">${inv.sold}</td>
        <td style="color:#94a3b8;">${inv.threshold}</td>
        <td>${stockStatus}</td>
        <td style="text-align:center;">
          <button class="dash-btn dash-btn-ghost" style="padding:6px 12px; font-size:0.8rem;" onclick="openInventoryForProduct('${p.id}')">
            <i class="fa-solid fa-boxes-packing"></i> تعديل المخزون
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openInventoryForProduct(productId) {
  const p = productsList.find(item => item.id === productId);
  if (!p) return;

  const inv = p.inventory || { stockType: 'unlimited', available: 100, threshold: 5, isPaused: false };

  document.getElementById('invProductId').value = p.id;
  document.getElementById('invProductName').textContent = `${p.name} (${p.duration})`;
  document.getElementById('invStockType').value = inv.stockType || 'unlimited';
  document.getElementById('invQuantityAvailable').value = inv.available || 100;
  document.getElementById('invLowStockThreshold').value = inv.threshold || 5;
  document.getElementById('invIsPaused').checked = Boolean(inv.isPaused);
  document.getElementById('invReason').value = '';

  toggleInventoryInputs();

  document.getElementById('inventoryFormModal').style.display = 'block';
  document.getElementById('inventoryModalBackdrop').style.display = 'block';
}

function toggleInventoryInputs() {
  const type = document.getElementById('invStockType')?.value;
  const grid = document.getElementById('invQuantitiesGrid');
  if (grid) {
    grid.style.display = (type === 'limited') ? 'grid' : 'none';
  }
}

function closeInventoryModal() {
  document.getElementById('inventoryFormModal').style.display = 'none';
  document.getElementById('inventoryModalBackdrop').style.display = 'none';
}

async function handleSaveInventory() {
  const prodId = document.getElementById('invProductId').value;
  const stockType = document.getElementById('invStockType').value;
  const available = Number(document.getElementById('invQuantityAvailable').value) || 0;
  const threshold = Number(document.getElementById('invLowStockThreshold').value) || 5;
  const isPaused = document.getElementById('invIsPaused').checked;
  const reason = document.getElementById('invReason').value.trim() || 'تعديل مخزون من لوحة التحكم';

  try {
    showToast('جاري تسجيل وتطبيق حركة المخزون...');
    if (window.NexaSupabase && typeof window.NexaSupabase.inventory.adjustStock === 'function') {
      await window.NexaSupabase.inventory.adjustStock({
        productId: prodId,
        stockType,
        newAvailable: available,
        lowStockThreshold: threshold,
        isPaused,
        reason
      });
    }

    closeInventoryModal();
    await loadAllDashboardData();
    showToast('تم تحديث المخزون وتسجيل الحركة بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل تعديل المخزون: ' + err.message, 'error');
  }
}

async function openInventoryMovementsModal() {
  const modal = document.getElementById('inventoryLogModal');
  const backdrop = document.getElementById('inventoryLogBackdrop');
  const timeline = document.getElementById('inventoryMovementsTimeline');

  if (modal) modal.style.display = 'block';
  if (backdrop) backdrop.style.display = 'block';

  if (timeline) {
    timeline.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> جاري استرجاع سجل الحركات...</div>`;
    try {
      let movements = [];
      if (window.NexaSupabase && typeof window.NexaSupabase.inventory.getMovements === 'function') {
        movements = await window.NexaSupabase.inventory.getMovements(null, 50);
      }

      if (movements.length === 0) {
        timeline.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;">لا توجد حركات مخزون مسجلة بعد.</div>`;
      } else {
        timeline.innerHTML = movements.map(m => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span>${m.products ? m.products.name : m.product_id}</span>
                <span style="color:${m.quantity_change > 0 ? '#34d399' : '#f87171'};">${m.quantity_change > 0 ? '+' : ''}${m.quantity_change}</span>
              </div>
              <div class="timeline-text">${escapeHtml(m.reason || 'حركة مخزون')} (الرصيد: ${m.previous_quantity} ➔ ${m.new_quantity})</div>
              <div class="timeline-date">${formatArabicDateTime(m.created_at)}</div>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      timeline.innerHTML = `<div style="color:#ef4444; padding:20px;">تعذر تحميل السجل: ${e.message}</div>`;
    }
  }
}

function closeInventoryLogModal() {
  document.getElementById('inventoryLogModal').style.display = 'none';
  document.getElementById('inventoryLogBackdrop').style.display = 'none';
}

// ===================================================================
// 8. MODULE 5: BUNDLES & COMBO MANAGEMENT
// ===================================================================
function renderBundlesGrid() {
  const grid = document.getElementById('bundlesGrid');
  if (!grid) return;

  grid.innerHTML = bundlesList.map(b => {
    const savings = b.original_price_egp - b.price_egp;
    const items = (b.bundle_items || []).map(bi => bi.products?.name).filter(Boolean);

    return `
      <div class="management-card">
        <div>
          <div class="card-top-row">
            <div style="width:48px; height:48px; border-radius:10px; overflow:hidden; border:1px solid rgba(56,189,248,0.3); background:#060d1a;">
              <img src="${(window.NexaResolveProductImage ? window.NexaResolveProductImage(b) : b.image) || 'logos/chatgpt-plus.webp'}" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='logos/chatgpt-plus.webp'">
            </div>
            <span class="meta-pill" style="background:rgba(16,185,129,0.15); color:#34d399;">توفير ${savings} ج.م</span>
          </div>

          <h4 class="card-title">${escapeHtml(b.name)}</h4>
          <p class="card-subtext">${escapeHtml(b.description || '')}</p>

          <div style="margin:12px 0; background:rgba(6,12,24,0.6); padding:10px; border-radius:8px; border:1px solid rgba(56,189,248,0.15);">
            <span style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">الاشتراكات المشمولة:</span>
            ${items.length > 0 ? items.map(it => `<span class="badge-stock in_stock" style="margin:2px; font-size:0.7rem;">• ${escapeHtml(it)}</span>`).join('') : '<span style="color:#64748b; font-size:0.75rem;">لم يتم ربط منتجات</span>'}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:8px;">
            <div>
              <span style="text-decoration:line-through; color:#64748b; font-size:0.85rem;">${b.original_price_egp} ج.م</span>
              <div style="font-weight:900; color:var(--cyan-bright); font-size:1.25rem;">${b.price_egp.toLocaleString()} ج.م</div>
            </div>
            <span style="color:#94a3b8; font-size:0.85rem;">$${(b.price_usd || (b.price_egp / 50)).toFixed(2)}</span>
          </div>
        </div>

        <div class="card-actions-bar">
          <div style="display:flex; align-items:center; gap:8px;">
            <label class="dash-switch" title="تفعيل أو تعطيل الباقة">
              <input type="checkbox" ${b.is_active ? 'checked' : ''} onchange="handleToggleBundleActive('${b.id}', this.checked)">
              <span class="switch-slider"></span>
            </label>
            <span style="font-size:0.75rem; color:#94a3b8;">نشطة</span>
          </div>

          <div style="display:flex; gap:6px;">
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px;" onclick="openEditBundleModal('${b.id}')"><i class="fa-solid fa-pen"></i> تعديل</button>
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="handleDeleteBundle('${b.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddBundleModal() {
  document.getElementById('bundleModalTitle').textContent = 'إنشاء باقة كومبو جديدة';
  document.getElementById('formBundleId').value = '';
  document.getElementById('formBundleName').value = '';
  document.getElementById('formBundleDesc').value = '';
  document.getElementById('formBundleOriginalPrice').value = '1500';
  document.getElementById('formBundlePriceEgp').value = '1199';
  document.getElementById('formBundlePriceUsd').value = '23.98';
  document.getElementById('formBundleImage').value = 'logos/chatgpt-plus.webp';
  const startsEl = document.getElementById('formBundleStartsAt');
  if (startsEl) startsEl.value = '';
  const expiresEl = document.getElementById('formBundleExpiresAt');
  if (expiresEl) expiresEl.value = '';
  const orderEl = document.getElementById('formBundleDisplayOrder');
  if (orderEl) orderEl.value = bundlesList.length + 1;
  document.getElementById('formBundleIsActive').checked = true;
  document.getElementById('formBundleIsFeatured').checked = true;

  renderBundleProductsPicker([]);
  calcBundleSavings();

  document.getElementById('bundleFormModal').style.display = 'block';
  document.getElementById('bundleModalBackdrop').style.display = 'block';
}

function openEditBundleModal(id) {
  const b = bundlesList.find(item => item.id === id);
  if (!b) return;

  document.getElementById('bundleModalTitle').textContent = `تعديل باقة: ${b.name}`;
  document.getElementById('formBundleId').value = b.id;
  document.getElementById('formBundleName').value = b.name;
  document.getElementById('formBundleDesc').value = b.description || '';
  document.getElementById('formBundleOriginalPrice').value = b.original_price_egp;
  document.getElementById('formBundlePriceEgp').value = b.price_egp;
  document.getElementById('formBundlePriceUsd').value = b.price_usd;
  document.getElementById('formBundleImage').value = b.image;
  const startsEl = document.getElementById('formBundleStartsAt');
  if (startsEl) startsEl.value = b.starts_at ? b.starts_at.slice(0, 16) : '';
  const expiresEl = document.getElementById('formBundleExpiresAt');
  if (expiresEl) expiresEl.value = b.expires_at ? b.expires_at.slice(0, 16) : '';
  const orderEl = document.getElementById('formBundleDisplayOrder');
  if (orderEl) orderEl.value = b.display_order || 1;
  document.getElementById('formBundleIsActive').checked = Boolean(b.is_active);
  document.getElementById('formBundleIsFeatured').checked = Boolean(b.is_featured);

  const selectedItems = (b.bundle_items || []).map(bi => ({ productId: bi.product_id, quantity: bi.quantity || 1 }));
  renderBundleProductsPicker(selectedItems);
  calcBundleSavings();

  document.getElementById('bundleFormModal').style.display = 'block';
  document.getElementById('bundleModalBackdrop').style.display = 'block';
}

function renderBundleProductsPicker(selectedItems = []) {
  const picker = document.getElementById('bundleProductsPicker');
  if (!picker) return;

  // selectedItems can be an array of IDs or array of objects { productId, quantity }
  const itemMap = new Map();
  selectedItems.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      itemMap.set(item.productId, item.quantity || 1);
    } else {
      itemMap.set(item, 1);
    }
  });

  picker.innerHTML = productsList.map(p => {
    const isChecked = itemMap.has(p.id);
    const qty = itemMap.get(p.id) || 1;
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 8px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);">
        <label style="display:flex; align-items:center; gap:8px; font-size:0.82rem; color:#fff; cursor:pointer; flex:1;">
          <input type="checkbox" name="bundle_prod" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="updateBundleOriginalPriceAuto()">
          <span>${escapeHtml(p.name)} <strong style="color:var(--cyan-bright); font-size:0.75rem;">(${p.priceEgp} ج.م)</strong></span>
        </label>
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="font-size:0.75rem; color:#94a3b8;">الكمية:</span>
          <input type="number" id="bundle_qty_${p.id}" value="${qty}" min="1" max="100" style="width:55px; padding:2px 6px; font-size:0.8rem; text-align:center; background:#060d1a; border:1px solid rgba(56,189,248,0.3); border-radius:4px; color:#fff;" oninput="updateBundleOriginalPriceAuto()">
        </div>
      </div>
    `;
  }).join('');
}

function updateBundleOriginalPriceAuto() {
  const checkboxes = document.querySelectorAll('input[name="bundle_prod"]:checked');
  let sum = 0;
  checkboxes.forEach(cb => {
    const p = productsList.find(item => item.id === cb.value);
    if (p) {
      const qtyInput = document.getElementById(`bundle_qty_${cb.value}`);
      const qty = qtyInput ? (Number(qtyInput.value) || 1) : 1;
      sum += (p.priceEgp * qty);
    }
  });

  const origInput = document.getElementById('formBundleOriginalPrice');
  if (origInput && sum > 0) origInput.value = sum;
  calcBundleSavings();
}

function calcBundleSavings() {
  const orig = Number(document.getElementById('formBundleOriginalPrice')?.value) || 0;
  const bundle = Number(document.getElementById('formBundlePriceEgp')?.value) || 0;
  const savings = Math.max(0, orig - bundle);
  const preview = document.getElementById('bundleSavingsPreview');
  if (preview) {
    preview.textContent = `توفير العميل المتوقع: ${savings.toLocaleString()} ج.م`;
  }
}

function closeBundleModal() {
  document.getElementById('bundleFormModal').style.display = 'none';
  document.getElementById('bundleModalBackdrop').style.display = 'none';
}

async function handleSaveBundle() {
  const editId = document.getElementById('formBundleId').value.trim();
  const name = document.getElementById('formBundleName').value.trim();
  const desc = document.getElementById('formBundleDesc').value.trim();
  const originalPrice = Number(document.getElementById('formBundleOriginalPrice').value) || 0;
  const bundlePrice = Number(document.getElementById('formBundlePriceEgp').value) || 0;
  const priceUsd = Number(document.getElementById('formBundlePriceUsd').value) || (bundlePrice / 50);
  const image = document.getElementById('formBundleImage').value.trim() || 'logos/chatgpt-plus.webp';
  const startsAt = document.getElementById('formBundleStartsAt')?.value || null;
  const expiresAt = document.getElementById('formBundleExpiresAt')?.value || null;
  const displayOrder = Number(document.getElementById('formBundleDisplayOrder')?.value) || 0;
  const isActive = document.getElementById('formBundleIsActive').checked;
  const isFeatured = document.getElementById('formBundleIsFeatured').checked;

  const selectedBoxes = document.querySelectorAll('input[name="bundle_prod"]:checked');
  const items = Array.from(selectedBoxes).map(cb => {
    const qtyInput = document.getElementById(`bundle_qty_${cb.value}`);
    const qty = qtyInput ? (Number(qtyInput.value) || 1) : 1;
    return { productId: cb.value, quantity: qty };
  });

  if (items.length < 2) {
    window.NexaUI.toast('الباقة يجب أن تحتوي على منتجين على الأقل.', 'warning');
    return;
  }

  const bundleData = {
    id: editId || ('bundle-' + Date.now()),
    name,
    description: desc,
    originalPriceEgp: originalPrice,
    priceEgp: bundlePrice,
    priceUsd: priceUsd,
    image,
    startsAt,
    expiresAt,
    displayOrder,
    isActive,
    isFeatured
  };

  try {
    showToast('جاري حفظ الباقة ومكوناتها في Supabase...');
    if (editId) {
      if (window.NexaSupabase && typeof window.NexaSupabase.bundles.update === 'function') {
        await window.NexaSupabase.bundles.update(editId, bundleData, items);
      }
    } else {
      if (window.NexaSupabase && typeof window.NexaSupabase.bundles.create === 'function') {
        await window.NexaSupabase.bundles.create(bundleData, items);
      }
    }

    closeBundleModal();
    await loadAllDashboardData();
    showToast('تم حفظ ونشر الباقة في المتجر بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ الباقة: ' + err.message, 'error');
  }
}

async function handleToggleBundleActive(id, isActive) {
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.bundles.toggleActive === 'function') {
      await window.NexaSupabase.bundles.toggleActive(id, isActive);
    }
    showToast(`تم ${isActive ? 'تفعيل' : 'تعطيل'} الباقة في المتجر.`);
  } catch (err) {
    showToast('❌ تعذر الحفظ: ' + err.message);
  }
}

async function handleDeleteBundle(id) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف الباقة المجمعة',
    message: 'هل أنت متأكد من حذف هذه الباقة نهائياً من قاعدة البيانات؟',
    confirmText: 'حذف نهائي',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.bundles.delete === 'function') {
      await window.NexaSupabase.bundles.delete(id);
    }
    await loadAllDashboardData();
    showToast('تم حذف الباقة بنجاح.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف الباقة: ' + err.message, 'error');
  }
}

// ===================================================================
// 9. MODULE 6: DYNAMIC PAYMENT METHODS
// ===================================================================
function renderPaymentsGrid() {
  const grid = document.getElementById('paymentsGrid');
  if (!grid) return;

  grid.innerHTML = paymentMethodsList.map(p => {
    return `
      <div class="management-card">
        <div>
          <div class="card-top-row">
            <div class="card-meta-icon"><i class="${p.currency === 'USD' ? 'fa-solid fa-coins' : (p.id.includes('insta') ? 'fa-solid fa-building-columns' : 'fa-solid fa-mobile-retro')}"></i></div>
            <span class="meta-pill">${p.currency}</span>
          </div>

          <h4 class="card-title">${escapeHtml(p.name)}</h4>
          <span style="font-size:0.75rem; color:var(--cyan-bright); font-family:var(--font-latin);">${p.code}</span>

          <div style="margin:10px 0; background:rgba(6,12,24,0.7); padding:10px; border-radius:8px; border:1px solid rgba(56,189,248,0.2);">
            <div style="font-size:0.78rem; color:#94a3b8;">${p.network ? `شبكة: <strong style="color:var(--cyan-bright);">${p.network}</strong>` : `الحساب: <strong>${p.account_name || 'Nexa'}</strong>`}</div>
            <div style="font-family:var(--font-latin); font-weight:700; color:#fff; word-break:break-all; font-size:0.9rem; margin-top:4px;">
              ${p.wallet_address || p.account_number || '-'}
            </div>
          </div>

          <p class="card-subtext" style="font-size:0.8rem;">${escapeHtml(p.instructions)}</p>
        </div>

        <div class="card-actions-bar">
          <div style="display:flex; align-items:center; gap:8px;">
            <label class="dash-switch" title="تفعيل أو تعطيل في صفحة الدفع">
              <input type="checkbox" ${p.is_active ? 'checked' : ''} onchange="handleTogglePaymentActive('${p.id}', this.checked)">
              <span class="switch-slider"></span>
            </label>
            <span style="font-size:0.75rem; color:${p.is_active ? '#34d399' : '#94a3b8'};">${p.is_active ? 'مفعلة بالدفع' : 'معطلة'}</span>
          </div>

          <div style="display:flex; gap:6px;">
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px;" onclick="openEditPaymentModal('${p.id}')"><i class="fa-solid fa-pen"></i> تعديل</button>
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="handleDeletePayment('${p.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function applyPaymentPreset(type) {
  if (type === 'vodafone') {
    document.getElementById('formPaymentName').value = 'فودافون كاش';
    document.getElementById('formPaymentCode').value = 'VODAFONE_CASH';
    document.getElementById('formPaymentAccount').value = '01012345678';
    document.getElementById('formPaymentHolder').value = 'ActivKeyz';
    document.getElementById('formPaymentCurrency').value = 'EGP';
    document.getElementById('formPaymentNetwork').value = '';
    document.getElementById('formPaymentWallet').value = '';
    document.getElementById('formPaymentInstructions').value = 'قم بتحويل المبلغ المطلوب إلى رقم فودافون كاش، ثم أرفق لقطة شاشة للإشعار أو رسالة التحويل لتأكيد الطلب فوراً.';
    document.getElementById('formPaymentRequiresReceipt').checked = true;
    showToast('تم تطبيق قالب فودافون كاش! 📱');
  } else if (type === 'instapay') {
    document.getElementById('formPaymentName').value = 'إنستاباي (InstaPay)';
    document.getElementById('formPaymentCode').value = 'INSTAPAY';
    document.getElementById('formPaymentAccount').value = 'activkeyz@instapay';
    document.getElementById('formPaymentHolder').value = 'ActivKeyz';
    document.getElementById('formPaymentCurrency').value = 'EGP';
    document.getElementById('formPaymentNetwork').value = 'IPA / Account';
    document.getElementById('formPaymentWallet').value = '';
    document.getElementById('formPaymentInstructions').value = 'أرسل التحويل عبر تطبيق إنستاباي إلى عنوان الدفع الموضح، ثم ارفع إيصال العملية لتأكيد طلبك.';
    document.getElementById('formPaymentRequiresReceipt').checked = true;
    showToast('تم تطبيق قالب إنستاباي! 🏦');
  } else if (type === 'usdt') {
    document.getElementById('formPaymentName').value = 'USDT (Tether TRC20)';
    document.getElementById('formPaymentCode').value = 'USDT_TRC20';
    document.getElementById('formPaymentAccount').value = '';
    document.getElementById('formPaymentHolder').value = 'Binance / Tron Wallet';
    document.getElementById('formPaymentCurrency').value = 'USD';
    document.getElementById('formPaymentNetwork').value = 'TRC20 (Tron)';
    document.getElementById('formPaymentWallet').value = 'TXxx1234567890ActivKeyzUSDT';
    document.getElementById('formPaymentInstructions').value = 'حول المبلغ المعادل بالدولار الرقمي USDT عبر شبكة TRC20 حصراً، ثم ارفع لقطة المعاملة أو TxID.';
    document.getElementById('formPaymentRequiresReceipt').checked = true;
    showToast('تم تطبيق قالب USDT TRC20! 🪙');
  }
}

function openAddPaymentModal() {
  document.getElementById('paymentModalTitle').textContent = 'إضافة وسيلة دفع جديدة';
  document.getElementById('formPaymentId').value = '';
  document.getElementById('formPaymentName').value = '';
  document.getElementById('formPaymentCode').value = '';
  document.getElementById('formPaymentAccount').value = '';
  document.getElementById('formPaymentHolder').value = '';
  document.getElementById('formPaymentCurrency').value = 'EGP';
  document.getElementById('formPaymentNetwork').value = '';
  document.getElementById('formPaymentWallet').value = '';
  document.getElementById('formPaymentInstructions').value = '';
  document.getElementById('formPaymentOrder').value = paymentMethodsList.length + 1;
  document.getElementById('formPaymentRequiresReceipt').checked = true;
  document.getElementById('formPaymentIsActive').checked = true;

  document.getElementById('paymentFormModal').style.display = 'block';
  document.getElementById('paymentModalBackdrop').style.display = 'block';
}

function openEditPaymentModal(id) {
  const p = paymentMethodsList.find(item => item.id === id);
  if (!p) return;

  document.getElementById('paymentModalTitle').textContent = `تعديل وسيلة دفع: ${p.name}`;
  document.getElementById('formPaymentId').value = p.id;
  document.getElementById('formPaymentName').value = p.name;
  document.getElementById('formPaymentCode').value = p.code;
  document.getElementById('formPaymentAccount').value = p.account_number || '';
  document.getElementById('formPaymentHolder').value = p.account_name || '';
  document.getElementById('formPaymentCurrency').value = p.currency || 'EGP';
  document.getElementById('formPaymentNetwork').value = p.network || '';
  document.getElementById('formPaymentWallet').value = p.wallet_address || '';
  document.getElementById('formPaymentInstructions').value = p.instructions || '';
  document.getElementById('formPaymentOrder').value = p.display_order || 1;
  document.getElementById('formPaymentRequiresReceipt').checked = Boolean(p.requires_receipt);
  document.getElementById('formPaymentIsActive').checked = Boolean(p.is_active);

  document.getElementById('paymentFormModal').style.display = 'block';
  document.getElementById('paymentModalBackdrop').style.display = 'block';
}

function closePaymentModal() {
  document.getElementById('paymentFormModal').style.display = 'none';
  document.getElementById('paymentModalBackdrop').style.display = 'none';
}

async function handleSavePaymentMethod() {
  const editId = document.getElementById('formPaymentId').value.trim();
  const name = document.getElementById('formPaymentName').value.trim();
  const code = document.getElementById('formPaymentCode').value.trim().toUpperCase();
  const account = document.getElementById('formPaymentAccount').value.trim();
  const holder = document.getElementById('formPaymentHolder').value.trim();
  const currency = document.getElementById('formPaymentCurrency').value;
  const network = document.getElementById('formPaymentNetwork').value.trim();
  const wallet = document.getElementById('formPaymentWallet').value.trim();
  const instructions = document.getElementById('formPaymentInstructions').value.trim();
  const order = Number(document.getElementById('formPaymentOrder').value) || 1;
  const requiresReceipt = document.getElementById('formPaymentRequiresReceipt').checked;
  const isActive = document.getElementById('formPaymentIsActive').checked;

  const id = editId || code.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const paymentData = {
    id,
    name,
    code,
    account_number: account || null,
    account_name: holder || null,
    currency,
    network: network || null,
    wallet_address: wallet || null,
    instructions,
    display_order: order,
    requires_receipt: requiresReceipt,
    is_active: isActive
  };

  try {
    showToast('جاري حفظ وسيلة الدفع في Supabase...');
    if (editId) {
      if (window.NexaSupabase && typeof window.NexaSupabase.payments.update === 'function') {
        await window.NexaSupabase.payments.update(editId, paymentData);
      }
    } else {
      if (window.NexaSupabase && typeof window.NexaSupabase.payments.create === 'function') {
        await window.NexaSupabase.payments.create(paymentData);
      }
    }

    closePaymentModal();
    await loadAllDashboardData();
    showToast('تم حفظ وسيلة الدفع بنجاح وتحديث صفحة الدفع فوراً! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ وسيلة الدفع: ' + err.message, 'error');
  }
}

async function handleTogglePaymentActive(id, isActive) {
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.payments.toggleActive === 'function') {
      await window.NexaSupabase.payments.toggleActive(id, isActive);
    }
    showToast(`تم ${isActive ? 'تفعيل' : 'إخفاء'} وسيلة الدفع من صفحة الشراء.`);
  } catch (err) {
    showToast('❌ تعذر الحفظ: ' + err.message);
  }
}

async function handleDeletePayment(id) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف وسيلة الدفع',
    message: `هل أنت متأكد من حذف وسيلة الدفع (${id})؟`,
    confirmText: 'حذف وسيلة الدفع',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.payments.delete === 'function') {
      await window.NexaSupabase.payments.delete(id);
    }
    await loadAllDashboardData();
    showToast('تم حذف وسيلة الدفع.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف وسيلة الدفع: ' + err.message, 'error');
  }
}

// ===================================================================
// 10. MODULE 7: ORDERS MANAGEMENT & DIGITAL FULFILLMENT CENTER
// ===================================================================
let currentOrderQueueFilter = 'all';

function setOrderQueueFilter(queueName, btnEl) {
  currentOrderQueueFilter = queueName;
  const tabs = document.querySelectorAll('.order-tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderOrdersTable();
}

function getCountryFlagEmoji(iso2) {
  if (!iso2) return '🇪🇬';
  const c = String(iso2).toUpperCase().trim();
  const flagMap = {
    'EG': '🇪🇬',
    'SA': '🇸🇦',
    'AE': '🇦🇪',
    'KW': '🇰🇼',
    'QA': '🇶🇦',
    'OM': '🇴🇲',
    'BH': '🇧🇭',
    'JO': '🇯🇴',
    'PS': '🇵🇸',
    'IQ': '🇮🇶',
    'LB': '🇱🇧',
    'SY': '🇸🇾',
    'LY': '🇱🇾',
    'SD': '🇸🇩',
    'YE': '🇾🇪',
    'MA': '🇲🇦',
    'DZ': '🇩🇿',
    'TN': '🇹🇳',
    'US': '🇺🇸',
    'GB': '🇬🇧',
    'DE': '🇩🇪',
    'FR': '🇫🇷',
    'TR': '🇹🇷'
  };
  if (flagMap[c]) return flagMap[c];
  try {
    return String.fromCodePoint(...[...c].map(char => 127397 + char.charCodeAt(0)));
  } catch(e) {
    return '🌐';
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  const countPill = document.getElementById('ordersTableCountPill');
  const payFilter = document.getElementById('dashOrderPayFilter')?.value || 'all';
  const fulFilter = document.getElementById('dashOrderFulFilter')?.value || 'all';
  const countryFilter = document.getElementById('dashOrderCountryFilter')?.value || 'all';
  const search = document.getElementById('dashOrderSearchInput')?.value.trim().toLowerCase() || '';

  if (!tbody) return;

  // 1. Update Queue Tab Counter Badges
  const cAll = ordersList.length;
  const cUnverified = ordersList.filter(o => (o.paymentStatus || 'unverified') === 'unverified').length;
  const cVerified = ordersList.filter(o => o.paymentStatus === 'verified' && o.fulfillmentStatus !== 'fulfilled').length;
  const cInProgress = ordersList.filter(o => o.fulfillmentStatus === 'in_progress').length;
  const cFulfilled = ordersList.filter(o => o.fulfillmentStatus === 'fulfilled').length;
  const cCancelled = ordersList.filter(o => o.paymentStatus === 'rejected' || o.fulfillmentStatus === 'cancelled').length;
  const cUnreadMsgs = ordersList.filter(o => (o.messages || []).some(m => m.senderType === 'customer' && !m.isReadByAdmin)).length;

  const elAll = document.getElementById('qCountAll');
  const elUnver = document.getElementById('qCountUnverified');
  const elVer = document.getElementById('qCountVerified');
  const elInProg = document.getElementById('qCountInProgress');
  const elFul = document.getElementById('qCountFulfilled');
  const elCanc = document.getElementById('qCountCancelled');
  const elUnread = document.getElementById('qCountUnreadMsgs');

  if (elAll) elAll.textContent = String(cAll);
  if (elUnver) elUnver.textContent = String(cUnverified);
  if (elVer) elVer.textContent = String(cVerified);
  if (elInProg) elInProg.textContent = String(cInProgress);
  if (elFul) elFul.textContent = String(cFulfilled);
  if (elCanc) elCanc.textContent = String(cCancelled);
  if (elUnread) elUnread.textContent = String(cUnreadMsgs);

  let filtered = [...ordersList];

  // 2. Apply Queue Filter
  if (currentOrderQueueFilter === 'unverified') {
    filtered = filtered.filter(o => (o.paymentStatus || 'unverified') === 'unverified');
  } else if (currentOrderQueueFilter === 'verified') {
    filtered = filtered.filter(o => o.paymentStatus === 'verified' && o.fulfillmentStatus !== 'fulfilled');
  } else if (currentOrderQueueFilter === 'in_progress') {
    filtered = filtered.filter(o => o.fulfillmentStatus === 'in_progress');
  } else if (currentOrderQueueFilter === 'fulfilled') {
    filtered = filtered.filter(o => o.fulfillmentStatus === 'fulfilled');
  } else if (currentOrderQueueFilter === 'cancelled_rejected') {
    filtered = filtered.filter(o => o.paymentStatus === 'rejected' || o.fulfillmentStatus === 'cancelled');
  } else if (currentOrderQueueFilter === 'unread_messages') {
    filtered = filtered.filter(o => (o.messages || []).some(m => m.senderType === 'customer' && !m.isReadByAdmin));
  }

  // 3. Apply Dropdown Filters
  if (payFilter !== 'all') {
    filtered = filtered.filter(o => o.paymentStatus === payFilter);
  }
  if (fulFilter !== 'all') {
    filtered = filtered.filter(o => o.fulfillmentStatus === fulFilter);
  }
  if (countryFilter !== 'all') {
    if (countryFilter === 'OTHER') {
      filtered = filtered.filter(o => !['EG', 'SA', 'AE', 'KW'].includes((o.phoneCountryCode || 'EG').toUpperCase()));
    } else {
      filtered = filtered.filter(o => (o.phoneCountryCode || 'EG').toUpperCase() === countryFilter);
    }
  }
  if (search) {
    filtered = filtered.filter(o =>
      (o.orderId && o.orderId.toLowerCase().includes(search)) ||
      (o.customerPhone && o.customerPhone.includes(search)) ||
      (o.customerEmail && o.customerEmail.toLowerCase().includes(search)) ||
      (o.customerName && o.customerName.toLowerCase().includes(search)) ||
      (o.phoneCountryName && o.phoneCountryName.toLowerCase().includes(search))
    );
  }

  if (countPill) countPill.textContent = `${filtered.length} من ${ordersList.length} طلب`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding: 40px; color: var(--text-dim);">
          <i class="fa-solid fa-receipt" style="font-size:2.5rem; color:var(--cyan-primary); margin-bottom:12px; display:block;"></i>
          <h4 style="color:#fff; margin-bottom:6px;">لا توجد طلبات في هذا القسم</h4>
          <p style="font-size:0.85rem;">ستظهر الطلبات الجديدة فور تسجيل عمليات الشراء أو تغيير الحالات.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const dateFormatted = formatArabicDateTime(order.createdAt);
    const hasUnread = (order.messages || []).some(m => m.senderType === 'customer' && !m.isReadByAdmin);

    const itemsSummary = (order.items && Array.isArray(order.items))
      ? order.items.map(i => `
          <div style="font-size:0.8rem; margin-bottom:3px;">
            <span style="font-weight:700; color:#fff;">• ${escapeHtml(i.name)}</span>
            <span style="color:var(--cyan-bright);">×${i.quantity || 1}</span>
            ${i.isBundle ? `<span class="badge-stock in_stock" style="font-size:0.65rem;">باقة</span>` : ''}
          </div>
        `).join('')
      : '<span style="color:#64748b;">لا توجد منتجات</span>';

    const cleanPhone = (order.phoneE164 || order.customerPhone || '').replace(/\D/g, '');
    const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('2') ? cleanPhone : (cleanPhone.startsWith('966') || cleanPhone.startsWith('971') || cleanPhone.startsWith('965')) ? cleanPhone : '2' + cleanPhone}` : '#';

    const receiptThumb = order.receiptImage
      ? `<div onclick="openReceiptLightbox('${order.receiptImage}', '${order.orderId}')" style="cursor:pointer; width:44px; height:44px; border-radius:8px; overflow:hidden; border:1px solid rgba(56,189,248,0.4); margin:0 auto; box-shadow:0 0 10px rgba(56,189,248,0.2);" title="معاينة الإيصال عبر رابط سحابي آمن">
          <img src="${order.receiptImage}" alt="إيصال التحويل" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='logos/vodafone.svg';">
        </div>`
      : `<span style="color:#64748b; font-size:0.75rem;">لا يوجد</span>`;

    // Delivery Preference Badge
    const pref = order.deliveryPreference || 'website';
    const prefBadge = pref === 'whatsapp'
      ? `<span class="delivery-pref-badge whatsapp" title="استلام عبر الواتساب"><i class="fa-brands fa-whatsapp"></i> واتساب</span>`
      : (pref === 'email'
        ? `<span class="delivery-pref-badge email" title="استلام عبر البريد"><i class="fa-solid fa-envelope"></i> البريد</span>`
        : `<span class="delivery-pref-badge website" title="استلام عبر الموقع"><i class="fa-solid fa-globe"></i> الموقع</span>`);

    const countryCode = order.phoneCountryCode || 'EG';
    const countryName = order.phoneCountryName || 'مصر';
    const flagEmoji = getCountryFlagEmoji(countryCode);

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="color:var(--cyan-bright); font-size:0.95rem;">${order.orderId}</strong>
            ${hasUnread ? `<span class="badge-unread-chat" title="رسالة جديدة بانتظار الرد"><i class="fa-solid fa-envelope"></i></span>` : ''}
          </div>
          <div style="font-size:0.72rem; color:#64748b;">${dateFormatted}</div>
        </td>
        <td style="font-size:0.8rem; color:#94a3b8;">${dateFormatted}</td>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(order.customerName || 'عميل')}</div>
          <div style="display:flex; align-items:center; gap:5px; margin:3px 0;">
            <span style="font-size:1rem;" title="دولة رقم الهاتف: ${escapeHtml(countryName)}">${flagEmoji}</span>
            <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">${escapeHtml(countryCode)}</span>
            <a href="${waLink}" target="_blank" style="color:var(--cyan-bright); font-size:0.82rem; text-decoration:none;" dir="ltr">
              <i class="fa-brands fa-whatsapp" style="color:#22c55e;"></i> ${escapeHtml(order.customerPhone || '-')}
            </a>
          </div>
          <div style="font-size:0.74rem; color:#64748b;">${escapeHtml(order.customerEmail || '-')}</div>
        </td>
        <td style="text-align:center;">${prefBadge}</td>
        <td>${itemsSummary}</td>
        <td>
          <div style="font-weight:800; color:#fff; font-size:1.05rem;">${(order.totalEgp || 0).toLocaleString()} ج.م</div>
          <div style="font-size:0.74rem; color:var(--cyan-primary);">${order.paymentMethod || 'فودافون كاش'}</div>
        </td>
        <td style="text-align:center;">${receiptThumb}</td>
        <td style="text-align:center;">${renderPaymentBadge(order.paymentStatus || 'unverified')}</td>
        <td style="text-align:center;">${renderFulfillmentBadge(order.fulfillmentStatus || 'unfulfilled')}</td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:6px;">
            <button class="dash-btn dash-btn-primary" style="padding:6px 12px; font-size:0.82rem;" onclick="openOrderDetailsModal('${order.orderId}')" title="فتح مساحة عمل إدارة وتسليم الطلب">
              <i class="fa-solid fa-box-open"></i> إدارة وتسليم
            </button>
            <button class="dash-btn dash-btn-ghost" style="padding:5px 8px; color:#ef4444;" onclick="handleDeleteOrder('${order.orderId}')" title="حذف الطلب">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderPaymentBadge(status) {
  if (status === 'verified') return `<span class="badge-pay verified"><i class="fa-solid fa-check"></i> مؤكد ✓</span>`;
  if (status === 'rejected') return `<span class="badge-pay rejected"><i class="fa-solid fa-xmark"></i> مرفوض ✗</span>`;
  if (status === 'refunded') return `<span class="badge-pay refunded"><i class="fa-solid fa-rotate-left"></i> مسترجع ↩</span>`;
  return `<span class="badge-pay unverified"><i class="fa-solid fa-hourglass-half"></i> قيد التحقق ⏳</span>`;
}

function renderFulfillmentBadge(status) {
  if (status === 'fulfilled') return `<span class="badge-ful fulfilled"><i class="fa-solid fa-check-double"></i> تم التسليم ✓</span>`;
  if (status === 'in_progress') return `<span class="badge-ful in_progress"><i class="fa-solid fa-spinner fa-spin"></i> جاري التجهيز</span>`;
  if (status === 'cancelled') return `<span class="badge-ful cancelled"><i class="fa-solid fa-ban"></i> ملغي ✗</span>`;
  return `<span class="badge-ful unfulfilled"><i class="fa-solid fa-clock"></i> غير منفذ ⏳</span>`;
}

// ===================================================================
// ADMIN ORDER WORKSPACE & SMART FULFILLMENT ENGINE
// ===================================================================
let currentWorkspaceOrder = null;
let currentWorkspaceActiveTab = 'overview';
let currentWorkspaceSelectedItemId = null;
let currentFulfillmentDraftsByItem = {};
let availableFulfillmentTemplates = [];

function switchOrderWorkspaceTab(tabName) {
  currentWorkspaceActiveTab = tabName;
  const navBtns = document.querySelectorAll('.workspace-nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  const activeBtn = document.getElementById(`btnWsTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (activeBtn) activeBtn.classList.add('active');

  const panes = document.querySelectorAll('.workspace-pane');
  panes.forEach(p => p.classList.remove('active'));

  const targetPane = document.getElementById(`paneWs${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if (targetPane) targetPane.classList.add('active');

  // Mark messages as read if admin switches to messages tab
  if (tabName === 'messages' && currentWorkspaceOrder) {
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.markMessagesRead === 'function') {
      window.NexaSupabase.orders.markMessagesRead(currentWorkspaceOrder.orderId, 'admin');
    }
    const badge = document.getElementById('wsUnreadChatBadge');
    if (badge) badge.style.display = 'none';
  }
}

async function openOrderDetailsModal(orderId) {
  let o = ordersList.find(item => item.orderId === orderId);
  if (!o) return;

  // Authoritative live refresh: Fetch fresh order details (fulfillments, drafts, messages) from Supabase
  if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.getById === 'function') {
    try {
      const freshOrder = await window.NexaSupabase.orders.getById(orderId);
      if (freshOrder && freshOrder.orderId) {
        o = { ...o, ...freshOrder };
        const idx = ordersList.findIndex(item => item.orderId === orderId);
        if (idx !== -1) ordersList[idx] = o;
      }
    } catch (e) {
      console.warn('Could not refresh full order details from Supabase:', e);
    }
  }

  currentWorkspaceOrder = o;
  currentWorkspaceActiveTab = 'overview';

  // Load available templates
  if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.getFulfillmentTemplates === 'function') {
    availableFulfillmentTemplates = await window.NexaSupabase.orders.getFulfillmentTemplates();
  }

  // Populate per-item fulfillment drafts/data
  currentFulfillmentDraftsByItem = {};
  const orderItems = (o.items && o.items.length > 0) ? o.items : [];

  for (const item of orderItems) {
    const itId = item.orderItemId || item.id;
    // Check if item has existing delivered fulfillment
    const existingFul = (o.fulfillments || []).find(f => (f.orderItemId && f.orderItemId === itId) || (f.order_item_id && f.order_item_id === itId)) || null;
    
    // Check if item has server/cached draft
    let draftData = null;
    if (o.pendingDrafts && Array.isArray(o.pendingDrafts)) {
      draftData = o.pendingDrafts.find(d => d.orderItemId === itId || d.order_item_id === itId);
    }
    if (!draftData && window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.getFulfillmentDraft === 'function') {
      const drafts = await window.NexaSupabase.orders.getFulfillmentDraft(o.orderId);
      draftData = (drafts || []).find(d => d.order_item_id === itId || d.orderItemId === itId);
    }

    const sourceData = draftData || existingFul || o.fulfillmentData || {};
    
    // Build initial blocks
    let initialBlocks = [];
    if (sourceData.content_blocks && Array.isArray(sourceData.content_blocks) && sourceData.content_blocks.length > 0) {
      initialBlocks = sourceData.content_blocks;
    } else if (sourceData.contentBlocks && Array.isArray(sourceData.contentBlocks) && sourceData.contentBlocks.length > 0) {
      initialBlocks = sourceData.contentBlocks;
    } else {
      // Synthesize blocks from flat fields for backward compatibility
      initialBlocks = synthesizeBlocksFromLegacy(sourceData, item);
    }

    currentFulfillmentDraftsByItem[itId] = {
      orderItemId: itId,
      productId: item.productId || item.id,
      productName: item.name,
      templateId: sourceData.template_id || sourceData.templateId || 'custom',
      fulfillmentType: sourceData.fulfillment_type || sourceData.fulfillmentType || sourceData.type || 'link',
      blocks: initialBlocks,
      status: (existingFul && existingFul.status) || 'draft',
      deliveredAt: (existingFul && existingFul.deliveredAt) || null,
      version: (existingFul && existingFul.version) || 1,
      revisionHistory: (existingFul && existingFul.revisionHistory) || []
    };
  }

  // Default selected item
  currentWorkspaceSelectedItemId = (orderItems[0] && (orderItems[0].orderItemId || orderItems[0].id)) || null;

  renderWorkspaceUI();

  document.getElementById('orderDetailsModal').style.display = 'block';
  document.getElementById('orderDetailsBackdrop').style.display = 'block';
}

function synthesizeBlocksFromLegacy(data, item) {
  const blocks = [];
  const prodName = item.name || 'الاشتراك الرقمي';
  blocks.push({
    id: 'block_' + Math.random().toString(36).substring(2, 8),
    type: 'heading',
    content: data.title || data.activationTitle || `بيانات تفعيل ${prodName}`
  });

  const linkOrCode = data.linkOrCode || data.activationUrl || data.licenseKey || '';
  const type = data.type || data.fulfillmentType || 'link';

  if (type === 'license') {
    blocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 8),
      type: 'license',
      label: 'كود / مفتاح التفعيل الرقمي',
      code: linkOrCode
    });
  } else if (type === 'credentials' || data.accountUser || data.accountUsername) {
    blocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 8),
      type: 'credentials',
      title: 'بيانات الحساب المجهز',
      username: data.accountUser || data.accountUsername || '',
      password: data.accountPass || data.accountPassword || '',
      loginUrl: data.loginUrl || ''
    });
  } else if (linkOrCode) {
    blocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 8),
      type: 'link',
      label: 'رابط التفعيل المباشر',
      url: linkOrCode,
      buttonText: 'تفعيل الاشتراك'
    });
  }

  const instructions = data.instructions || '';
  if (instructions) {
    blocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 8),
      type: 'guide',
      title: 'خطوات وتعليمات التفعيل',
      steps: instructions.split('\n').filter(s => s.trim().length > 0)
    });
  }

  const msg = data.message || data.customerMessage || '';
  if (msg) {
    blocks.push({
      id: 'block_' + Math.random().toString(36).substring(2, 8),
      type: 'message',
      content: msg
    });
  }

  blocks.push({
    id: 'block_' + Math.random().toString(36).substring(2, 8),
    type: 'warranty',
    text: 'ضمان كامل المدة المشتراة مع دعم فني متواصل من Activkeyz.'
  });

  return blocks;
}

function renderWorkspaceUI() {
  const o = currentWorkspaceOrder;
  if (!o) return;

  const titleEl = document.getElementById('orderDetailsTitle');
  const subEl = document.getElementById('orderWorkspaceSubtitle');
  const badgesEl = document.getElementById('orderWorkspaceStatusBadges');
  const contentEl = document.getElementById('orderDetailsContent');
  const footerEl = document.getElementById('orderDetailsFooter');

  titleEl.textContent = `مساحة عمل الطلب: ${o.orderId}`;
  subEl.textContent = `العميل: ${o.customerName || 'عميل'} • تاريخ الإنشاء: ${formatArabicDateTime(o.createdAt)}`;

  badgesEl.innerHTML = `
    ${renderPaymentBadge(o.paymentStatus || 'unverified')}
    ${renderFulfillmentBadge(o.fulfillmentStatus || 'unfulfilled')}
  `;

  const hasUnread = (o.messages || []).some(m => m.senderType === 'customer' && !m.isReadByAdmin);
  const unreadBadge = document.getElementById('wsUnreadChatBadge');
  if (unreadBadge) unreadBadge.style.display = hasUnread ? 'inline-block' : 'none';

  const countryCode = o.phoneCountryCode || 'EG';
  const countryName = o.phoneCountryName || 'مصر';
  const dialCode = o.phoneDialCode || '+20';
  const nationalNum = o.phoneNationalNumber || o.customerPhone || '';
  const e164Num = o.phoneE164 || o.customerPhone || '';
  const flagEmoji = getCountryFlagEmoji(countryCode);

  const cleanDigits = e164Num.replace(/\D/g, '');
  const waLink = cleanDigits ? `https://wa.me/${cleanDigits}` : (cleanPhone ? `https://wa.me/${cleanPhone.startsWith('2') ? cleanPhone : '2' + cleanPhone}` : '#');

  const pref = o.deliveryPreference || 'website';
  const prefInfo = pref === 'whatsapp'
    ? { icon: 'fa-brands fa-whatsapp', title: 'الاستلام عبر الواتساب', desc: `رقم الواتساب المسجل: ${nationalNum || o.customerPhone} (${dialCode})`, cls: 'whatsapp' }
    : (pref === 'email'
      ? { icon: 'fa-solid fa-envelope', title: 'الاستلام عبر البريد', desc: `البريد الإلكتروني: ${o.customerEmail}`, cls: 'email' }
      : { icon: 'fa-solid fa-globe', title: 'الاستلام عبر الموقع مباشرة', desc: 'يتم نشر بيانات التفعيل في صفحة الطلب المخصصة للعميل.', cls: 'website' });

  // Render Panes
  contentEl.innerHTML = `
    <!-- 1. OVERVIEW PANE -->
    <div class="workspace-pane ${currentWorkspaceActiveTab === 'overview' ? 'active' : ''}" id="paneWsOverview">
      <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:16px; margin-bottom:16px;">
        <!-- Customer Info -->
        <div style="background:rgba(6,12,24,0.7); padding:16px; border-radius:12px; border:1px solid rgba(56,189,248,0.2);">
          <span style="color:var(--cyan-bright); font-weight:800; font-size:0.88rem; display:block; margin-bottom:10px;">
            <i class="fa-solid fa-user-check"></i> بيانات العميل والتواصل
          </span>
          <div style="font-size:1.05rem; font-weight:800; color:#fff;">${escapeHtml(o.customerName)}</div>

          <!-- Structured International Phone Details Card -->
          <div style="margin-top:10px; background:rgba(56,189,248,0.06); border:1px solid rgba(56,189,248,0.2); padding:10px 12px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">
                <i class="fa-solid fa-earth-americas"></i> دولة رقم الهاتف:
              </span>
              <span style="font-size:0.85rem; color:#fff; font-weight:800;">
                ${flagEmoji} ${escapeHtml(countryName)} (${escapeHtml(countryCode)})
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:0.78rem;">
              <span style="color:#94a3b8;">مفتاح الاتصال الدولي:</span>
              <strong style="color:var(--cyan-bright);" dir="ltr">${escapeHtml(dialCode)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:0.78rem;">
              <span style="color:#94a3b8;">الرقم المحلي المسجل:</span>
              <strong style="color:#fff;" dir="ltr">${escapeHtml(nationalNum || '-')}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.1);">
              <span style="color:#94a3b8;">الصيغة الدولية الموحدة (E.164):</span>
              <strong style="color:#38bdf8;" dir="ltr">${escapeHtml(e164Num || '-')}</strong>
            </div>
          </div>

          <div style="margin-top:10px;">
            <a href="${waLink}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; color:#34d399; font-weight:700; font-size:0.88rem; text-decoration:none;">
              <i class="fa-brands fa-whatsapp" style="font-size:1.1rem;"></i> محادثة واتساب فورية (${escapeHtml(nationalNum || o.customerPhone)})
            </a>
          </div>
          <div style="margin-top:4px; font-size:0.85rem; color:#94a3b8;">
            <i class="fa-solid fa-envelope"></i> ${escapeHtml(o.customerEmail)}
          </div>
          ${o.notes ? `<div style="margin-top:10px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:8px 12px; border-radius:8px; color:#f59e0b; font-size:0.82rem;"><strong>ملاحظات العميل أثناء الطلب:</strong> ${escapeHtml(o.notes)}</div>` : ''}
        </div>

        <!-- Delivery Channel Preference -->
        <div style="background:rgba(6,12,24,0.7); padding:16px; border-radius:12px; border:1px solid rgba(56,189,248,0.2);">
          <span style="color:var(--cyan-bright); font-weight:800; font-size:0.88rem; display:block; margin-bottom:10px;">
            <i class="fa-solid fa-truck-fast"></i> قناة تسليم الاشتراك المفضلة
          </span>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <span class="delivery-pref-badge ${prefInfo.cls}" style="font-size:0.85rem; padding:4px 10px;">
              <i class="${prefInfo.icon}"></i> ${prefInfo.title}
            </span>
          </div>
          <p style="font-size:0.84rem; color:#cbd5e1; margin:0; line-height:1.5;">${prefInfo.desc}</p>
        </div>
      </div>

      <!-- Financial Summary Card -->
      <div style="background:rgba(6,12,24,0.7); padding:16px; border-radius:12px; border:1px solid rgba(56,189,248,0.2); margin-bottom:16px;">
        <span style="color:var(--cyan-bright); font-weight:800; font-size:0.88rem; display:block; margin-bottom:12px;">
          <i class="fa-solid fa-cart-shopping"></i> المنتجات المطلوبة والحساب المالي
        </span>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(o.items || []).map(it => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
              <div>
                <strong style="color:#fff; font-size:0.92rem;">• ${escapeHtml(it.name)}</strong>
                <span style="color:#94a3b8; font-size:0.8rem;">(${it.duration || 'اشتراك رسمي'})</span>
                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">الكمية: ${it.quantity || 1} • نوع التفعيل: ${escapeHtml(it.deliveryType || 'تفعيل مباشر')}</div>
              </div>
              <div style="text-align:left;">
                <span style="color:var(--cyan-bright); font-weight:800; font-size:0.95rem;">${((it.priceEgp || 0) * (it.quantity || 1)).toLocaleString()} ج.م</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
          <span style="font-weight:700; color:#fff;">إجمالي الطلب:</span>
          <span style="font-size:1.25rem; font-weight:900; color:var(--cyan-bright);">${(o.totalEgp || 0).toLocaleString()} ج.م <span style="font-size:0.85rem; color:#94a3b8;">($${o.totalUsd || '0.00'})</span></span>
        </div>
      </div>
    </div>

    <!-- 2. PAYMENT MANAGEMENT PANE -->
    <div class="workspace-pane ${currentWorkspaceActiveTab === 'payment' ? 'active' : ''}" id="paneWsPayment">
      <div style="background:rgba(6,12,24,0.7); padding:18px; border-radius:12px; border:1px solid rgba(56,189,248,0.2); margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <span style="color:var(--cyan-bright); font-weight:800; font-size:0.92rem;">
            <i class="fa-solid fa-money-bill-transfer"></i> مراجعة عملية التحويل وتوثيق الإيصال
          </span>
          <div>${renderPaymentBadge(o.paymentStatus || 'unverified')}</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
          <div>
            <div style="font-size:0.85rem; color:#94a3b8;">وسيلة الدفع:</div>
            <div style="font-size:1.05rem; font-weight:800; color:#fff; margin-top:2px;">${escapeHtml(o.paymentMethod || 'فودافون كاش')}</div>
            ${o.transferNumber ? `<div style="font-size:0.85rem; color:var(--cyan-bright); margin-top:4px;">رقم التحويل المرفق: <strong>${escapeHtml(o.transferNumber)}</strong></div>` : ''}
            <div style="font-size:0.85rem; color:#94a3b8; margin-top:10px;">المبلغ المطلوب:</div>
            <div style="font-size:1.25rem; font-weight:900; color:#fff; margin-top:2px;">${(o.totalEgp || 0).toLocaleString()} ج.م</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; justify-content:center;">
            ${o.paymentStatus !== 'verified' ? `
              <button type="button" class="dash-btn" style="background:#10b981; color:#fff; font-weight:800; padding:10px 16px;" onclick="handleVerifyPayment('${o.orderId}', 'verified')">
                <i class="fa-solid fa-check-circle"></i> تأكيد التحويل واعتماد الدفع رسمياً
              </button>
              <button type="button" class="dash-btn dash-btn-ghost" style="color:#ef4444; border-color:rgba(239,68,68,0.4); padding:9px 16px;" onclick="handleVerifyPayment('${o.orderId}', 'rejected')">
                <i class="fa-solid fa-xmark"></i> رفض إيصال التحويل لعدم المطابقة
              </button>
            ` : `
              <div style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); padding:12px; border-radius:10px; text-align:center; color:#34d399; font-weight:800;">
                <i class="fa-solid fa-circle-check"></i> الدفع معتمد وموثق رسمي في Supabase ✓
              </div>
            `}
          </div>
        </div>

        <!-- Receipt Image Preview -->
        ${o.receiptImage ? `
          <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div onclick="openReceiptLightbox('${o.receiptImage}', '${o.orderId}')" style="cursor:pointer; width:54px; height:54px; border-radius:8px; overflow:hidden; border:1px solid rgba(56,189,248,0.4);">
                <img src="${o.receiptImage}" alt="إيصال التحويل" style="width:100%; height:100%; object-fit:cover;">
              </div>
              <div>
                <span style="font-size:0.85rem; color:#fff; font-weight:700;">إيصال التحويل المرفوع من العميل</span>
                <div style="font-size:0.75rem; color:#64748b;">اضغط على المعاينة لتكبير الصورة وفحص تفاصيل المعاملة</div>
              </div>
            </div>
            <button type="button" class="dash-btn dash-btn-ghost" onclick="openReceiptLightbox('${o.receiptImage}', '${o.orderId}')">
              <i class="fa-solid fa-magnifying-glass-plus"></i> تكبير الإيصال
            </button>
          </div>
        ` : `
          <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:12px; color:#64748b; font-size:0.82rem;">
            لم يقم العميل برفع إيصال تحويل رقمي مع هذا الطلب.
          </div>
        `}
      </div>
    </div>

    <!-- 3. DIGITAL DELIVERY COMPOSER PANE -->
    <div class="workspace-pane ${currentWorkspaceActiveTab === 'delivery' ? 'active' : ''}" id="paneWsDelivery">
      <!-- Payment Prerequisite Alert -->
      ${o.paymentStatus !== 'verified' ? `
        <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); padding:12px 16px; border-radius:10px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; font-size:1.2rem;"></i>
            <span style="font-size:0.86rem; color:#fecaca;">
              <strong>حالة الدفع غير مؤكدة:</strong> زر النشر الفوري للعميل محجوب لحماية المتجر. يُرجى اعتماد الدفع من تبويب "إدارة الدفع" أولاً، أو يمكنك حفظ العمل كمسودة آمنة.
            </span>
          </div>
          <button type="button" class="dash-btn" style="background:#10b981; color:#fff; font-size:0.82rem; padding:6px 14px;" onclick="handleVerifyPayment('${o.orderId}', 'verified')">
            <i class="fa-solid fa-check"></i> اعتماد الدفع وتفعيل النشر
          </button>
        </div>
      ` : ''}

      <!-- Multi-Item Selector Strip -->
      ${(o.items && o.items.length > 1) ? `
        <div class="item-selection-strip">
          <span style="font-size:0.8rem; color:#94a3b8; font-weight:700;"><i class="fa-solid fa-layer-group"></i> عناصر الطلب:</span>
          ${o.items.map(it => {
            const itId = it.orderItemId || it.id;
            const draftState = currentFulfillmentDraftsByItem[itId] || {};
            const isDelivered = draftState.status === 'delivered';
            const isActive = currentWorkspaceSelectedItemId === itId;
            return `
              <button type="button" class="item-tab-pill ${isActive ? 'active' : ''}" onclick="selectWorkspaceItem('${itId}')">
                <span>${escapeHtml(it.name)}</span>
                ${isDelivered ? `<span style="color:#34d399; font-size:0.7rem;"><i class="fa-solid fa-circle-check"></i> تم التسليم</span>` : `<span style="color:#f59e0b; font-size:0.7rem;"><i class="fa-solid fa-pen-ruler"></i> مسودة</span>`}
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- Template Selector & Controls Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:rgba(6,14,28,0.7); padding:10px 14px; border-radius:10px; border:1px solid rgba(56,189,248,0.2); flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.82rem; color:var(--cyan-bright); font-weight:700;"><i class="fa-solid fa-wand-magic-sparkles"></i> القالب الجاهز:</span>
          <select id="wsTemplatePicker" onchange="applyWorkspaceTemplate(this.value)" style="padding:6px 10px; background:rgba(255,255,255,0.06); border:1px solid rgba(56,189,248,0.3); border-radius:8px; color:#fff; font-size:0.82rem;">
            <option value="custom">-- قالب مخصص بدون تعبئة --</option>
            ${availableFulfillmentTemplates.map(t => `
              <option value="${t.id}">${escapeHtml(t.name)}</option>
            `).join('')}
          </select>
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="dash-btn dash-btn-ghost" style="padding:6px 12px; font-size:0.8rem;" onclick="renderWorkspaceLivePreview()">
            <i class="fa-solid fa-eye"></i> تحديث المعاينة
          </button>
        </div>
      </div>

      <!-- Add Block Palette -->
      <div class="add-block-palette">
        <span style="font-size:0.78rem; color:#94a3b8; font-weight:700;"><i class="fa-solid fa-plus-circle"></i> إضافة قسم جديد للمنتج:</span>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('heading')"><i class="fa-solid fa-heading"></i> عنوان مخصص</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('message')"><i class="fa-solid fa-message"></i> رسالة للعميل</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('link')"><i class="fa-solid fa-link"></i> رابط تفعيل مباشر</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('license')"><i class="fa-solid fa-key"></i> مفتاح ترخيص / كود</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('guide')"><i class="fa-solid fa-list-ol"></i> خطوات تفعيل مرقمة</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('attachment')"><i class="fa-solid fa-paperclip"></i> صورة / إرفاق ملف</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('warning')"><i class="fa-solid fa-triangle-exclamation"></i> تنبيه هام</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('credentials')"><i class="fa-solid fa-user-lock"></i> بيانات حساب مجهز</button>
        <button type="button" class="btn-add-block-type" onclick="addWorkspaceBlock('warranty')"><i class="fa-solid fa-shield-halved"></i> شروط وضمان</button>
      </div>

      <!-- Blocks Editor Container -->
      <div id="wsBlocksContainer">
        <!-- Rendered by renderWorkspaceBlockEditor() -->
      </div>

      <!-- Live Customer Preview Box -->
      <div class="customer-live-preview-box" id="wsLivePreviewContainer">
        <!-- Rendered by renderWorkspaceLivePreview() -->
      </div>

      <!-- Actions Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:14px; border-top:1px solid rgba(56,189,248,0.25); flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:10px;">
          <button type="button" id="btnWsDeliverAction" class="dash-btn"
            style="${o.paymentStatus !== 'verified' ? 'background:#334155; color:#94a3b8; cursor:not-allowed;' : 'background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-weight:800; padding:10px 20px; box-shadow:0 0 16px rgba(16,185,129,0.3);'}"
            ${o.paymentStatus !== 'verified' ? 'disabled' : ''}
            onclick="handlePublishWorkspaceDelivery()">
            <i class="fa-solid fa-paper-plane"></i> نشر وتسليم المنتج للعميل فوراً
          </button>
          <button type="button" class="dash-btn dash-btn-ghost" onclick="handleSaveWorkspaceDraft()">
            <i class="fa-solid fa-floppy-disk"></i> حفظ كمسودة في Supabase
          </button>
        </div>

        <div style="display:flex; gap:8px;">
          <button type="button" class="dash-btn" style="background:#22c55e; color:#fff;" onclick="sendFulfillmentViaWhatsApp('${o.orderId}')">
            <i class="fa-brands fa-whatsapp"></i> مشاركة عبر الواتساب
          </button>
        </div>
      </div>
    </div>

    <!-- 4. CUSTOMER CONVERSATION & MESSAGING PANE -->
    <div class="workspace-pane ${currentWorkspaceActiveTab === 'messages' ? 'active' : ''}" id="paneWsMessages">
      <div class="workspace-chat-container">
        <div class="workspace-chat-stream" id="wsChatStream">
          ${renderWorkspaceChatMessages(o.messages || [])}
        </div>
        <form class="chat-composer-bar" onsubmit="event.preventDefault(); sendWorkspaceAdminMessage(false);">
          <input type="text" id="wsAdminChatInput" class="chat-composer-input" placeholder="اكتب ردك المباشر للعميل هنا...">
          <button type="button" class="dash-btn dash-btn-ghost" onclick="document.getElementById('wsMsgFileInput').click()" title="إرفاق صورة أو مستند">
            <i class="fa-solid fa-paperclip"></i>
          </button>
          <input type="file" id="wsMsgFileInput" style="display:none;" onchange="handleAdminMsgAttachment(this)">
          <button type="submit" class="dash-btn dash-btn-primary" style="padding:10px 18px;">
            <i class="fa-solid fa-paper-plane"></i> إرسال الرد
          </button>
        </form>
      </div>
    </div>

    <!-- 5. INTERNAL STAFF NOTES PANE -->
    <div class="workspace-pane ${currentWorkspaceActiveTab === 'notes' ? 'active' : ''}" id="paneWsNotes">
      <div style="background:rgba(6,12,24,0.7); padding:16px; border-radius:12px; border:1px solid rgba(56,189,248,0.2); margin-bottom:16px;">
        <span style="color:#f59e0b; font-weight:800; font-size:0.88rem; display:block; margin-bottom:8px;">
          <i class="fa-solid fa-user-shield"></i> ملاحظات فريق العمل الخاصة (غير مرئية للعميل إطلاقاً)
        </span>
        <textarea id="wsAdminInternalNoteText" rows="3" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(245,158,11,0.3); border-radius:8px; color:#fff; font-size:0.85rem;" placeholder="اكتب ملاحظة داخلية خاصة بالطلب..."></textarea>
        <div style="margin-top:10px; text-align:left;">
          <button type="button" class="dash-btn" style="background:#f59e0b; color:#000; font-weight:700;" onclick="addWorkspaceInternalNote()">
            <i class="fa-solid fa-plus"></i> إضافة ملاحظة داخلية
          </button>
        </div>
      </div>

      <div id="wsInternalNotesList" style="display:flex; flex-direction:column; gap:8px;">
        ${(o.messages || []).filter(m => m.isInternalNote).map(n => `
          <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:10px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:700; color:#f59e0b; font-size:0.82rem;"><i class="fa-solid fa-shield"></i> ${escapeHtml(n.senderName || 'المدير')}</span>
              <span style="font-size:0.72rem; color:#94a3b8;">${formatArabicDateTime(n.createdAt)}</span>
            </div>
            <div style="color:#fef3c7; font-size:0.85rem; line-height:1.5;">${escapeHtml(n.message)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 6. ACTIVITY AUDIT HISTORY PANE -->
    <div class="workspace-pane ${currentWorkspaceActiveTab === 'history' ? 'active' : ''}" id="paneWsHistory">
      <div style="background:rgba(6,12,24,0.7); padding:16px; border-radius:12px; border:1px solid rgba(56,189,248,0.2);">
        <span style="color:var(--cyan-bright); font-weight:800; font-size:0.88rem; display:block; margin-bottom:12px;">
          <i class="fa-solid fa-clock-rotate-left"></i> سجل النشاطات والتدقيق الكامل للطلب
        </span>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(o.statusHistory && o.statusHistory.length > 0) ? o.statusHistory.map(h => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); font-size:0.82rem;">
              <div>
                <strong style="color:#fff;">${escapeHtml(h.new_status || h.change_type || 'تحديث')}</strong>
                ${h.notes ? `<div style="color:#94a3b8; font-size:0.75rem; margin-top:2px;">${escapeHtml(h.notes)}</div>` : ''}
              </div>
              <div style="color:#64748b; font-size:0.74rem;">${formatArabicDateTime(h.created_at || h.timestamp)}</div>
            </div>
          `).join('') : '<div style="color:#64748b; font-size:0.82rem; text-align:center;">لا توجد حركات تدقيق مسجلة بعد.</div>'}
        </div>
      </div>
    </div>
  `;

  footerEl.innerHTML = `
    <div style="display:flex; gap:8px;">
      <a href="${waLink}" target="_blank" class="dash-btn dash-btn-ghost" style="color:#22c55e;">
        <i class="fa-brands fa-whatsapp"></i> مراسلة العميل عبر الواتساب
      </a>
      ${o.receiptImage ? `
        <button class="dash-btn dash-btn-ghost" onclick="openReceiptLightbox('${o.receiptImage}', '${o.orderId}')">
          <i class="fa-solid fa-receipt"></i> معاينة الإيصال
        </button>
      ` : ''}
    </div>
    <div>
      <button class="dash-btn dash-btn-ghost" onclick="closeOrderDetailsModal()">إغلاق مساحة العمل</button>
    </div>
  `;

  // Render initial block editor and live preview for the selected item
  renderWorkspaceBlockEditor();
  renderWorkspaceLivePreview();
}

function selectWorkspaceItem(itemId) {
  currentWorkspaceSelectedItemId = itemId;
  const pills = document.querySelectorAll('.item-tab-pill');
  pills.forEach(p => p.classList.toggle('active', p.getAttribute('onclick')?.includes(itemId)));
  renderWorkspaceBlockEditor();
  renderWorkspaceLivePreview();
}

function renderWorkspaceBlockEditor() {
  const container = document.getElementById('wsBlocksContainer');
  if (!container || !currentWorkspaceSelectedItemId) return;

  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) {
    container.innerHTML = '<div style="color:#94a3b8; padding:20px; text-align:center;">اختر عنصراً من عناصر الطلب بالأعلى لتحرير بيانات تسليمه.</div>';
    return;
  }

  const blocks = currentItemDraft.blocks || [];
  if (blocks.length === 0) {
    container.innerHTML = `
      <div style="background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.15); border-radius:12px; padding:30px; text-align:center;">
        <i class="fa-solid fa-cube" style="font-size:2rem; color:var(--cyan-bright); margin-bottom:10px; display:block;"></i>
        <h4 style="color:#fff; margin-bottom:6px;">لم يتم إضافة أقسام تسليم لهذا المنتج بعد</h4>
        <p style="color:#94a3b8; font-size:0.84rem;">اختر قالباً جاهزاً من الأعلى أو اضغط على أحد أزرار الإضافة لإدراج روابط، أكواد، تعليمات أو مرفقات.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = blocks.map((b, idx) => `
    <div class="composer-block-card" id="card_${b.id}">
      <div class="composer-block-header">
        <span class="composer-block-type-tag">
          ${renderBlockTypeIcon(b.type)} ${renderBlockTypeTitle(b.type)}
        </span>
        <div class="composer-block-controls">
          <button type="button" class="btn-block-ctrl" title="تحريك لأعلى" onclick="moveWorkspaceBlock('${b.id}', -1)" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button type="button" class="btn-block-ctrl" title="تحريك لأسفل" onclick="moveWorkspaceBlock('${b.id}', 1)" ${idx === blocks.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
            <i class="fa-solid fa-arrow-down"></i>
          </button>
          <button type="button" class="btn-block-ctrl danger" title="حذف هذا القسم" onclick="removeWorkspaceBlock('${b.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
      <div>
        ${renderBlockInputs(b)}
      </div>
    </div>
  `).join('');
}

function renderBlockTypeIcon(type) {
  switch (type) {
    case 'heading': return '<i class="fa-solid fa-heading"></i>';
    case 'message': return '<i class="fa-solid fa-comment-dots"></i>';
    case 'link': return '<i class="fa-solid fa-link"></i>';
    case 'license': return '<i class="fa-solid fa-key"></i>';
    case 'guide': return '<i class="fa-solid fa-list-ol"></i>';
    case 'attachment': return '<i class="fa-solid fa-paperclip"></i>';
    case 'warning': return '<i class="fa-solid fa-triangle-exclamation"></i>';
    case 'credentials': return '<i class="fa-solid fa-user-lock"></i>';
    case 'warranty': return '<i class="fa-solid fa-shield-halved"></i>';
    default: return '<i class="fa-solid fa-cube"></i>';
  }
}

function renderBlockTypeTitle(type) {
  switch (type) {
    case 'heading': return 'عنوان مخصص';
    case 'message': return 'رسالة للعميل';
    case 'link': return 'رابط تفعيل مباشر';
    case 'license': return 'كود ترخيص / مفتاح';
    case 'guide': return 'خطوات تفعيل مرقمة';
    case 'attachment': return 'مرفق صورة / لقطة شاشة';
    case 'warning': return 'تنبيه إرشادي هام';
    case 'credentials': return 'بيانات حساب مجهز';
    case 'warranty': return 'شروط وضمان الخدمة';
    default: return 'قسم محتوى';
  }
}

function renderBlockInputs(b) {
  switch (b.type) {
    case 'heading':
      return `
        <div class="form-group" style="margin-bottom:0;">
          <label>نص العنوان الرئيسي</label>
          <input type="text" value="${escapeHtml(b.content || '')}" oninput="updateWorkspaceBlock('${b.id}', { content: this.value })" placeholder="مثال: بيانات تفعيل اشتراكك الرسمي...">
        </div>
      `;
    case 'message':
      return `
        <div class="form-group" style="margin-bottom:0;">
          <label>الرسالة الموجهة للعميل</label>
          <textarea rows="2" oninput="updateWorkspaceBlock('${b.id}', { content: this.value })" placeholder="اكتب رسالة الترحيب أو الشكر أو التوجيه...">${escapeHtml(b.content || '')}</textarea>
        </div>
      `;
    case 'link':
      return `
        <div class="form-grid-2">
          <div class="form-group" style="margin-bottom:0;">
            <label>وصف / تسمية الرابط</label>
            <input type="text" value="${escapeHtml(b.label || 'رابط التفعيل المباشر')}" oninput="updateWorkspaceBlock('${b.id}', { label: this.value })">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>نص الزر</label>
            <input type="text" value="${escapeHtml(b.buttonText || 'تفعيل الاشتراك الآن')}" oninput="updateWorkspaceBlock('${b.id}', { buttonText: this.value })">
          </div>
        </div>
        <div class="form-group" style="margin-top:8px; margin-bottom:0;">
          <label>رابط التفعيل (Direct Activation URL) *</label>
          <input type="text" value="${escapeHtml(b.url || '')}" oninput="updateWorkspaceBlock('${b.id}', { url: this.value })" placeholder="https://example.com/activate?token=..." dir="ltr">
        </div>
      `;
    case 'license':
      return `
        <div class="form-group" style="margin-bottom:8px;">
          <label>تسمية المفتاح / الكود</label>
          <input type="text" value="${escapeHtml(b.label || 'مفتاح الترخيص / كود التفعيل')}" oninput="updateWorkspaceBlock('${b.id}', { label: this.value })">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>كود التفعيل (License Key) *</label>
          <input type="text" value="${escapeHtml(b.code || '')}" oninput="updateWorkspaceBlock('${b.id}', { code: this.value })" placeholder="XXXX-YYYY-ZZZZ-ULTRA" dir="ltr" style="font-family:var(--font-latin); font-weight:700; color:var(--cyan-bright);">
        </div>
      `;
    case 'guide':
      const stepsArr = Array.isArray(b.steps) ? b.steps : (typeof b.steps === 'string' ? b.steps.split('\n') : []);
      return `
        <div class="form-group" style="margin-bottom:8px;">
          <label>عنوان الدليل</label>
          <input type="text" value="${escapeHtml(b.title || 'خطوات التفعيل خطوة بخطوة')}" oninput="updateWorkspaceBlock('${b.id}', { title: this.value })">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>الخطوات (كل سطر يمثل خطوة مرقمة)</label>
          <textarea rows="3" oninput="updateWorkspaceBlock('${b.id}', { steps: this.value.split('\\n').filter(s=>s.trim().length>0) })" placeholder="1. افتح الرابط الموضح...\n2. سجل الدخول...\n3. اضغط تفعيل...">${escapeHtml(stepsArr.join('\n'))}</textarea>
        </div>
      `;
    case 'attachment':
      return `
        <div class="form-grid-2" style="align-items:center;">
          <div class="form-group" style="margin-bottom:0;">
            <label>وصف المرفق / الصورة</label>
            <input type="text" value="${escapeHtml(b.label || 'صورة توضيحية لخطوات التفعيل')}" oninput="updateWorkspaceBlock('${b.id}', { label: this.value })">
          </div>
          <div style="padding-top:18px;">
            <input type="file" id="file_${b.id}" style="display:none;" onchange="handleWorkspaceFileUpload(event, '${b.id}')">
            <button type="button" class="dash-btn dash-btn-ghost" onclick="document.getElementById('file_${b.id}').click()">
              <i class="fa-solid fa-upload"></i> ${b.url ? 'تغيير الملف المرفوع' : 'رفع صورة أو دليل PDF'}
            </button>
          </div>
        </div>
        ${b.url ? `
          <div style="margin-top:10px; display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">
            <i class="fa-solid fa-file-circle-check" style="color:#10b981;"></i>
            <span style="font-size:0.82rem; color:#fff; word-break:break-all;">${escapeHtml(b.fileName || b.url)}</span>
            <a href="${b.url}" target="_blank" style="color:var(--cyan-bright); font-size:0.78rem; text-decoration:none;">معاينة المرفق</a>
          </div>
        ` : ''}
      `;
    case 'warning':
      return `
        <div class="form-group" style="margin-bottom:0;">
          <label>نص التنبيه الهام</label>
          <input type="text" value="${escapeHtml(b.text || '')}" oninput="updateWorkspaceBlock('${b.id}', { text: this.value })" placeholder="مثال: يرجى عدم تغيير البريد الإلكتروني للحفاظ على الضمان...">
        </div>
      `;
    case 'credentials':
      return `
        <div class="form-grid-3">
          <div class="form-group" style="margin-bottom:0;">
            <label>اسم المستخدم / الإيميل</label>
            <input type="text" value="${escapeHtml(b.username || '')}" oninput="updateWorkspaceBlock('${b.id}', { username: this.value })" placeholder="user@example.com" dir="ltr">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>كلمة المرور السريّة</label>
            <input type="text" value="${escapeHtml(b.password || '')}" oninput="updateWorkspaceBlock('${b.id}', { password: this.value })" placeholder="********" dir="ltr">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>رابط الدخول</label>
            <input type="text" value="${escapeHtml(b.loginUrl || '')}" oninput="updateWorkspaceBlock('${b.id}', { loginUrl: this.value })" placeholder="https://..." dir="ltr">
          </div>
        </div>
      `;
    case 'warranty':
      return `
        <div class="form-group" style="margin-bottom:0;">
          <label>تفاصيل الضمان ومدة الصلاحية</label>
          <input type="text" value="${escapeHtml(b.text || '')}" oninput="updateWorkspaceBlock('${b.id}', { text: this.value })" placeholder="مثال: ضمان كامل المدة (سنة كاملة) مع تعويض فوري...">
        </div>
      `;
    default:
      return `<div style="color:#64748b; font-size:0.8rem;">قسم محتوى مخصص</div>`;
  }
}

function updateWorkspaceBlock(blockId, updates) {
  if (!currentWorkspaceSelectedItemId) return;
  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) return;

  const b = (currentItemDraft.blocks || []).find(item => item.id === blockId);
  if (b) {
    Object.assign(b, updates);
    renderWorkspaceLivePreview();
  }
}

function moveWorkspaceBlock(blockId, direction) {
  if (!currentWorkspaceSelectedItemId) return;
  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) return;

  const blocks = currentItemDraft.blocks || [];
  const idx = blocks.findIndex(b => b.id === blockId);
  if (idx < 0) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= blocks.length) return;

  const temp = blocks[idx];
  blocks[idx] = blocks[targetIdx];
  blocks[targetIdx] = temp;

  renderWorkspaceBlockEditor();
  renderWorkspaceLivePreview();
}

function removeWorkspaceBlock(blockId) {
  if (!currentWorkspaceSelectedItemId) return;
  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) return;

  currentItemDraft.blocks = (currentItemDraft.blocks || []).filter(b => b.id !== blockId);
  renderWorkspaceBlockEditor();
  renderWorkspaceLivePreview();
}

function addWorkspaceBlock(type) {
  if (!currentWorkspaceSelectedItemId) return;
  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) return;

  const newId = 'block_' + Math.random().toString(36).substring(2, 8);
  let newBlock = { id: newId, type };

  switch (type) {
    case 'heading': newBlock.content = 'عنوان جديد'; break;
    case 'message': newBlock.content = 'رسالة ترحيبية للعميل'; break;
    case 'link': newBlock.label = 'رابط التفعيل المباشر'; newBlock.url = ''; newBlock.buttonText = 'تفعيل الاشتراك'; break;
    case 'license': newBlock.label = 'مفتاح الترخيص / كود التفعيل'; newBlock.code = ''; break;
    case 'guide': newBlock.title = 'خطوات التفعيل السريع'; newBlock.steps = ['الخطوة الأولى', 'الخطوة الثانية']; break;
    case 'attachment': newBlock.label = 'صورة أو دليل توضيحي'; newBlock.url = ''; break;
    case 'warning': newBlock.text = 'تنبيه هام يرجى الانتباه له قبل الاستخدام.'; break;
    case 'credentials': newBlock.title = 'بيانات الحساب المجهز'; newBlock.username = ''; newBlock.password = ''; newBlock.loginUrl = ''; break;
    case 'warranty': newBlock.text = 'ضمان كامل المدة ضد التوقف مع دعم فني مستمر.'; break;
  }

  currentItemDraft.blocks.push(newBlock);
  renderWorkspaceBlockEditor();
  renderWorkspaceLivePreview();
}

function applyWorkspaceTemplate(templateId) {
  if (!currentWorkspaceSelectedItemId) return;
  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) return;

  if (templateId === 'custom') {
    currentItemDraft.templateId = 'custom';
    return;
  }

  const tmpl = availableFulfillmentTemplates.find(t => t.id === templateId);
  if (!tmpl) return;

  const blocksCopy = JSON.parse(JSON.stringify(tmpl.defaultBlocks || tmpl.default_blocks || []));
  // Ensure each block has unique ID
  blocksCopy.forEach(b => b.id = 'block_' + Math.random().toString(36).substring(2, 8));

  currentItemDraft.templateId = templateId;
  currentItemDraft.fulfillmentType = tmpl.defaultType || tmpl.default_type || 'link';
  currentItemDraft.blocks = blocksCopy;

  renderWorkspaceBlockEditor();
  renderWorkspaceLivePreview();
  showToast(`تم تطبيق قالب "${tmpl.name}" بنجاح! 🪄`);
}

async function handleWorkspaceFileUpload(event, blockId) {
  const file = event.target.files?.[0];
  if (!file || !currentWorkspaceOrder) return;

  try {
    showToast('جاري رفع الملف السحابي الآمن...');
    let res = null;
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.uploadAttachment === 'function') {
      res = await window.NexaSupabase.orders.uploadAttachment(file, currentWorkspaceOrder.orderId);
    }

    if (res) {
      updateWorkspaceBlock(blockId, {
        url: res.url,
        fileName: res.fileName,
        fileSize: res.fileSize,
        mimeType: res.mimeType,
        storagePath: res.storagePath
      });
      renderWorkspaceBlockEditor();
      renderWorkspaceLivePreview();
      showToast('تم رفع المرفق بنجاح! ✓');
    }
  } catch (err) {
    window.NexaUI.toast('فشل رفع الملف: ' + err.message, 'error');
  }
}

function renderWorkspaceLivePreview() {
  const previewBox = document.getElementById('wsLivePreviewContainer');
  if (!previewBox || !currentWorkspaceSelectedItemId) return;

  const currentItemDraft = currentFulfillmentDraftsByItem[currentWorkspaceSelectedItemId];
  if (!currentItemDraft) return;

  const blocks = currentItemDraft.blocks || [];

  previewBox.innerHTML = `
    <div class="customer-preview-badge">
      <i class="fa-solid fa-mobile-screen-button"></i> معاينة مباشرة لتجربة العميل (Customer View)
    </div>
    <div style="background:rgba(6,14,30,0.9); border:1px solid rgba(56,189,248,0.3); border-radius:12px; padding:18px;">
      <div style="font-weight:800; color:var(--cyan-bright); font-size:1.05rem; margin-bottom:12px;">
        📦 ${escapeHtml(currentItemDraft.productName || 'المنتج الرقمي')}
      </div>
      ${blocks.map(b => renderCustomerViewBlock(b)).join('')}
    </div>
  `;
}

function renderCustomerViewBlock(b) {
  switch (b.type) {
    case 'heading':
      return `<h3 style="color:#fff; font-size:1.1rem; margin:10px 0 6px; font-weight:800;">${escapeHtml(b.content || '')}</h3>`;
    case 'message':
      return `<p style="color:#cbd5e1; font-size:0.86rem; line-height:1.6; margin-bottom:10px;">${escapeHtml(b.content || '')}</p>`;
    case 'link':
      return `
        <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.3); padding:12px; border-radius:10px; margin:10px 0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="font-size:0.8rem; color:#94a3b8;">${escapeHtml(b.label || 'رابط التفعيل')}</div>
            <div style="font-family:var(--font-latin); color:#fff; font-weight:700; font-size:0.88rem; direction:ltr; word-break:break-all;">${escapeHtml(b.url || 'https://...')}</div>
          </div>
          ${b.url ? `<a href="${b.url}" target="_blank" class="dash-btn dash-btn-primary" style="padding:6px 14px; font-size:0.8rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escapeHtml(b.buttonText || 'تفعيل الآن')}</a>` : ''}
        </div>
      `;
    case 'license':
      return `
        <div style="background:rgba(6,12,24,0.95); border:1.5px dashed rgba(56,189,248,0.4); border-radius:10px; padding:12px; margin:10px 0;">
          <div style="font-size:0.78rem; color:#94a3b8;">${escapeHtml(b.label || 'مفتاح الترخيص')}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <code style="font-family:var(--font-latin); font-weight:800; color:var(--cyan-bright); font-size:1.1rem; direction:ltr;">${escapeHtml(b.code || 'NXA-XXXX-YYYY')}</code>
            <button type="button" class="dash-btn dash-btn-ghost" style="padding:4px 10px; font-size:0.75rem;" onclick="navigator.clipboard?.writeText('${escapeHtml(b.code || '')}'); showToast('تم نسخ الكود! ✓');">
              <i class="fa-solid fa-copy"></i> نسخ
            </button>
          </div>
        </div>
      `;
    case 'guide':
      const steps = Array.isArray(b.steps) ? b.steps : [];
      return `
        <div style="margin:12px 0;">
          <div style="font-weight:700; color:var(--cyan-bright); font-size:0.9rem; margin-bottom:6px;"><i class="fa-solid fa-list-ol"></i> ${escapeHtml(b.title || 'خطوات التفعيل')}</div>
          <ol style="margin:0; padding-right:20px; color:#cbd5e1; font-size:0.85rem; line-height:1.6;">
            ${steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        </div>
      `;
    case 'attachment':
      return b.url ? `
        <div style="margin:10px 0; border:1px solid rgba(56,189,248,0.25); border-radius:10px; overflow:hidden;">
          <div style="padding:6px 10px; background:rgba(0,0,0,0.5); font-size:0.78rem; color:#94a3b8;"><i class="fa-solid fa-image"></i> ${escapeHtml(b.label || 'صورة توضيحية')}</div>
          <img src="${b.url}" alt="" style="max-width:100%; max-height:240px; display:block; margin:0 auto; object-fit:contain;">
        </div>
      ` : '';
    case 'warning':
      return `
        <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:10px 14px; margin:10px 0; color:#fca5a5; font-size:0.82rem; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i>
          <span>${escapeHtml(b.text || '')}</span>
        </div>
      `;
    case 'credentials':
      return `
        <div style="background:rgba(8,18,36,0.9); border:1px solid rgba(56,189,248,0.3); border-radius:10px; padding:12px; margin:10px 0;">
          <div style="font-weight:700; color:#fff; font-size:0.85rem; margin-bottom:6px;"><i class="fa-solid fa-user-lock"></i> ${escapeHtml(b.title || 'بيانات الحساب المجهز')}</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.82rem;">
            <div><strong>الحساب:</strong> <span style="color:var(--cyan-bright); direction:ltr; display:inline-block;">${escapeHtml(b.username || '-')}</span></div>
            <div><strong>كلمة السر:</strong> <span style="color:#fff; direction:ltr; display:inline-block;">${escapeHtml(b.password || '-')}</span></div>
          </div>
        </div>
      `;
    case 'warranty':
      return `
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:8px; padding:8px 12px; margin:10px 0; color:#6ee7b7; font-size:0.8rem; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-shield-halved" style="color:#10b981;"></i>
          <span>${escapeHtml(b.text || '')}</span>
        </div>
      `;
    default:
      return '';
  }
}

async function handleSaveWorkspaceDraft() {
  const o = currentWorkspaceOrder;
  if (!o) return;

  const orderItems = (o.items && o.items.length > 0) ? o.items : [];
  const draftsPayload = [];

  for (const item of orderItems) {
    const itId = item.orderItemId || item.id;
    const itemDraft = currentFulfillmentDraftsByItem[itId];
    if (itemDraft) {
      draftsPayload.push({
        orderItemId: itId,
        productId: item.productId || item.id || null,
        productName: item.name,
        templateId: itemDraft.templateId || 'custom',
        type: itemDraft.fulfillmentType || 'composite',
        title: (itemDraft.blocks?.find(b => b.type === 'heading')?.content) || item.name,
        linkOrCode: (itemDraft.blocks?.find(b => b.type === 'link')?.url) || (itemDraft.blocks?.find(b => b.type === 'license')?.code) || '',
        instructions: (itemDraft.blocks?.find(b => b.type === 'guide')?.steps?.join('\n')) || '',
        message: (itemDraft.blocks?.find(b => b.type === 'message')?.content) || '',
        blocks: itemDraft.blocks || []
      });
    }
  }

  if (draftsPayload.length === 0) {
    window.NexaUI.toast('لا توجد مسودات صالحة للحفظ.', 'warning');
    return;
  }

  try {
    showToast('جاري حفظ المسودة في Supabase...');
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.saveFulfillmentDraft === 'function') {
      await window.NexaSupabase.orders.saveFulfillmentDraft(o.orderId, draftsPayload, 'مسودة تفعيل مجدولة من لوحة الإدارة');
    }
    await loadAllDashboardData();
    window.NexaUI.toast('تم حفظ مسودة التفعيل بنجاح في قاعدة البيانات! 💾', 'success');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ المسودة: ' + err.message, 'error');
  }
}

async function handlePublishWorkspaceDelivery() {
  const o = currentWorkspaceOrder;
  if (!o) return;

  // Prerequisite gate
  if (o.paymentStatus !== 'verified') {
    window.NexaUI.toast('لا يمكن تسليم الطلب قبل التحقق من صحة الدفع واعتماده أولاً.', 'error');
    return;
  }

  const orderItems = (o.items && o.items.length > 0) ? o.items : [];
  const itemFulfillments = [];

  for (const item of orderItems) {
    const itId = item.orderItemId || item.id;
    const itemDraft = currentFulfillmentDraftsByItem[itId];
    if (itemDraft && itemDraft.blocks && itemDraft.blocks.length > 0) {
      itemFulfillments.push({
        orderItemId: itId,
        productId: item.productId || item.id || null,
        productName: item.name,
        templateId: itemDraft.templateId || 'custom',
        type: itemDraft.fulfillmentType || 'composite',
        title: (itemDraft.blocks.find(b => b.type === 'heading')?.content) || item.name,
        linkOrCode: (itemDraft.blocks.find(b => b.type === 'link')?.url) || (itemDraft.blocks.find(b => b.type === 'license')?.code) || '',
        instructions: (itemDraft.blocks.find(b => b.type === 'guide')?.steps?.join('\n')) || '',
        message: (itemDraft.blocks.find(b => b.type === 'message')?.content) || '',
        blocks: itemDraft.blocks || [],
        deliveredAt: new Date().toISOString()
      });
    }
  }

  if (itemFulfillments.length === 0) {
    window.NexaUI.toast('يرجى إضافة أقسام التفعيل وتجهيز بيانات المنتج قبل التسليم.', 'warning');
    return;
  }

  const deliverBtn = document.getElementById('btnWsDeliverAction');
  const origHtml = deliverBtn ? deliverBtn.innerHTML : '';
  if (deliverBtn) {
    deliverBtn.disabled = true;
    deliverBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري النشر والتسليم...';
  }

  try {
    showToast('جاري نشر وتسليم الاشتراكات للعميل...');
    let res = null;
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.deliverOrder === 'function') {
      res = await window.NexaSupabase.orders.deliverOrder({
        orderId: o.orderId,
        fulfillmentData: itemFulfillments[0],
        itemFulfillments,
        adminNotes: `تم تسليم ${itemFulfillments.length} عنصر بواسطة المدير عبر محرر التسليم الذكي`,
        channel: o.deliveryPreference || 'website'
      });
    }

    await loadAllDashboardData();
    openOrderDetailsModal(o.orderId);

    if (res && (res.fulfillment_status === 'in_progress' || res.is_fully_fulfilled === false)) {
      window.NexaUI.toast(`⚡ تم تسليم العنصر بنجاح! حالة الطلب الآن: تسليم جزئي (${res.delivered_items_count || 1}/${res.total_order_items || orderItems.length}).`, 'info');
    } else {
      window.NexaUI.toast('🎉 تم تسليم ونشر جميع منتجات الطلب للعميل بنجاح واكتمال الطلب! (completed)', 'success');
    }
  } catch (err) {
    window.NexaUI.toast('فشل تسليم الطلب: ' + err.message, 'error');
  } finally {
    if (deliverBtn) {
      deliverBtn.disabled = false;
      deliverBtn.innerHTML = origHtml;
    }
  }
}

function renderWorkspaceChatMessages(messages) {
  if (!messages || messages.length === 0) {
    return `<div style="color:#64748b; font-size:0.84rem; text-align:center; padding:30px;">لا توجد رسائل متبادلة مع العميل بعد. يمكنك بدء المحادثة بكتابة رسالة أدناه.</div>`;
  }

  return messages.map(m => {
    const isInternal = m.isInternalNote;
    const isAdmin = m.senderType === 'admin';
    const cls = isInternal ? 'internal' : (isAdmin ? 'admin' : 'customer');
    const senderTitle = isInternal ? '🔒 ملاحظة داخلية للمدير' : (isAdmin ? 'فريق دعم ActivKeyz' : (m.senderName || 'العميل'));

    return `
      <div class="chat-bubble-msg ${cls}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:0.75rem;">
          <strong style="color:${isAdmin ? 'var(--cyan-bright)' : '#fff'};">${senderTitle}</strong>
          <span style="color:#64748b;">${formatArabicDateTime(m.createdAt)}</span>
        </div>
        <div style="font-size:0.86rem; line-height:1.5;">${escapeHtml(m.message)}</div>
        ${(m.attachments && m.attachments.length > 0) ? `
          <div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px;">
            ${m.attachments.map(att => `
              <a href="${att.url}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:6px; font-size:0.75rem; color:var(--cyan-bright); text-decoration:none;">
                <i class="fa-solid fa-paperclip"></i> ${escapeHtml(att.fileName || 'مرفق')}
              </a>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function sendWorkspaceAdminMessage(isInternal = false) {
  const o = currentWorkspaceOrder;
  if (!o) return;

  const input = document.getElementById('wsAdminChatInput');
  const msg = input?.value.trim();
  if (!msg) return;

  try {
    showToast('جاري إرسال الرسالة...');
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.addOrderMessage === 'function') {
      await window.NexaSupabase.orders.addOrderMessage({
        orderId: o.orderId,
        accessToken: null,
        message: msg,
        attachments: [],
        isInternal
      });
    }

    if (input) input.value = '';
    await loadAllDashboardData();
    openOrderDetailsModal(o.orderId);
    switchOrderWorkspaceTab('messages');
    showToast('تم إرسال ردك للعميل بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل إرسال الرسالة: ' + err.message, 'error');
  }
}

async function addWorkspaceInternalNote() {
  const o = currentWorkspaceOrder;
  if (!o) return;

  const textEl = document.getElementById('wsAdminInternalNoteText');
  const note = textEl?.value.trim();
  if (!note) return;

  try {
    showToast('جاري حفظ الملاحظة الداخلية...');
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.addOrderMessage === 'function') {
      await window.NexaSupabase.orders.addOrderMessage({
        orderId: o.orderId,
        accessToken: null,
        message: note,
        attachments: [],
        isInternal: true
      });
    }

    if (textEl) textEl.value = '';
    await loadAllDashboardData();
    openOrderDetailsModal(o.orderId);
    switchOrderWorkspaceTab('notes');
    showToast('تم حفظ الملاحظة الداخلية! 🔒');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ الملاحظة: ' + err.message, 'error');
  }
}

async function handleAdminMsgAttachment(input) {
  const file = input.files?.[0];
  if (!file || !currentWorkspaceOrder) return;

  try {
    showToast('جاري رفع المرفق...');
    const res = await window.NexaSupabase.orders.uploadAttachment(file, currentWorkspaceOrder.orderId);
    if (res) {
      await window.NexaSupabase.orders.addOrderMessage({
        orderId: currentWorkspaceOrder.orderId,
        accessToken: null,
        message: `تم إرفاق ملف: ${res.fileName}`,
        attachments: [res],
        isInternal: false
      });
      await loadAllDashboardData();
      openOrderDetailsModal(currentWorkspaceOrder.orderId);
      switchOrderWorkspaceTab('messages');
      showToast('تم إرسال المرفق للعميل بنجاح! ✓');
    }
  } catch (err) {
    window.NexaUI.toast('فشل إرفاق الملف: ' + err.message, 'error');
  }
}

async function handleVerifyPayment(orderId, status) {
  let notes = null;
  if (status === 'rejected') {
    notes = await window.NexaUI.prompt({
      title: 'سبب رفض التحويل',
      message: 'يرجى كتابة سبب عدم قبول إيصال التحويل لإعلام العميل وتدوينه في سجل التدقيق:',
      defaultValue: 'إيصال التحويل غير مطابق للمبلغ أو الحساب غير صحيح',
      confirmText: 'تأكيد الرفض',
      cancelText: 'تراجع'
    });
    if (notes === null) return;
  }

  try {
    window.NexaUI.toast(status === 'verified' ? 'جاري تأكيد واعتماد الدفع في Supabase...' : 'جاري رفض الإيصال...', 'info');
    if (window.NexaSupabase && window.NexaSupabase.orders && typeof window.NexaSupabase.orders.verifyPayment === 'function') {
      await window.NexaSupabase.orders.verifyPayment(orderId, status, notes);
    }
    await loadAllDashboardData();
    openOrderDetailsModal(orderId);
    window.NexaUI.toast(status === 'verified' ? 'تم تأكيد الدفع بنجاح! تم تفعيل زر تسليم الاشتراك الآن. ✓' : 'تم رفض الإيصال وتحديث حالة الطلب.', status === 'verified' ? 'success' : 'warning');
  } catch (err) {
    console.error('Verify payment error:', err);
    window.NexaUI.toast('فشل تحديث حالة الدفع: ' + (err.message || 'حدث خطأ أثناء الاتصال بالخادم'), 'error');
  }
}

function sendFulfillmentViaWhatsApp(orderId) {
  const o = ordersList.find(item => item.orderId === orderId);
  if (!o) return;

  const cleanPhone = (o.customerPhone || '').replace(/\D/g, '');
  if (!cleanPhone) {
    window.NexaUI.toast('لا يوجد رقم هاتف مسجل لهذا الطلب.', 'warning');
    return;
  }

  const orderItems = o.items || [];
  let itemsSummary = '';

  for (const it of orderItems) {
    const itId = it.orderItemId || it.id;
    const draft = currentFulfillmentDraftsByItem[itId] || {};
    const blocks = draft.blocks || [];
    const link = blocks.find(b => b.type === 'link')?.url || '';
    const code = blocks.find(b => b.type === 'license')?.code || '';
    const guide = blocks.find(b => b.type === 'guide')?.steps?.join('\n') || '';

    itemsSummary += `📦 المنتج: ${it.name}\n`;
    if (link) itemsSummary += `🔗 الرابط: ${link}\n`;
    if (code) itemsSummary += `🔑 الكود: ${code}\n`;
    if (guide) itemsSummary += `📝 الخطوات:\n${guide}\n`;
    itemsSummary += `\n`;
  }

  const text = `🌟 مرحباً ${o.customerName || 'عزيزنا العميل'}!\n` +
    `تم تجهيز وتسليم اشتراكك من Activkeyz بنجاح ✨\n` +
    `📋 رقم الطلب: ${o.orderId}\n\n` +
    itemsSummary +
    `شكراً لثقتكم بـ Activkeyz! 🚀`;

  const waUrl = `https://wa.me/${cleanPhone.startsWith('2') ? cleanPhone : '2' + cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

async function handleDeleteOrder(orderId) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف الطلب نهائياً',
    message: `هل أنت متأكد من حذف الطلب رقم (${orderId}) نهائياً من قاعدة البيانات؟`,
    confirmText: 'حذف الطلب نهائياً',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.orders.delete === 'function') {
      await window.NexaSupabase.orders.delete(orderId);
    }
    await loadAllDashboardData();
    showToast('تم حذف الطلب.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف الطلب: ' + err.message, 'error');
  }
}

// Receipt Lightbox
async function openReceiptLightbox(imgSrc, orderId) {
  const modal = document.getElementById('receiptLightboxModal');
  const backdrop = document.getElementById('receiptLightboxBackdrop');
  const img = document.getElementById('receiptLightboxImg');
  const ref = document.getElementById('receiptLightboxOrderRef');

  if (img) img.src = '';
  if (ref) ref.textContent = `طلب رقم: ${orderId} (جاري استرداد الرابط الآمن...)`;
  if (modal) modal.style.display = 'block';
  if (backdrop) backdrop.style.display = 'block';

  let resolvedUrl = imgSrc;
  if (window.NexaSupabase && window.NexaSupabase.storage && typeof window.NexaSupabase.storage.getReceiptUrl === 'function') {
    try {
      resolvedUrl = await window.NexaSupabase.storage.getReceiptUrl(imgSrc);
    } catch (e) {
      resolvedUrl = imgSrc;
    }
  }

  if (img) img.src = resolvedUrl;
  if (ref) ref.textContent = `طلب رقم: ${orderId}`;
  const fullBtn = document.getElementById('receiptLightboxOpenFullBtn');
  if (fullBtn) {
    fullBtn.href = resolvedUrl;
    fullBtn.style.display = resolvedUrl ? 'inline-flex' : 'none';
  }
}

function closeReceiptLightbox() {
  document.getElementById('receiptLightboxModal').style.display = 'none';
  document.getElementById('receiptLightboxBackdrop').style.display = 'none';
}

function exportOrdersJSON() {
  if (ordersList.length === 0) {
    showToast('لا توجد طلبات لتصديرها حالياً.');
    return;
  }
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ordersList, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `activkeyz_orders_backup_${Date.now()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
  showToast('تم تصدير ملف الطلبات JSON بنجاح!');
}

// ===================================================================
// 11. MODULE 8: CUSTOMERS & ROLES
// ===================================================================
function renderCustomersTable() {
  const tbody = document.getElementById('customersTableBody');
  const countPill = document.getElementById('customersCountPill');
  const search = document.getElementById('dashCustomersSearchInput')?.value.trim().toLowerCase() || '';

  if (!tbody) return;

  let filtered = Array.isArray(customersList) ? [...customersList] : [];
  if (search) {
    filtered = filtered.filter(c =>
      (c.full_name && c.full_name.toLowerCase().includes(search)) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search)) ||
      (c.id && c.id.toLowerCase().includes(search))
    );
  }

  if (countPill) countPill.textContent = `${filtered.length} مستخدم`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">لا يوجد عملاء مسجلين أو مطابقين للبحث في قاعدة البيانات.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    // Calculate customer orders & spending
    const custOrders = Array.isArray(ordersList) ? ordersList.filter(o => 
      o.customer_account_id === c.id || 
      o.user_id === c.id || 
      (o.customer_email && c.email && o.customer_email.toLowerCase() === c.email.toLowerCase())
    ) : [];
    const orderCount = custOrders.length;
    const verifiedSpend = custOrders
      .filter(o => o.payment_status === 'verified' || o.payment_status === 'paid' || o.status === 'completed')
      .reduce((sum, o) => sum + (parseFloat(o.total_price || o.total_egp || 0) || 0), 0);

    const maskedId = c.id ? `#NXA-${c.id.substring(0, 6).toUpperCase()}` : '-';
    const regDate = c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : '-';

    return `
      <tr>
        <td>
          <div style="font-weight:800; color:#fff; font-size:0.95rem;">${escapeHtml(c.full_name || 'عميل Nexa')}</div>
          <div style="font-family:var(--font-latin); font-size:0.75rem; color:#64748b; margin-top:3px;">
            <code style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; color:#38bdf8;">${maskedId}</code>
            <span style="margin-right:6px;">انضم: ${regDate}</span>
          </div>
        </td>
        <td>
          <div style="font-family:var(--font-latin); color:#e2e8f0; font-size:0.85rem;">
            <i class="fa-solid fa-phone" style="font-size:0.75rem; color:#94a3b8; margin-left:4px;"></i>${escapeHtml(c.phone || '-')}
          </div>
          <div style="font-family:var(--font-latin); font-size:0.75rem; color:#94a3b8; margin-top:2px;">
            <i class="fa-solid fa-envelope" style="font-size:0.7rem; color:#64748b; margin-left:4px;"></i>${escapeHtml(c.email || 'بدون بريد')}
          </div>
        </td>
        <td>
          <div style="font-weight:700; color:#38bdf8;">${orderCount} طلبات</div>
          <div style="font-size:0.8rem; color:#34d399; font-weight:800;">${verifiedSpend.toLocaleString('ar-EG')} ج.م</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-coins" style="color:#fbbf24; font-size:0.9rem;"></i>
            <span style="font-weight:800; color:#fbbf24; font-size:0.9rem;">${c.loyalty_balance !== undefined ? c.loyalty_balance + ' كوين' : 'محفظة معتمدة'}</span>
          </div>
        </td>
        <td>
          <span class="meta-pill" style="${c.role === 'admin' ? 'background:rgba(239,68,68,0.2); color:#f87171;' : 'background:rgba(56,189,248,0.15); color:#38bdf8;'}">
            ${c.role === 'admin' ? '<i class="fa-solid fa-shield"></i> مدير' : '<i class="fa-solid fa-user-check"></i> عميل'}
          </span>
        </td>
        <td style="text-align:center;">
          <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; font-size:0.72rem; color:#fbbf24; border-color:rgba(251,191,36,0.3);" title="تسوية أو منح كوينز" onclick="prefillLoyaltyAdjustment('${c.id}')">
              <i class="fa-solid fa-coins"></i> كوينز
            </button>
            <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; font-size:0.72rem;" onclick="handleToggleUserRole('${c.id}', '${c.role === 'admin' ? 'customer' : 'admin'}')">
              ${c.role === 'admin' ? 'إلغاء الإدارة' : 'ترقية لمدير'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleToggleUserRole(userId, newRole) {
  const ok = await window.NexaUI.confirm({
    title: 'تغيير صلاحية المستخدم',
    message: `هل أنت متأكد من تغيير صلاحية المستخدم إلى: (${newRole})؟`,
    confirmText: 'تأكيد تغيير الصلاحية',
    cancelText: 'إلغاء'
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.customers.updateRole === 'function') {
      await window.NexaSupabase.customers.updateRole(userId, newRole);
    }
    await loadAllDashboardData();
    showToast('تم تحديث صلاحية المستخدم بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل تعديل الصلاحية: ' + err.message, 'error');
  }
}

function prefillLoyaltyAdjustment(customerId) {
  switchDashboardTab('loyalty');
  setTimeout(() => {
    const sel = document.getElementById('loyaltyAdjustCustomerSelect');
    if (sel && customerId) {
      sel.value = customerId;
      document.getElementById('loyaltyAdjustAmount')?.focus();
    }
  }, 100);
}

// ===================================================================
// 11.B MODULE: Activkeyz Coins & LOYALTY REWARDS
// ===================================================================
async function renderLoyaltySection() {
  try {
    // 1. Populate Rules
    if (window.NexaSupabase && window.NexaSupabase.loyalty) {
      const rules = await window.NexaSupabase.loyalty.getRules();
      if (rules) {
        const earnInp = document.getElementById('ruleEarnRate');
        const redeemInp = document.getElementById('ruleRedeemRate');
        const minInp = document.getElementById('ruleMinRedeem');
        const maxPctInp = document.getElementById('ruleMaxDiscountPct');
        const allowFullInp = document.getElementById('ruleAllowFullPayment');

        if (earnInp) earnInp.value = rules.earn_rate_ratio ?? 0.10;
        if (redeemInp) redeemInp.value = rules.redeem_rate_egp ?? 0.50;
        if (minInp) minInp.value = rules.min_redeem_coins ?? 10;
        if (maxPctInp) maxPctInp.value = rules.max_discount_percentage ?? 50;
        if (allowFullInp) allowFullInp.checked = Boolean(rules.allow_full_coin_payment);
      }
    }
  } catch (err) {
    console.error('Failed to load loyalty rules:', err);
  }

  // 2. Populate Customer Select Dropdown for Manual Adjustment
  const custSelect = document.getElementById('loyaltyAdjustCustomerSelect');
  if (custSelect) {
    const currentVal = custSelect.value;
    custSelect.innerHTML = '<option value="">اختر العميل بالاسم أو رقم الهاتف...</option>' + 
      (Array.isArray(customersList) ? customersList.map(c => {
        const label = `${escapeHtml(c.full_name || 'عميل')} - ${c.phone || c.email || (c.id ? c.id.substring(0,8) : '')}`;
        return `<option value="${escapeHtml(c.id)}">${label}</option>`;
      }).join('') : '');
    if (currentVal) custSelect.value = currentVal;
  }

  // 3. Load Transactions Ledger
  await loadLoyaltyLedger();
}

async function handleSaveLoyaltyRules() {
  const saveBtn = document.getElementById('saveLoyaltyRulesBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
  }

  try {
    const rules = {
      is_enabled: true,
      earn_rate_ratio: parseFloat(document.getElementById('ruleEarnRate')?.value) || 0.10,
      redeem_rate_egp: parseFloat(document.getElementById('ruleRedeemRate')?.value) || 0.50,
      min_redeem_coins: parseInt(document.getElementById('ruleMinRedeem')?.value) || 10,
      max_discount_percentage: parseFloat(document.getElementById('ruleMaxDiscountPct')?.value) || 50,
      allow_full_coin_payment: document.getElementById('ruleAllowFullPayment')?.checked ?? true
    };

    if (window.NexaSupabase && window.NexaSupabase.loyalty) {
      await window.NexaSupabase.loyalty.updateRules(rules);
      window.NexaUI.toast('تم تحديث سياسات Activkeyz Coins بنجاح! ✓', 'success');
    }
  } catch (err) {
    console.error('Save loyalty rules failed:', err);
    window.NexaUI.toast('فشل تحديث القواعد: ' + (err.message || 'خطأ غير متوقع'), 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ وتحديث سياسات المكافآت';
    }
  }
}

async function handleAdminLoyaltyAdjust() {
  const customerId = document.getElementById('loyaltyAdjustCustomerSelect')?.value;
  const amount = parseInt(document.getElementById('loyaltyAdjustAmount')?.value);
  const reason = document.getElementById('loyaltyAdjustReason')?.value?.trim();

  if (!customerId) {
    window.NexaUI.toast('يرجى تحديد العميل المستهدف أولاً.', 'warning');
    return;
  }
  if (!amount || isNaN(amount) || amount === 0) {
    window.NexaUI.toast('يرجى إدخال عدد صحيح للكوينز (+ للإضافة أو - للخصم).', 'warning');
    return;
  }
  if (!reason) {
    window.NexaUI.toast('سبب التعديل إلزامي للتوثيق والمساءلة الرقابية (Audit Log).', 'warning');
    return;
  }

  const ok = await window.NexaUI.confirm({
    title: 'تأكيد التسوية اليدوية للكوينز',
    message: `هل أنت متأكد من تطبيق تعديل (${amount > 0 ? '+' + amount : amount} كوينز) للعميل المحدد؟\nالسبب: "${reason}"`,
    confirmText: 'تأكيد التسوية',
    cancelText: 'إلغاء'
  });
  if (!ok) return;

  const btn = document.getElementById('applyLoyaltyAdjustBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التطبيق...';
  }

  try {
    if (window.NexaSupabase && window.NexaSupabase.loyalty) {
      await window.NexaSupabase.loyalty.adminAdjustCoins({
        targetUserId: customerId,
        amount: amount,
        reason: reason
      });
      window.NexaUI.toast('تمت التسوية وتوثيقها في سجل التدقيق بنجاح! ✓', 'success');
      
      const amtInp = document.getElementById('loyaltyAdjustAmount');
      const rsnInp = document.getElementById('loyaltyAdjustReason');
      if (amtInp) amtInp.value = '';
      if (rsnInp) rsnInp.value = '';

      await loadLoyaltyLedger();
      await loadAllDashboardData();
    }
  } catch (err) {
    console.error('Loyalty adjust failed:', err);
    window.NexaUI.toast('فشل تطبيق التسوية: ' + (err.message || 'خطأ في الخادم'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> تطبيق التعديل وتوثيقه في السجل';
    }
  }
}

async function loadLoyaltyLedger() {
  const tbody = document.getElementById('loyaltyLedgerTableBody');
  const countPill = document.getElementById('loyaltyLedgerCountPill');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل سجل الحركات...</td></tr>';

  try {
    let txs = [];
    if (window.NexaSupabase && window.NexaSupabase.loyalty) {
      txs = await window.NexaSupabase.loyalty.getAllTransactions(100);
    }

    if (countPill) countPill.textContent = `${txs.length} حركة`;

    if (!Array.isArray(txs) || txs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">لا توجد حركات مسجلة في دفتر الأستاذ (Ledger) حتى الآن.</td></tr>';
      return;
    }

    tbody.innerHTML = txs.map(tx => {
      const isPositive = (tx.amount_coins || 0) > 0;
      const typeLabel = {
        'earn': 'كسب مشتريات',
        'redeem': 'استبدال بالطلب',
        'refund_reversal': 'استرجاع إلغاء',
        'admin_credit': 'منحة إدارية VIP',
        'admin_debit': 'خصم إداري',
        'legacy_claim': 'ترحيل طلب قديم'
      }[tx.transaction_type] || tx.transaction_type;

      const customer = Array.isArray(customersList) ? customersList.find(c => c.id === tx.user_id) : null;
      const custDisplay = customer ? `${customer.full_name || 'عميل'} (${tx.user_id.substring(0, 6)}...)` : (tx.user_id ? tx.user_id.substring(0, 8) + '...' : '-');
      const orderRef = tx.order_id ? `#${tx.order_id.substring(0, 8)}...` : '-';
      const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString('ar-EG') : '-';

      return `
        <tr>
          <td style="font-size:0.8rem; color:#94a3b8; font-family:var(--font-latin);">${dateStr}</td>
          <td><span class="meta-pill" style="font-size:0.75rem;">${escapeHtml(typeLabel)}</span></td>
          <td><strong style="color:#fff;">${escapeHtml(custDisplay)}</strong></td>
          <td style="font-family:var(--font-latin);">${orderRef}</td>
          <td>
            <strong style="color:${isPositive ? '#34d399' : '#f87171'}; font-size:0.95rem;">
              ${isPositive ? '+' : ''}${tx.amount_coins || 0} كوين
            </strong>
          </td>
          <td style="color:#cbd5e1; font-weight:700;">${tx.balance_after !== undefined ? tx.balance_after : '-'}</td>
          <td style="font-size:0.82rem; color:#94a3b8; max-width:260px;">${escapeHtml(tx.description || tx.reason || '-')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Load loyalty ledger failed:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#f87171;">فشل جلب سجل الحركات من السحابة.</td></tr>';
  }
}

// ===================================================================
// 12. MODULE 9: COUPONS & PROMOTIONS
// ===================================================================
function renderCouponsTable() {
  const tbody = document.getElementById('couponsTableBody');
  if (!tbody) return;

  if (!Array.isArray(couponsList) || couponsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">لا توجد أكواد خصم مسجلة حالياً في قاعدة البيانات. انقر على "إنشاء كود خصم" لإضافة أول كود.</td></tr>`;
    return;
  }

  tbody.innerHTML = couponsList.map(c => {
    const expStr = c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar-EG') : 'دائم (غير محدد)';
    const eligibleProd = c.applies_to_product_id ? (productsList.find(p => p.id === c.applies_to_product_id)?.name || c.applies_to_product_id) : 'كافة المنتجات';

    return `
      <tr>
        <td>
          <strong style="color:var(--cyan-bright); font-family:var(--font-latin); font-size:1rem;">${escapeHtml(c.code)}</strong>
          <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">ينتهي: ${expStr} | يسري على: ${escapeHtml(eligibleProd)}</div>
        </td>
        <td>${c.discount_type === 'percentage' ? 'نسبة مئوية (%)' : 'مبلغ ثابت (EGP)'}</td>
        <td style="font-weight:700; color:#fff;">${c.discount_value} ${c.discount_type === 'percentage' ? '%' : 'ج.م'}</td>
        <td>${c.min_order_value || 0} ج.م</td>
        <td>${c.max_discount_amount ? `${c.max_discount_amount} ج.م` : 'غير محدد'}</td>
        <td>${c.usage_count || 0} / ${c.usage_limit || '∞'}</td>
        <td>
          <label class="dash-switch">
            <input type="checkbox" ${c.is_active ? 'checked' : ''} onchange="handleToggleCouponActive('${c.id}', this.checked)">
            <span class="switch-slider"></span>
          </label>
        </td>
        <td style="text-align:center;">
          <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:var(--cyan-bright); margin-left:4px;" onclick="openEditCouponModal('${c.id}')" title="تعديل"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
          <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="handleDeleteCoupon('${c.id}')" title="حذف"><i class="fa-solid fa-trash"></i> حذف</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddCouponModal() {
  document.getElementById('couponModalTitle').textContent = 'إنشاء كود خصم جديد';
  document.getElementById('formCouponId').value = '';
  document.getElementById('formCouponCode').value = '';
  document.getElementById('formCouponType').value = 'percentage';
  document.getElementById('formCouponValue').value = '20';
  document.getElementById('formCouponMinOrder').value = '300';
  document.getElementById('formCouponMaxDiscount').value = '200';
  document.getElementById('formCouponUsageLimit').value = '100';
  const expEl = document.getElementById('formCouponExpiresAt');
  if (expEl) expEl.value = '';
  const eligEl = document.getElementById('formCouponEligibility');
  if (eligEl) eligEl.value = 'all';
  document.getElementById('formCouponIsActive').checked = true;

  document.getElementById('couponFormModal').style.display = 'block';
  document.getElementById('couponModalBackdrop').style.display = 'block';
}

function openEditCouponModal(id) {
  const c = couponsList.find(x => x.id === id);
  if (!c) return;

  document.getElementById('couponModalTitle').textContent = `تعديل كود الخصم: ${c.code}`;
  document.getElementById('formCouponId').value = c.id;
  document.getElementById('formCouponCode').value = c.code;
  document.getElementById('formCouponType').value = c.discount_type || 'percentage';
  document.getElementById('formCouponValue').value = c.discount_value;
  document.getElementById('formCouponMinOrder').value = c.min_order_value || 0;
  document.getElementById('formCouponMaxDiscount').value = c.max_discount_amount || '';
  document.getElementById('formCouponUsageLimit').value = c.usage_limit || '';
  const expEl = document.getElementById('formCouponExpiresAt');
  if (expEl) expEl.value = c.expires_at ? c.expires_at.slice(0, 16) : '';
  const eligEl = document.getElementById('formCouponEligibility');
  if (eligEl) eligEl.value = c.applies_to_product_id || 'all';
  document.getElementById('formCouponIsActive').checked = Boolean(c.is_active);

  document.getElementById('couponFormModal').style.display = 'block';
  document.getElementById('couponModalBackdrop').style.display = 'block';
}

function closeCouponModal() {
  document.getElementById('couponFormModal').style.display = 'none';
  document.getElementById('couponModalBackdrop').style.display = 'none';
}

async function handleSaveCoupon() {
  const editId = document.getElementById('formCouponId').value.trim();
  const code = document.getElementById('formCouponCode').value.trim().toUpperCase();
  const type = document.getElementById('formCouponType').value;
  const value = Number(document.getElementById('formCouponValue').value) || 0;
  const minOrder = Number(document.getElementById('formCouponMinOrder').value) || 0;
  const maxDiscountRaw = document.getElementById('formCouponMaxDiscount').value.trim();
  const maxDiscount = maxDiscountRaw ? Number(maxDiscountRaw) : null;
  const usageLimitRaw = document.getElementById('formCouponUsageLimit').value.trim();
  const usageLimit = usageLimitRaw ? Number(usageLimitRaw) : null;
  const expiresAt = document.getElementById('formCouponExpiresAt')?.value || null;
  const eligibility = document.getElementById('formCouponEligibility')?.value;
  const appliesToProductId = (eligibility && eligibility !== 'all') ? eligibility : null;
  const isActive = document.getElementById('formCouponIsActive').checked;

  if (!code) {
    window.NexaUI.toast('يرجى إدخال رمز الكوبون', 'warning');
    return;
  }

  const couponData = {
    code,
    discount_type: type,
    discount_value: value,
    min_order_value: minOrder,
    max_discount_amount: maxDiscount,
    usage_limit: usageLimit,
    expires_at: expiresAt,
    applies_to_product_id: appliesToProductId,
    is_active: isActive
  };

  try {
    showToast('جاري حفظ الكوبون في Supabase...');
    if (editId) {
      if (window.NexaSupabase && typeof window.NexaSupabase.coupons.update === 'function') {
        await window.NexaSupabase.coupons.update(editId, couponData);
      }
    } else {
      if (window.NexaSupabase && typeof window.NexaSupabase.coupons.create === 'function') {
        await window.NexaSupabase.coupons.create(couponData);
      }
    }

    closeCouponModal();
    await loadAllDashboardData();
    showToast('تم حفظ وتفعيل الكوبون بنجاح في قاعدة البيانات! ✓');
  } catch (err) {
    console.error('Save coupon error:', err);
    window.NexaUI.toast('فشل حفظ الكوبون: ' + (err.message || err), 'error');
  }
}

async function handleToggleCouponActive(id, isActive) {
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.coupons.toggleActive === 'function') {
      await window.NexaSupabase.coupons.toggleActive(id, isActive);
    }
    showToast(`تم ${isActive ? 'تفعيل' : 'تعطيل'} الكوبون.`);
  } catch (err) {
    showToast('❌ تعذر الحفظ: ' + err.message);
  }
}

async function handleDeleteCoupon(id) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف الكوبون',
    message: 'هل أنت متأكد من حذف هذا الكوبون الترويجي نهائياً؟',
    confirmText: 'حذف الكوبون',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.coupons.delete === 'function') {
      await window.NexaSupabase.coupons.delete(id);
    }
    await loadAllDashboardData();
    showToast('تم حذف الكوبون.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف الكوبون: ' + err.message, 'error');
  }
}

// ===================================================================
// 13. MODULE 10: REVIEWS MODERATION
// ===================================================================
function renderReviewsTable() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;

  tbody.innerHTML = reviewsList.map(r => `
    <tr>
      <td><strong style="color:#fff;">${escapeHtml(r.customer_name)}</strong></td>
      <td>${escapeHtml(r.product_name)}</td>
      <td style="color:#fbbf24;">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</td>
      <td style="font-size:0.85rem; max-width:280px;">${escapeHtml(r.comment)}</td>
      <td>
        <span class="meta-pill" style="${r.is_approved ? 'background:rgba(16,185,129,0.15); color:#34d399;' : 'background:rgba(251,191,36,0.15); color:#fbbf24;'}">
          ${r.is_approved ? 'معتمد ومنشور' : 'بانتظار الموافقة'}
        </span>
      </td>
      <td style="font-size:0.8rem; color:#94a3b8;">${new Date(r.created_at || Date.now()).toLocaleDateString('ar-EG')}</td>
      <td style="text-align:center;">
        <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; font-size:0.75rem;" onclick="handleToggleReviewApproval('${r.id}', ${!r.is_approved})">
          ${r.is_approved ? 'إخفاء' : 'موافقة ونشر ✓'}
        </button>
        <button class="dash-btn dash-btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="handleDeleteReview('${r.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

async function handleToggleReviewApproval(id, isApproved) {
  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.reviews.toggleApproval === 'function') {
      await window.NexaSupabase.reviews.toggleApproval(id, isApproved);
    }
    await loadAllDashboardData();
    showToast(`تم ${isApproved ? 'نشر' : 'إخفاء'} التقييم.`);
  } catch (err) {
    window.NexaUI.toast('فشل تحديث التقييم: ' + err.message, 'error');
  }
}

async function handleDeleteReview(id) {
  const ok = await window.NexaUI.confirm({
    title: 'حذف التقييم',
    message: 'هل أنت متأكد من حذف هذا التقييم نهائياً؟',
    confirmText: 'حذف التقييم',
    cancelText: 'إلغاء',
    isDestructive: true
  });
  if (!ok) return;

  try {
    if (window.NexaSupabase && typeof window.NexaSupabase.reviews.delete === 'function') {
      await window.NexaSupabase.reviews.delete(id);
    }
    await loadAllDashboardData();
    showToast('تم حذف التقييم.');
  } catch (err) {
    window.NexaUI.toast('فشل حذف التقييم: ' + err.message, 'error');
  }
}

// ===================================================================
// 14. MODULE 11: SUPPORT TICKETS
// ===================================================================
function renderTicketsTable() {
  const tbody = document.getElementById('ticketsTableBody');
  if (!tbody) return;

  tbody.innerHTML = ticketsList.map(t => `
    <tr>
      <td><strong style="color:var(--cyan-bright); font-family:var(--font-latin);">${t.ticket_number}</strong></td>
      <td>${escapeHtml(t.customer_name)} (${escapeHtml(t.customer_email)})</td>
      <td><strong>${escapeHtml(t.subject)}</strong></td>
      <td style="font-size:0.85rem; max-width:240px; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.message)}</td>
      <td><span class="meta-pill">${t.status}</span></td>
      <td style="font-size:0.8rem; color:#94a3b8;">${new Date(t.created_at || Date.now()).toLocaleDateString('ar-EG')}</td>
      <td style="text-align:center;">
        <button class="dash-btn dash-btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="openTicketReplyModal('${t.id}')">
          <i class="fa-solid fa-reply"></i> الرد
        </button>
      </td>
    </tr>
  `).join('');
}

let activeTicketId = null;

function openTicketReplyModal(id) {
  const t = ticketsList.find(item => item.id === id);
  if (!t) return;
  activeTicketId = t.id;

  const body = document.getElementById('ticketModalBody');
  if (body) {
    body.innerHTML = `
      <div style="background:rgba(6,12,24,0.7); padding:12px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(56,189,248,0.2);">
        <div>العميل: <strong>${escapeHtml(t.customer_name)}</strong> (${escapeHtml(t.customer_email)})</div>
        <div style="margin-top:4px;">الموضوع: <strong>${escapeHtml(t.subject)}</strong></div>
        <div style="margin-top:6px; color:#cbd5e1; font-size:0.88rem;">الرسالة: "${escapeHtml(t.message)}"</div>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>حالة التذكرة</label>
        <select id="modalTicketStatus">
          <option value="open" ${t.status === 'open' ? 'selected' : ''}>مفتوحة (Open)</option>
          <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>قيد المتابعة (In Progress)</option>
          <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>تم الحل والرد (Resolved)</option>
        </select>
      </div>
      <div class="form-group">
        <label>الرد الإداري على العميل</label>
        <textarea id="modalTicketReply" rows="3" placeholder="اكتب ردك للعميل هنا...">${escapeHtml(t.admin_reply || '')}</textarea>
      </div>
    `;
  }

  document.getElementById('ticketModal').style.display = 'block';
  document.getElementById('ticketModalBackdrop').style.display = 'block';
}

function closeTicketModal() {
  document.getElementById('ticketModal').style.display = 'none';
  document.getElementById('ticketModalBackdrop').style.display = 'none';
}

async function submitTicketReply() {
  if (!activeTicketId) return;
  const status = document.getElementById('modalTicketStatus').value;
  const reply = document.getElementById('modalTicketReply').value.trim();

  try {
    showToast('جاري تحديث التذكرة في Supabase...');
    if (window.NexaSupabase && typeof window.NexaSupabase.tickets.updateStatus === 'function') {
      await window.NexaSupabase.tickets.updateStatus(activeTicketId, status, reply);
    }
    closeTicketModal();
    await loadAllDashboardData();
    showToast('تم تحديث التذكرة بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل الرد على التذكرة: ' + err.message, 'error');
  }
}

// ===================================================================
// 15. MODULE 12: COMPLETE STORE SETTINGS
// ===================================================================
function renderSettingsForm() {
  const storeInfo = storeSettingsMap.store_info || {};
  const currency = storeSettingsMap.currency_config || {};
  const announcement = storeSettingsMap.announcement || {};
  const promo = storeSettingsMap.promotions || {};
  const maint = storeSettingsMap.maintenance_mode || {};

  const nameEl = document.getElementById('settingStoreName');
  const emailEl = document.getElementById('settingStoreEmail');
  const phoneEl = document.getElementById('settingStorePhone');
  const waEl = document.getElementById('settingStoreWhatsapp');
  const tgEl = document.getElementById('settingStoreTelegram');
  const usdEl = document.getElementById('settingUsdRate');
  const annTxtEl = document.getElementById('settingAnnouncementText');
  const annActiveEl = document.getElementById('settingAnnouncementActive');
  const globDiscEl = document.getElementById('settingGlobalDiscount');
  const maintActiveEl = document.getElementById('settingMaintenanceMode');
  const maintMsgEl = document.getElementById('settingMaintenanceMsg');

  if (nameEl) nameEl.value = storeInfo.store_name || 'ActivKeyz';
  if (emailEl) emailEl.value = storeInfo.email || 'support@activkeyz.com';
  if (phoneEl) phoneEl.value = storeInfo.phone || '01225106057';
  if (waEl) waEl.value = storeInfo.whatsapp || '201225106057';
  if (tgEl) tgEl.value = storeInfo.telegram || 'https://t.me/activkeyz_support';
  if (usdEl) usdEl.value = currency.usd_egp_rate || 50.0;
  if (annTxtEl) annTxtEl.value = announcement.text || 'مرحباً بكم في متجر نكسا الرقمي!';
  if (annActiveEl) annActiveEl.checked = Boolean(announcement.active);
  if (globDiscEl) globDiscEl.value = promo.global_discount_percent || 0;
  if (maintActiveEl) maintActiveEl.checked = Boolean(maint.enabled);
  if (maintMsgEl) maintMsgEl.value = maint.message || 'المتجر في وضع الصيانة الدورية.';
}

async function handleSaveStoreSettings() {
  const storeName = document.getElementById('settingStoreName')?.value.trim();
  const storeEmail = document.getElementById('settingStoreEmail')?.value.trim();
  const storePhone = document.getElementById('settingStorePhone')?.value.trim();
  const storeWhatsapp = document.getElementById('settingStoreWhatsapp')?.value.trim() || storePhone;
  const storeTelegram = document.getElementById('settingStoreTelegram')?.value.trim() || '';
  const usdRate = Number(document.getElementById('settingUsdRate')?.value) || 50.0;
  const annText = document.getElementById('settingAnnouncementText')?.value.trim();
  const annActive = document.getElementById('settingAnnouncementActive')?.checked;
  const globalDiscount = Number(document.getElementById('settingGlobalDiscount')?.value) || 0;
  const maintEnabled = document.getElementById('settingMaintenanceMode')?.checked;
  const maintMsg = document.getElementById('settingMaintenanceMsg')?.value.trim();

  try {
    showToast('جاري حفظ وتطبيق إعدادات المتجر في Supabase...');

    if (window.NexaSupabase && typeof window.NexaSupabase.settings.set === 'function') {
      await window.NexaSupabase.settings.set('store_info', {
        store_name: storeName,
        email: storeEmail,
        phone: storePhone,
        whatsapp: storeWhatsapp.startsWith('http') ? storeWhatsapp : `https://wa.me/${storeWhatsapp.replace(/\D/g, '')}`,
        telegram: storeTelegram
      });

      await window.NexaSupabase.settings.set('currency_config', {
        usd_egp_rate: usdRate,
        primary_currency: 'EGP',
        secondary_currency: 'USD'
      });

      await window.NexaSupabase.settings.set('announcement', {
        active: annActive,
        text: annText
      });

      await window.NexaSupabase.settings.set('promotions', {
        global_discount_percent: globalDiscount
      });

      await window.NexaSupabase.settings.set('maintenance_mode', {
        enabled: maintEnabled,
        message: maintMsg
      });
    }

    await loadAllDashboardData();
    showToast('تم حفظ كافة إعدادات المتجر في Supabase بنجاح! ✓');
  } catch (err) {
    window.NexaUI.toast('فشل حفظ الإعدادات: ' + err.message, 'error');
  }
}

// ===================================================================
// 16. UTILITIES & TOASTS
// ===================================================================
function formatArabicDateTime(val) {
  if (!val) return 'غير محدد';
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'غير محدد';
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
window.formatArabicDateTime = formatArabicDateTime;

function renderPaymentStatusLabel(status) {
  if (status === 'verified') return 'مؤكد ومعتمد';
  if (status === 'rejected') return 'مرفوض';
  if (status === 'refunded') return 'مسترجع';
  return 'قيد التحقق والمراجعة';
}
window.renderPaymentStatusLabel = renderPaymentStatusLabel;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  if (window.NexaUI && typeof window.NexaUI.toast === 'function') {
    window.NexaUI.toast(message, type);
    return;
  }
  const container = document.getElementById('dashToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'dash-toast';
  const icon = type === 'error' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check');
  const borderColor = type === 'error' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : 'var(--cyan-bright)');
  toast.style.cssText = `
    background: rgba(8, 16, 32, 0.95);
    border: 1px solid ${borderColor};
    color: #fff;
    padding: 12px 18px;
    border-radius: 10px;
    margin-top: 10px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.88rem;
    animation: toastIn 0.3s ease;
  `;
  toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${borderColor};"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();

  // Search Input for Products
  document.getElementById('dashSearchInput')?.addEventListener('input', (e) => {
    activeFilters.search = e.target.value.trim();
    renderProductsTable();
  });

  // Category Filter for Products
  document.getElementById('dashCategoryFilter')?.addEventListener('change', (e) => {
    activeFilters.category = e.target.value;
    renderProductsTable();
  });

  // Status Filter for Products
  document.getElementById('dashProductStatusFilter')?.addEventListener('change', (e) => {
    activeFilters.status = e.target.value;
    renderProductsTable();
  });

  // Featured Filter for Products
  document.getElementById('dashFeatureFilter')?.addEventListener('change', (e) => {
    activeFilters.featured = e.target.value;
    renderProductsTable();
  });

  // Search Input for Orders
  document.getElementById('dashOrderSearchInput')?.addEventListener('input', (e) => {
    renderOrdersTable();
  });

  // Search Input for Inventory
  document.getElementById('dashInventorySearchInput')?.addEventListener('input', (e) => {
    renderInventoryTable();
  });

  // Search Input for Customers
  document.getElementById('dashCustomersSearchInput')?.addEventListener('input', (e) => {
    renderCustomersTable();
  });

  // Realtime Subscriptions
  if (window.NexaSupabase && window.NexaSupabase.realtime) {
    window.NexaSupabase.realtime.subscribeToOrders(() => {
      showToast('⚡ إشعار لحظي: تم استلام أو تحديث طلب في المتجر!');
      loadAllDashboardData();
    });

    window.NexaSupabase.realtime.subscribeToProducts(() => {
      loadAllDashboardData();
    });
  }
});

// Window Attachments
window.switchDashboardTab = switchDashboardTab;
window.handleSupabaseAdminLogin = handleSupabaseAdminLogin;
window.lockAdminSession = lockAdminSession;
window.syncAllFromSupabase = syncAllFromSupabase;
window.populateCategoryDropdowns = populateCategoryDropdowns;

window.openAddProductModal = openAddProductModal;
window.openEditProductModal = openEditProductModal;
window.closeProductModal = closeProductModal;
window.handleSaveProduct = handleSaveProduct;
window.autoCalcSuggestedPrice = autoCalcSuggestedPrice;
window.applyFormulaPrices = applyFormulaPrices;
window.handleToggleActive = handleToggleActive;
window.handleToggleFeatured = handleToggleFeatured;
window.handleToggleArchive = handleToggleArchive;
window.toggleFormStockType = toggleFormStockType;
window.handleDuplicateProduct = handleDuplicateProduct;
window.handleDeleteProduct = handleDeleteProduct;

window.openAddCategoryModal = openAddCategoryModal;
window.openEditCategoryModal = openEditCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.handleSaveCategory = handleSaveCategory;
window.handleDeleteCategory = handleDeleteCategory;

window.openInventoryForProduct = openInventoryForProduct;
window.toggleInventoryInputs = toggleInventoryInputs;
window.closeInventoryModal = closeInventoryModal;
window.handleSaveInventory = handleSaveInventory;
window.openInventoryMovementsModal = openInventoryMovementsModal;
window.closeInventoryLogModal = closeInventoryLogModal;
window.renderInventoryTable = renderInventoryTable;

window.openAddBundleModal = openAddBundleModal;
window.openEditBundleModal = openEditBundleModal;
window.closeBundleModal = closeBundleModal;
window.handleSaveBundle = handleSaveBundle;
window.handleToggleBundleActive = handleToggleBundleActive;
window.handleDeleteBundle = handleDeleteBundle;
window.updateBundleOriginalPriceAuto = updateBundleOriginalPriceAuto;
window.calcBundleSavings = calcBundleSavings;

window.openAddPaymentModal = openAddPaymentModal;
window.openEditPaymentModal = openEditPaymentModal;
window.closePaymentModal = closePaymentModal;
window.handleSavePaymentMethod = handleSavePaymentMethod;
window.handleTogglePaymentActive = handleTogglePaymentActive;
window.handleDeletePayment = handleDeletePayment;
window.applyPaymentPreset = applyPaymentPreset;

window.renderOrdersTable = renderOrdersTable;
window.openOrderDetailsModal = openOrderDetailsModal;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.handleSaveOrderStatus = handleSaveOrderStatus;
window.handleDeleteOrder = handleDeleteOrder;
window.openReceiptLightbox = openReceiptLightbox;
window.closeReceiptLightbox = closeReceiptLightbox;
window.exportOrdersJSON = exportOrdersJSON;

window.renderCustomersTable = renderCustomersTable;
window.handleToggleUserRole = handleToggleUserRole;
window.prefillLoyaltyAdjustment = prefillLoyaltyAdjustment;
window.renderLoyaltySection = renderLoyaltySection;
window.handleSaveLoyaltyRules = handleSaveLoyaltyRules;
window.handleAdminLoyaltyAdjust = handleAdminLoyaltyAdjust;
window.loadLoyaltyLedger = loadLoyaltyLedger;

window.openAddCouponModal = openAddCouponModal;
window.openEditCouponModal = openEditCouponModal;
window.closeCouponModal = closeCouponModal;
window.handleSaveCoupon = handleSaveCoupon;
window.handleToggleCouponActive = handleToggleCouponActive;
window.handleDeleteCoupon = handleDeleteCoupon;

window.renderReviewsTable = renderReviewsTable;
window.handleToggleReviewApproval = handleToggleReviewApproval;
window.handleDeleteReview = handleDeleteReview;

window.renderTicketsTable = renderTicketsTable;
window.openTicketReplyModal = openTicketReplyModal;
window.closeTicketModal = closeTicketModal;
window.submitTicketReply = submitTicketReply;

window.renderSettingsForm = renderSettingsForm;
window.handleSaveStoreSettings = handleSaveStoreSettings;

// Global Escape Key and Backdrop Close Handlers
function closeAllModals() {
  if (typeof closeProductModal === 'function') closeProductModal();
  if (typeof closeCategoryModal === 'function') closeCategoryModal();
  if (typeof closeInventoryModal === 'function') closeInventoryModal();
  if (typeof closeInventoryLogModal === 'function') closeInventoryLogModal();
  if (typeof closeBundleModal === 'function') closeBundleModal();
  if (typeof closePaymentModal === 'function') closePaymentModal();
  if (typeof closeOrderDetailsModal === 'function') closeOrderDetailsModal();
  if (typeof closeReceiptLightbox === 'function') closeReceiptLightbox();
  if (typeof closeCouponModal === 'function') closeCouponModal();
  if (typeof closeTicketModal === 'function') closeTicketModal();
}
window.closeAllModals = closeAllModals;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.keyCode === 27) {
    closeAllModals();
  }
});

