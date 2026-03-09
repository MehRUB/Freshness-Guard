/**
 * --< The Freshness Guard — Main Application JavaScript >--
 * --< No AI. No predictions. 100% user-inputted data and hard-coded logic. >--
 * --< Handles: Tab routing, Items CRUD, Barcode scanning, Notifications, >--
 * --< History, Shopping List, Donation Map, Household management >--
 */

/* --< ============================================================ >-- */
/* --<                        CONFIGURATION                          >-- */
/* --< ============================================================ >-- */

const API_BASE = '';  // --< Same origin — Flask serves both API and static >--
const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v0/product';

/* --< App state >-- */
let state = {
    householdId: localStorage.getItem('freshness_household_id') || null,
    householdName: localStorage.getItem('freshness_household_name') || null,
    currentTab: 'dashboard',
    items: [],
    notifications: [],
    scannerActive: false
};


/* --< ============================================================ >-- */
/* --<                      INITIALIZATION                           >-- */
/* --< ============================================================ >-- */

document.addEventListener('DOMContentLoaded', () => {
    // --< Check if household exists, otherwise show setup >--
    if (!state.householdId) {
        showSetupFlow();
    } else {
        initApp();
    }
});

function initApp() {
    setupTabNavigation();
    setupEventListeners();
    loadDashboard();
    loadNotifications();
}

function showSetupFlow() {
    // --< Show the settings tab with household creation >--
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-settings').classList.add('active');
    document.querySelector('.bottom-nav').style.display = 'none';
    document.querySelector('.fab').style.display = 'none';

    // --< Show setup-specific UI >--
    const settingsContent = document.getElementById('tab-settings');
    settingsContent.innerHTML = `
        <div class="empty-state" style="padding-top: 60px;">
            <div class="empty-icon">🛡️</div>
            <div class="empty-title">Welcome to Freshness Guard</div>
            <div class="empty-desc" style="margin-bottom: 32px;">
                Create a household to start tracking your food, or join an existing one.
            </div>
            <div style="max-width: 300px; margin: 0 auto;">
                <div class="form-group">
                    <label class="form-label">Household Name</label>
                    <input type="text" class="form-input" id="setup-name" placeholder="e.g. Smith Family" />
                </div>
                <button class="submit-btn" onclick="createHousehold()" style="margin-bottom: 16px;">
                    Create Household
                </button>
                <div class="date-divider">or join existing</div>
                <div class="form-group">
                    <label class="form-label">Invite Code</label>
                    <input type="text" class="form-input" id="setup-code" placeholder="e.g. AB12CD"
                           style="text-align: center; letter-spacing: 0.15em; font-weight: 700;" maxlength="6" />
                </div>
                <button class="settings-btn primary" onclick="joinHousehold()">
                    Join Household
                </button>
            </div>
        </div>
    `;
}


/* --< ============================================================ >-- */
/* --<                       TAB NAVIGATION                          >-- */
/* --< ============================================================ >-- */

function setupTabNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    state.currentTab = tabName;

    // --< Update tab content visibility >--
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add('active');

    // --< Update nav items >--
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (navItem) navItem.classList.add('active');

    // --< Load tab-specific data >--
    switch (tabName) {
        case 'dashboard': loadDashboard(); break;
        case 'history': loadHistory(); break;
        case 'shopping': loadShoppingList(); break;
        case 'donate': loadDonationMap(); break;
        case 'settings': loadSettings(); break;
    }
}


/* --< ============================================================ >-- */
/* --<                       EVENT LISTENERS                         >-- */
/* --< ============================================================ >-- */

function setupEventListeners() {
    // --< FAB button >--
    document.querySelector('.fab').addEventListener('click', openAddModal);

    // --< Notification bell >--
    document.getElementById('notif-btn').addEventListener('click', toggleNotifications);

    // --< Modal overlay click to close >--
    document.getElementById('add-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) closeAddModal();
    });

    // --< Notification panel overlay >--
    document.getElementById('notif-panel-close').addEventListener('click', closeNotifications);
}


/* --< ============================================================ >-- */
/* --<                     HOUSEHOLD MANAGEMENT                      >-- */
/* --< ============================================================ >-- */

async function createHousehold() {
    const name = document.getElementById('setup-name').value.trim() || 'My Household';

    try {
        const res = await fetch(`${API_BASE}/api/households`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!res.ok) throw new Error('Failed to create household');
        const data = await res.json();

        state.householdId = data.id;
        state.householdName = data.name;
        localStorage.setItem('freshness_household_id', data.id);
        localStorage.setItem('freshness_household_name', data.name);

        showToast('Household created!', 'success');

        // --< Reload app >--
        location.reload();
    } catch (err) {
        showToast('Failed to create household', 'error');
    }
}

async function joinHousehold() {
    const code = document.getElementById('setup-code').value.trim().toUpperCase();
    if (!code) {
        showToast('Enter an invite code', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/households/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_code: code })
        });

        if (!res.ok) throw new Error('Invalid code');
        const data = await res.json();

        state.householdId = data.id;
        state.householdName = data.name;
        localStorage.setItem('freshness_household_id', data.id);
        localStorage.setItem('freshness_household_name', data.name);

        showToast('Joined household!', 'success');
        location.reload();
    } catch (err) {
        showToast('Invalid invite code', 'error');
    }
}


/* --< ============================================================ >-- */
/* --<                         DASHBOARD                             >-- */
/* --< ============================================================ >-- */

async function loadDashboard() {
    if (!state.householdId) return;

    try {
        const res = await fetch(`${API_BASE}/api/items?household_id=${state.householdId}`);
        const items = await res.json();
        state.items = items;
        renderDashboard(items);
    } catch (err) {
        showToast('Failed to load items', 'error');
    }
}

function renderDashboard(items) {
    const container = document.getElementById('tab-dashboard');

    // --< Count by freshness >--
    const counts = { expired: 0, critical: 0, warning: 0, safe: 0 };
    items.forEach(item => { counts[item.freshness] = (counts[item.freshness] || 0) + 1; });

    let html = `
        <div class="section-header">
            <div>
                <div class="section-title">Your Fridge</div>
                <div class="section-subtitle">${items.length} item${items.length !== 1 ? 's' : ''} tracked</div>
            </div>
        </div>

        <div class="stats-row">
            <div class="stat-card expired">
                <div class="stat-value">${counts.expired}</div>
                <div class="stat-label">Expired</div>
            </div>
            <div class="stat-card critical">
                <div class="stat-value">${counts.critical}</div>
                <div class="stat-label">&lt; 48 Hours</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${counts.warning}</div>
                <div class="stat-label">&lt; 7 Days</div>
            </div>
            <div class="stat-card safe">
                <div class="stat-value">${counts.safe}</div>
                <div class="stat-label">Safe</div>
            </div>
        </div>
    `;

    if (items.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🥗</div>
                <div class="empty-title">No items yet</div>
                <div class="empty-desc">Tap the + button to add your first food item.</div>
            </div>
        `;
    } else {
        html += '<div class="items-list">';
        items.forEach(item => {
            html += renderItemCard(item);
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function renderItemCard(item) {
    const icon = getCategoryIcon(item.category);
    const badgeText = getBadgeText(item);
    const expiryText = getExpiryText(item);

    return `
        <div class="item-card ${item.freshness}" data-id="${item.id}">
            <div class="item-icon">${icon}</div>
            <div class="item-details">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-expiry">${expiryText}</div>
            </div>
            <span class="item-badge ${item.freshness}">${badgeText}</span>
            <div class="item-actions">
                <button class="item-action-btn used" onclick="markItem('${item.id}', 'used')" title="Mark as used">✓</button>
                <button class="item-action-btn wasted" onclick="markItem('${item.id}', 'wasted')" title="Mark as wasted">✕</button>
            </div>
        </div>
    `;
}

function getBadgeText(item) {
    if (item.freshness === 'expired') return 'Expired';
    if (item.freshness === 'critical') return `${item.days_until_expiry}d`;
    if (item.freshness === 'warning') return `${item.days_until_expiry}d`;
    return `${item.days_until_expiry}d`;
}

function getExpiryText(item) {
    if (item.freshness === 'expired') {
        return `Expired ${Math.abs(item.days_until_expiry)} day${Math.abs(item.days_until_expiry) !== 1 ? 's' : ''} ago`;
    }
    if (item.days_until_expiry === 0) return 'Expires today';
    if (item.days_until_expiry === 1) return 'Expires tomorrow';
    return `Expires in ${item.days_until_expiry} days`;
}

function getCategoryIcon(category) {
    // --< Hard-coded category icons — no AI guessing >--
    const icons = {
        'Dairy': '🥛', 'Meat': '🥩', 'Produce': '🥬', 'Fruit': '🍎',
        'Bakery': '🍞', 'Frozen': '🧊', 'Beverage': '🥤', 'Snack': '🍿',
        'Condiment': '🧂', 'Seafood': '🐟', 'Deli': '🧀', 'General': '📦'
    };
    return icons[category] || '📦';
}


/* --< ============================================================ >-- */
/* --<                     ADD ITEM FLOW                             >-- */
/* --< ============================================================ >-- */

let selectedQuickDays = null;

function openAddModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.add('active');
    selectedQuickDays = null;

    // --< Reset form >--
    document.getElementById('item-name').value = '';
    document.getElementById('item-barcode').value = '';
    document.getElementById('item-expiry-date').value = '';
    document.getElementById('item-category').value = 'General';
    document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('selected'));

    // --< Stop scanner if running >--
    stopScanner();
}

function closeAddModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.remove('active');
    stopScanner();
}

function selectQuickDate(days, btn) {
    selectedQuickDays = days;

    // --< Compute the actual date >--
    const date = new Date();
    date.setDate(date.getDate() + days);
    document.getElementById('item-expiry-date').value = formatDateInput(date);

    // --< Highlight selected button >--
    document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
}

function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function submitItem() {
    const name = document.getElementById('item-name').value.trim();
    const barcode = document.getElementById('item-barcode').value.trim();
    const expiryDate = document.getElementById('item-expiry-date').value;
    const category = document.getElementById('item-category').value;

    if (!name) {
        showToast('Enter a product name', 'warning');
        return;
    }
    if (!expiryDate) {
        showToast('Select an expiration date', 'warning');
        return;
    }

    const payload = {
        household_id: state.householdId,
        name: name,
        barcode: barcode || null,
        expiration_date: expiryDate,
        category: category
    };

    try {
        const res = await fetch(`${API_BASE}/api/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to add item');

        showToast(`${name} added!`, 'success');
        closeAddModal();
        loadDashboard();
    } catch (err) {
        showToast('Failed to add item', 'error');
    }
}


/* --< ============================================================ >-- */
/* --<                    BARCODE SCANNING                           >-- */
/* --< ============================================================ >-- */

function toggleScanner() {
    const container = document.getElementById('scanner-container');
    if (container.classList.contains('active')) {
        stopScanner();
    } else {
        startScanner();
    }
}

function startScanner() {
    const container = document.getElementById('scanner-container');
    container.classList.add('active');
    state.scannerActive = true;

    // --< Initialize QuaggaJS >--
    if (typeof Quagga === 'undefined') {
        showToast('Scanner library not loaded', 'error');
        return;
    }

    Quagga.init({
        inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: document.getElementById('scanner-viewport'),
            constraints: {
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        },
        decoder: {
            readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader']
        }
    }, (err) => {
        if (err) {
            console.error('Scanner error:', err);
            showToast('Camera access denied', 'error');
            stopScanner();
            return;
        }
        Quagga.start();
    });

    Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        document.getElementById('item-barcode').value = code;

        // --< Lookup in Open Food Facts >--
        lookupBarcode(code);

        // --< Stop scanner after detection >--
        stopScanner();
    });
}

function stopScanner() {
    const container = document.getElementById('scanner-container');
    container.classList.remove('active');
    state.scannerActive = false;

    if (typeof Quagga !== 'undefined') {
        try { Quagga.stop(); } catch (e) { /* --< Ignore if not running >-- */ }
    }
}

async function lookupBarcode(code) {
    // --< Query Open Food Facts for product name >--
    try {
        showToast('Looking up product...', 'info');

        const res = await fetch(`${OPEN_FOOD_FACTS_API}/${code}.json`);
        const data = await res.json();

        if (data.status === 1 && data.product) {
            const productName = data.product.product_name || data.product.product_name_en || '';
            if (productName) {
                document.getElementById('item-name').value = productName;
                showToast(`Found: ${productName}`, 'success');
            } else {
                showToast('Product found but no name — type it manually', 'warning');
            }
        } else {
            showToast('Product not found — type the name manually', 'warning');
        }
    } catch (err) {
        showToast('Lookup failed — type the name manually', 'warning');
    }
}


/* --< ============================================================ >-- */
/* --<                      ITEM ACTIONS                             >-- */
/* --< ============================================================ >-- */

async function markItem(itemId, action) {
    // --< Prompt for estimated cost when wasting >--
    let estimatedCost = 0;
    if (action === 'wasted') {
        const costStr = prompt('Estimated cost of this item ($):', '0');
        if (costStr === null) return; // --< User cancelled >--
        estimatedCost = parseFloat(costStr) || 0;
    }

    try {
        const res = await fetch(`${API_BASE}/api/items/${itemId}/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, estimated_cost: estimatedCost })
        });

        if (!res.ok) throw new Error('Failed to mark item');

        const actionLabel = action === 'used' ? 'Used' : 'Wasted';
        showToast(`Item marked as ${actionLabel}`, action === 'used' ? 'success' : 'warning');
        loadDashboard();
    } catch (err) {
        showToast('Failed to update item', 'error');
    }
}

async function deleteItem(itemId) {
    if (!confirm('Delete this item? It won\'t be tracked in history.')) return;

    try {
        const res = await fetch(`${API_BASE}/api/items/${itemId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');

        showToast('Item deleted', 'success');
        loadDashboard();
    } catch (err) {
        showToast('Failed to delete item', 'error');
    }
}


/* --< ============================================================ >-- */
/* --<                       NOTIFICATIONS                           >-- */
/* --< ============================================================ >-- */

async function loadNotifications() {
    if (!state.householdId) return;

    try {
        const res = await fetch(`${API_BASE}/api/notifications?household_id=${state.householdId}`);
        const notifications = await res.json();
        state.notifications = notifications;

        // --< Update badge >--
        const badge = document.getElementById('notif-badge');
        if (notifications.length > 0) {
            badge.style.display = 'flex';
            badge.textContent = notifications.length > 9 ? '9+' : notifications.length;
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        // --< Silently fail — notifications are non-critical >--
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notif-panel');
    if (panel.classList.contains('active')) {
        closeNotifications();
    } else {
        openNotifications();
    }
}

function openNotifications() {
    const panel = document.getElementById('notif-panel');
    panel.classList.add('active');
    renderNotifications();
}

function closeNotifications() {
    const panel = document.getElementById('notif-panel');
    panel.classList.remove('active');
}

function renderNotifications() {
    const list = document.getElementById('notif-list');

    if (state.notifications.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <div class="empty-title">All clear!</div>
                <div class="empty-desc">No pending notifications.</div>
            </div>
        `;
        return;
    }

    list.innerHTML = state.notifications.map(n => {
        const urgencyClass = n.urgency === 'URGENT' ? 'urgent' : n.urgency === 'WARNING' ? 'warning' : 'heads-up';
        return `
            <div class="notif-item ${urgencyClass}">
                <div class="notif-content">
                    <span class="notif-urgency ${urgencyClass}">${n.urgency}</span>
                    <div class="notif-item-name">${escapeHtml(n.item_name)}</div>
                    <div class="notif-item-detail">
                        ${n.days_until_expiry <= 0
                ? 'This item has expired!'
                : `Expires in ${n.days_until_expiry} day${n.days_until_expiry !== 1 ? 's' : ''}`
            }
                    </div>
                </div>
                <button class="notif-dismiss" onclick="dismissNotif('${n.id}')" title="Dismiss">✕</button>
            </div>
        `;
    }).join('');
}

async function dismissNotif(notifId) {
    try {
        await fetch(`${API_BASE}/api/notifications/${notifId}/dismiss`, { method: 'POST' });
        state.notifications = state.notifications.filter(n => n.id !== notifId);
        renderNotifications();
        loadNotifications(); // --< Refresh badge count >--
    } catch (err) {
        showToast('Failed to dismiss', 'error');
    }
}


/* --< ============================================================ >-- */
/* --<                        HISTORY LOG                            >-- */
/* --< ============================================================ >-- */

async function loadHistory() {
    if (!state.householdId) return;

    try {
        const res = await fetch(`${API_BASE}/api/history?household_id=${state.householdId}`);
        const data = await res.json();
        renderHistory(data);
    } catch (err) {
        showToast('Failed to load history', 'error');
    }
}

function renderHistory(data) {
    const container = document.getElementById('tab-history');

    let html = `
        <div class="section-header">
            <div>
                <div class="section-title">History</div>
                <div class="section-subtitle">Track what was used vs. wasted</div>
            </div>
        </div>

        <div class="history-summary">
            <div class="history-stat used">
                <div class="value">${data.summary.total_used}</div>
                <div class="label">Used</div>
            </div>
            <div class="history-stat wasted">
                <div class="value">${data.summary.total_wasted}</div>
                <div class="label">Wasted</div>
            </div>
            <div class="history-stat cost">
                <div class="value">$${data.summary.total_waste_cost.toFixed(2)}</div>
                <div class="label">Money Lost</div>
            </div>
            <div class="history-stat rate">
                <div class="value">${data.summary.use_rate}%</div>
                <div class="label">Use Rate</div>
            </div>
        </div>
    `;

    if (data.entries.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-title">No history yet</div>
                <div class="empty-desc">Mark items as used or wasted to start tracking.</div>
            </div>
        `;
    } else {
        html += '<div class="history-list">';
        data.entries.forEach(entry => {
            const icon = entry.action === 'used' ? '✓' : '✕';
            const dateStr = new Date(entry.action_date).toLocaleDateString();
            html += `
                <div class="history-item ${entry.action}">
                    <div class="action-icon">${icon}</div>
                    <div class="item-info">
                        <div class="name">${escapeHtml(entry.item_name)}</div>
                        <div class="date">${dateStr}${entry.estimated_cost > 0 ? ` · $${entry.estimated_cost.toFixed(2)}` : ''}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}


/* --< ============================================================ >-- */
/* --<                       SHOPPING LIST                           >-- */
/* --< ============================================================ >-- */

async function loadShoppingList() {
    if (!state.householdId) return;

    try {
        const res = await fetch(`${API_BASE}/api/shopping-list?household_id=${state.householdId}`);
        const items = await res.json();
        renderShoppingList(items);
    } catch (err) {
        showToast('Failed to load shopping list', 'error');
    }
}

function renderShoppingList(items) {
    const container = document.getElementById('tab-shopping');

    let html = `
        <div class="section-header">
            <div>
                <div class="section-title">Shopping List</div>
                <div class="section-subtitle">Based on items you've used</div>
            </div>
        </div>
    `;

    if (items.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <div class="empty-title">No suggestions yet</div>
                <div class="empty-desc">Mark items as "used" to generate shopping suggestions.</div>
            </div>
        `;
    } else {
        html += '<div class="shopping-list">';
        items.forEach(item => {
            const lastUsed = item.last_used ? new Date(item.last_used).toLocaleDateString() : 'N/A';
            html += `
                <div class="shopping-item">
                    <div class="shopping-count">${item.count}×</div>
                    <div class="shopping-name">${escapeHtml(item.name)}</div>
                    <div class="shopping-last-used">Last: ${lastUsed}</div>
                </div>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}


/* --< ============================================================ >-- */
/* --<                       DONATION MAP                            >-- */
/* --< ============================================================ >-- */

async function loadDonationMap() {
    try {
        const res = await fetch(`${API_BASE}/api/donation-map`);
        const locations = await res.json();
        renderDonationMap(locations);
    } catch (err) {
        showToast('Failed to load donation locations', 'error');
    }
}

function renderDonationMap(locations) {
    const container = document.getElementById('tab-donate');

    let html = `
        <div class="section-header">
            <div>
                <div class="section-title">Donate Food</div>
                <div class="section-subtitle">Nearby food banks for items expiring soon</div>
            </div>
        </div>

        <div class="donation-list">
    `;

    locations.forEach(loc => {
        html += `
            <div class="donation-card">
                <div class="donation-name">${escapeHtml(loc.name)}</div>
                <div class="donation-detail"><span class="icon">📍</span> ${escapeHtml(loc.address)}</div>
                <div class="donation-detail"><span class="icon">📞</span> ${escapeHtml(loc.phone)}</div>
                <div class="donation-detail"><span class="icon">🕐</span> ${escapeHtml(loc.hours)}</div>
                <div class="donation-detail"><span class="icon">📦</span> ${escapeHtml(loc.accepts)}</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}


/* --< ============================================================ >-- */
/* --<                         SETTINGS                              >-- */
/* --< ============================================================ >-- */

function loadSettings() {
    const container = document.getElementById('tab-settings');

    container.innerHTML = `
        <div class="section-header">
            <div>
                <div class="section-title">Settings</div>
                <div class="section-subtitle">Household & app configuration</div>
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">Household</div>
            <div class="household-card">
                <div class="household-name">${escapeHtml(state.householdName || 'My Household')}</div>
                <div class="household-code">${state.householdId ? '...' : 'N/A'}</div>
                <div class="household-code-label">Share this code to sync devices</div>
                <button class="settings-btn primary" onclick="showInviteCode()">Show Invite Code</button>
            </div>
        </div>

        <div class="settings-section">
            <div class="settings-section-title">Data</div>
            <button class="settings-btn" onclick="exportData()">📤 Export Data</button>
            <button class="settings-btn danger" onclick="resetApp()">🗑️ Reset App</button>
        </div>

        <div class="settings-section" style="text-align: center; padding-top: 20px;">
            <div style="color: var(--text-muted); font-size: 0.8rem;">
                The Freshness Guard v1.0<br>
                No AI. No predictions. Just fresh food.
            </div>
        </div>
    `;
}

async function showInviteCode() {
    if (!state.householdId) return;

    try {
        const res = await fetch(`${API_BASE}/api/households/${state.householdId}`);
        const data = await res.json();

        const codeEl = document.querySelector('.household-code');
        if (codeEl) {
            codeEl.textContent = data.invite_code;
            codeEl.style.cursor = 'pointer';
            codeEl.onclick = () => {
                navigator.clipboard.writeText(data.invite_code).then(() => {
                    showToast('Code copied!', 'success');
                });
            };
        }
    } catch (err) {
        showToast('Failed to load invite code', 'error');
    }
}

function exportData() {
    // --< Export items as JSON download >--
    const data = { items: state.items, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freshness-guard-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
}

function resetApp() {
    if (!confirm('This will disconnect you from your household. Are you sure?')) return;
    localStorage.removeItem('freshness_household_id');
    localStorage.removeItem('freshness_household_name');
    location.reload();
}


/* --< ============================================================ >-- */
/* --<                        UTILITIES                              >-- */
/* --< ============================================================ >-- */

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${escapeHtml(message)}`;

    container.appendChild(toast);

    // --< Auto-dismiss after 3 seconds >--
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
