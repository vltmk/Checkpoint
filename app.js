/**
 * app.js - Nodra Pay Gaming Freelance Work Ledger
 * Reactive state, in-game currencies & Iranian Toman support, clipboard paste handler, analytics charts, and search/filter.
 */

// Currency Definitions (Fiat, Crypto, Iranian Toman, In-Game Currencies)
const CURRENCIES = {
    USD: { symbol: '$', name: 'USD ($)', suffix: '', isFiat: true },
    TOMAN: { symbol: '', name: 'Iranian Toman (تومان)', suffix: ' تومان', isFiat: true },
    EUR: { symbol: '€', name: 'EUR (€)', suffix: '', isFiat: true },
    GBP: { symbol: '£', name: 'GBP (£)', suffix: '', isFiat: true },
    CAD: { symbol: 'CA$', name: 'CAD ($)', suffix: '', isFiat: true },
    USDT: { symbol: '₮', name: 'USDT (₮)', suffix: '', isFiat: true },
    
    // In-Game Currencies
    ROBUX: { symbol: 'R$', name: 'Robux (R$)', suffix: ' R$', isFiat: false },
    VP: { symbol: '', name: 'Valorant Points (VP)', suffix: ' VP', isFiat: false },
    VBUCKS: { symbol: '', name: 'V-Bucks', suffix: ' V-Bucks', isFiat: false },
    WOW_GOLD: { symbol: '', name: 'WoW Gold (g)', suffix: 'g', isFiat: false },
    OSRS_GP: { symbol: '', name: 'OSRS GP (M GP)', suffix: 'M GP', isFiat: false },
    TF2_KEYS: { symbol: '', name: 'TF2 Keys', suffix: ' Keys', isFiat: false },
    MINECOINS: { symbol: '', name: 'Minecoins (MC)', suffix: ' MC', isFiat: false },
    CUSTOM_IGC: { symbol: '', name: 'Custom Game Currency', suffix: ' pts', isFiat: false }
};

// Application State
const state = {
    entries: [],
    filteredEntries: [],
    currency: 'USD',
    viewMode: 'dense', // 'dense' | 'cards'
    currentEditingId: null,
    tempProofImages: [], // Array of base64 data URLs in modal form
    charts: {
        monthly: null,
        category: null,
        game: null
    }
};

// DOM Elements
const el = {
    entriesTableBody: document.getElementById('entriesTableBody'),
    cardsContainer: document.getElementById('cardsContainer'),
    tableContainer: document.getElementById('tableContainer'),
    emptyState: document.getElementById('emptyState'),
    visibleCount: document.getElementById('visibleCount'),
    totalCount: document.getElementById('totalCount'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    filterCategory: document.getElementById('filterCategory'),
    filterStatus: document.getElementById('filterStatus'),
    filterProof: document.getElementById('filterProof'),
    sortSelect: document.getElementById('sortSelect'),
    btnViewDense: document.getElementById('btnViewDense'),
    btnViewCards: document.getElementById('btnViewCards'),
    globalCurrencySelect: document.getElementById('globalCurrencySelect'),
    
    // KPI Strip
    kpiTotalPaid: document.getElementById('kpiTotalPaid'),
    kpiPaidCount: document.getElementById('kpiPaidCount'),
    kpiPending: document.getElementById('kpiPending'),
    kpiPendingCount: document.getElementById('kpiPendingCount'),
    kpiTotalLogged: document.getElementById('kpiTotalLogged'),
    kpiTotalCount: document.getElementById('kpiTotalCount'),
    kpiAvgRate: document.getElementById('kpiAvgRate'),
    kpiHourlyStats: document.getElementById('kpiHourlyStats'),
    kpiTopGame: document.getElementById('kpiTopGame'),
    kpiTopGameRev: document.getElementById('kpiTopGameRev'),

    // Analytics Drawer
    analyticsSection: document.getElementById('analyticsSection'),
    btnToggleAnalytics: document.getElementById('btnToggleAnalytics'),
    analyticsQuickTags: document.getElementById('analyticsQuickTags'),

    // Modal
    entryModal: document.getElementById('entryModal'),
    modalHeading: document.getElementById('modalHeading'),
    modalModeTag: document.getElementById('modalModeTag'),
    workEntryForm: document.getElementById('workEntryForm'),
    btnNewEntry: document.getElementById('btnNewEntry'),
    btnEmptyCreate: document.getElementById('btnEmptyCreate'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelModal: document.getElementById('btnCancelModal'),

    // Form inputs
    entryId: document.getElementById('entryId'),
    workTitle: document.getElementById('workTitle'),
    workDateTime: document.getElementById('workDateTime'),
    workGame: document.getElementById('workGame'),
    workCategory: document.getElementById('workCategory'),
    workPlatform: document.getElementById('workPlatform'),
    workCurrency: document.getElementById('workCurrency'),
    workIncome: document.getElementById('workIncome'),
    workStatus: document.getElementById('workStatus'),
    workHours: document.getElementById('workHours'),
    workDeliverableUrl: document.getElementById('workDeliverableUrl'),
    workTags: document.getElementById('workTags'),
    workNotes: document.getElementById('workNotes'),
    proofDropzone: document.getElementById('proofDropzone'),
    proofFileInput: document.getElementById('proofFileInput'),
    modalProofThumbnails: document.getElementById('modalProofThumbnails'),

    // Lightbox
    lightboxModal: document.getElementById('lightboxModal'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxCaption: document.getElementById('lightboxCaption'),
    lightboxDownloadBtn: document.getElementById('lightboxDownloadBtn'),
    btnCloseLightbox: document.getElementById('btnCloseLightbox'),

    // Export/Import
    btnExportCsv: document.getElementById('btnExportCsv'),
    btnExportJson: document.getElementById('btnExportJson'),
    btnImportJson: document.getElementById('btnImportJson'),
    importJsonInput: document.getElementById('importJsonInput'),
    toast: document.getElementById('toast')
};

// Initialize Application
async function initApp() {
    // Load saved currency preference
    const savedCurrency = localStorage.getItem('nodrapay_currency');
    if (savedCurrency && CURRENCIES[savedCurrency]) {
        state.currency = savedCurrency;
        el.globalCurrencySelect.value = savedCurrency;
    }

    // Load saved view mode preference
    const savedView = localStorage.getItem('nodrapay_view');
    if (savedView) {
        setViewMode(savedView);
    }

    // Setup initial sample data if completely empty
    await checkAndSeedInitialData();

    // Load entries from DB
    await refreshData();

    // Attach Event Listeners
    setupEventListeners();
    setupClipboardPasteListener();
    initCharts();
    updateCharts();
}

// Seed realistic gaming freelance work on first run so the user gets instant value
async function checkAndSeedInitialData() {
    const existing = await window.trackerDB.getAllEntries();
    if (existing.length === 0) {
        const now = new Date();
        const d1 = new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 16);
        const d2 = new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 16);
        const d3 = new Date(now.getTime() - 9 * 86400000).toISOString().slice(0, 16);
        const d4 = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 16);

        const sampleEntries = [
            {
                id: 'job_' + Date.now() + '_1',
                title: 'Roblox Simulator Map & Pet 3D Assets',
                game: 'Pet Royale [Roblox]',
                category: '3D Art / Assets',
                platform: 'Roblox Studio / Blender',
                income: 45000,
                currency: 'ROBUX',
                status: 'Paid',
                dateTime: d1,
                hours: 14.0,
                deliverableUrl: 'https://www.roblox.com',
                tags: ['roblox', '3d-assets', 'pets', 'low-poly'],
                notes: 'Created 6 custom mythical eggs, hatching animations, and spawn island environment.',
                proofs: []
            },
            {
                id: 'job_' + Date.now() + '_2',
                title: 'Unreal Engine 5 Boss Encounter AI & Behavior Trees',
                game: 'Aethelgard RPG',
                category: 'Game Dev / Code',
                platform: 'Unreal 5.4 / PC',
                income: 650.00,
                currency: 'USD',
                status: 'Paid',
                dateTime: d2,
                hours: 12.5,
                deliverableUrl: 'https://github.com/example/boss-ai-module',
                tags: ['ai', 'boss-fight', 'c++', 'blueprints'],
                notes: 'Implemented Phase 2 rage mechanic, custom navmesh query filter, and spell telegraphing system.',
                proofs: []
            },
            {
                id: 'job_' + Date.now() + '_3',
                title: 'Valorant Radiant Coaching & Duo VOD Review (4 Sessions)',
                game: 'Valorant',
                category: 'Coaching / Boosting',
                platform: 'Discord / Riot',
                income: 8500000,
                currency: 'TOMAN',
                status: 'Paid',
                dateTime: d3,
                hours: 8.0,
                deliverableUrl: '',
                tags: ['coaching', 'vod-review', 'radiant', 'toman'],
                notes: 'Full utility guide for Sova and Fade lineups on Lotus and Sunset.',
                proofs: []
            },
            {
                id: 'job_' + Date.now() + '_4',
                title: 'Custom World of Warcraft UI / WeakAuras Suite',
                game: 'World of Warcraft',
                category: 'Game Dev / Code',
                platform: 'Lua / Addon',
                income: 1250000,
                currency: 'WOW_GOLD',
                status: 'Escrow',
                dateTime: d4,
                hours: 6.0,
                deliverableUrl: 'https://wago.io',
                tags: ['weakauras', 'mythic-plus', 'lua'],
                notes: 'Custom cooldown trackers and raid warning sound triggers for Mythic progression.',
                proofs: []
            }
        ];

        await window.trackerDB.bulkImport(sampleEntries);
    }
}

// Refresh entries from database and update UI
async function refreshData() {
    state.entries = await window.trackerDB.getAllEntries();
    applyFiltersAndSort();
    updateKpis();
    updateCharts();
}

/**
 * Format Currency for Display
 * Handles USD, Iranian Toman (تومان), and in-game currencies (Robux, VP, WoW Gold, etc.)
 */
function formatMoney(amount, currencyCode = null) {
    const code = currencyCode && currencyCode !== 'DEFAULT' ? currencyCode : state.currency;
    const cur = CURRENCIES[code] || { symbol: '$', suffix: '' };
    const num = Number(amount || 0);

    // Format numbers based on currency type (Toman and In-game currencies typically whole numbers)
    let formattedNum;
    if (code === 'TOMAN' || !cur.isFiat) {
        formattedNum = Math.round(num).toLocaleString('en-US');
    } else {
        formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    if (cur.symbol && cur.suffix) {
        return `${cur.symbol}${formattedNum}${cur.suffix}`;
    } else if (cur.symbol) {
        return `${cur.symbol}${formattedNum}`;
    } else if (cur.suffix) {
        return `${formattedNum}${cur.suffix}`;
    }
    return formattedNum;
}

// Setup Event Handlers
function setupEventListeners() {
    // Currency switch
    el.globalCurrencySelect.addEventListener('change', (e) => {
        state.currency = e.target.value;
        localStorage.setItem('nodrapay_currency', state.currency);
        renderEntries();
        updateKpis();
        updateCharts();
    });

    // View toggling
    el.btnViewDense.addEventListener('click', () => setViewMode('dense'));
    el.btnViewCards.addEventListener('click', () => setViewMode('cards'));

    // Search and filters
    el.searchInput.addEventListener('input', () => {
        el.btnClearSearch.style.display = el.searchInput.value ? 'block' : 'none';
        applyFiltersAndSort();
    });
    el.btnClearSearch.addEventListener('click', () => {
        el.searchInput.value = '';
        el.btnClearSearch.style.display = 'none';
        applyFiltersAndSort();
    });

    el.filterCategory.addEventListener('change', applyFiltersAndSort);
    el.filterStatus.addEventListener('change', applyFiltersAndSort);
    el.filterProof.addEventListener('change', applyFiltersAndSort);
    el.sortSelect.addEventListener('change', applyFiltersAndSort);

    // Analytics accordion
    el.btnToggleAnalytics.addEventListener('click', () => {
        el.analyticsSection.classList.toggle('collapsed');
    });

    // Open Modal
    el.btnNewEntry.addEventListener('click', () => openEntryModal());
    el.btnEmptyCreate.addEventListener('click', () => openEntryModal());

    // Close Modal
    el.btnCloseModal.addEventListener('click', closeEntryModal);
    el.btnCancelModal.addEventListener('click', closeEntryModal);
    el.entryModal.addEventListener('click', (e) => {
        if (e.target === el.entryModal) closeEntryModal();
    });

    // Form submit
    el.workEntryForm.addEventListener('submit', handleFormSubmit);

    // Dropzone click & drag events
    el.proofDropzone.addEventListener('click', () => el.proofFileInput.click());
    el.proofFileInput.addEventListener('change', handleFileSelect);

    el.proofDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.proofDropzone.classList.add('drag-over');
    });
    el.proofDropzone.addEventListener('dragleave', () => {
        el.proofDropzone.classList.remove('drag-over');
    });
    el.proofDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.proofDropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Lightbox close
    el.btnCloseLightbox.addEventListener('click', closeLightbox);
    el.lightboxModal.addEventListener('click', (e) => {
        if (e.target === el.lightboxModal) closeLightbox();
    });

    // Export & Import
    el.btnExportCsv.addEventListener('click', exportToCsv);
    el.btnExportJson.addEventListener('click', exportToJson);
    el.btnImportJson.addEventListener('click', () => el.importJsonInput.click());
    el.importJsonInput.addEventListener('change', handleJsonImport);

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        // Esc to close modal / lightbox
        if (e.key === 'Escape') {
            if (el.lightboxModal.style.display !== 'none') closeLightbox();
            else if (el.entryModal.style.display !== 'none') closeEntryModal();
        }
        // Ctrl+N or Alt+N to open new entry
        if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'n' && el.entryModal.style.display === 'none') {
            e.preventDefault();
            openEntryModal();
        }
    });
}

// Set View Mode (Dense Table vs Cards)
function setViewMode(mode) {
    state.viewMode = mode;
    localStorage.setItem('nodrapay_view', mode);

    if (mode === 'dense') {
        el.btnViewDense.classList.add('active');
        el.btnViewCards.classList.remove('active');
        el.tableContainer.style.display = 'block';
        el.cardsContainer.style.display = 'none';
    } else {
        el.btnViewCards.classList.add('active');
        el.btnViewDense.classList.remove('active');
        el.tableContainer.style.display = 'none';
        el.cardsContainer.style.display = 'grid';
    }
}

/**
 * CLIPBOARD PASTE HANDLER
 * Allows user to hit Ctrl+V anywhere in the form (or page if modal is open)
 * to instantly capture screenshots from clipboard as base64 images.
 */
function setupClipboardPasteListener() {
    window.addEventListener('paste', (event) => {
        // Only process clipboard images if the modal is currently open
        if (el.entryModal.style.display === 'none') return;

        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        if (!items) return;

        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    hasImage = true;
                    readImageBlob(blob, 'Clipboard Screenshot');
                }
            }
        }

        if (hasImage) {
            event.preventDefault();
            showToast('⚡ Screenshot pasted and attached as proof!');
        }
    });
}

function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
}

function handleFiles(fileList) {
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type.startsWith('image/')) {
            readImageBlob(file, file.name);
        } else {
            showToast(`Attached file: ${file.name}`);
        }
    }
}

function readImageBlob(blob, name = 'Proof Image') {
    const reader = new FileReader();
    reader.onload = (e) => {
        state.tempProofImages.push({
            id: 'proof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            dataUrl: e.target.result,
            name: name,
            timestamp: new Date().toISOString()
        });
        renderModalProofThumbnails();
    };
    reader.readAsDataURL(blob);
}

function renderModalProofThumbnails() {
    el.modalProofThumbnails.innerHTML = '';
    if (state.tempProofImages.length === 0) return;

    state.tempProofImages.forEach((proof, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumb-item';
        thumb.innerHTML = `
            <img src="${proof.dataUrl}" alt="Proof Thumbnail" title="${escapeHtml(proof.name)}">
            <button type="button" class="btn-remove-thumb" title="Remove screenshot" data-index="${idx}">&times;</button>
        `;
        thumb.querySelector('.btn-remove-thumb').addEventListener('click', (e) => {
            e.stopPropagation();
            state.tempProofImages.splice(idx, 1);
            renderModalProofThumbnails();
        });
        thumb.addEventListener('click', () => openLightbox(proof.dataUrl, proof.name));
        el.modalProofThumbnails.appendChild(thumb);
    });
}

// Modal open/close & Form management
function openEntryModal(entry = null) {
    state.currentEditingId = entry ? entry.id : null;
    state.tempProofImages = entry && entry.proofs ? [...entry.proofs] : [];

    if (entry) {
        el.modalHeading.textContent = 'Edit Work Entry';
        el.modalModeTag.textContent = 'EDITING';
        el.entryId.value = entry.id;
        el.workTitle.value = entry.title || '';
        el.workDateTime.value = entry.dateTime || '';
        el.workGame.value = entry.game || '';
        el.workCategory.value = entry.category || 'Game Dev / Code';
        el.workPlatform.value = entry.platform || '';
        el.workCurrency.value = entry.currency || 'DEFAULT';
        el.workIncome.value = entry.income !== undefined ? entry.income : '';
        el.workStatus.value = entry.status || 'Paid';
        el.workHours.value = entry.hours !== undefined ? entry.hours : '';
        el.workDeliverableUrl.value = entry.deliverableUrl || '';
        el.workTags.value = Array.isArray(entry.tags) ? entry.tags.join(', ') : (entry.tags || '');
        el.workNotes.value = entry.notes || '';
    } else {
        el.modalHeading.textContent = 'Log Gaming Work';
        el.modalModeTag.textContent = 'NEW ENTRY';
        el.workEntryForm.reset();
        el.entryId.value = '';
        el.workCurrency.value = 'DEFAULT';
        // Default datetime to now
        const now = new Date();
        const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        el.workDateTime.value = localIso;
        el.workCategory.value = 'Game Dev / Code';
        el.workStatus.value = 'Paid';
    }

    renderModalProofThumbnails();
    el.entryModal.style.display = 'flex';
    setTimeout(() => el.workTitle.focus(), 50);
}

function closeEntryModal() {
    el.entryModal.style.display = 'none';
    state.currentEditingId = null;
    state.tempProofImages = [];
}

// Handle Form Submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const title = el.workTitle.value.trim();
    const dateTime = el.workDateTime.value;
    const game = el.workGame.value.trim();
    const category = el.workCategory.value;
    const platform = el.workPlatform.value.trim();
    const currency = el.workCurrency.value;
    const income = parseFloat(el.workIncome.value) || 0;
    const status = el.workStatus.value;
    const hours = el.workHours.value ? parseFloat(el.workHours.value) : null;
    const deliverableUrl = el.workDeliverableUrl.value.trim();
    const tagsRaw = el.workTags.value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const notes = el.workNotes.value.trim();

    const entryId = state.currentEditingId || ('job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

    const entryData = {
        id: entryId,
        title,
        dateTime,
        game,
        category,
        platform,
        currency,
        income,
        status,
        hours,
        deliverableUrl,
        tags,
        notes,
        proofs: state.tempProofImages,
        updatedAt: new Date().toISOString()
    };

    await window.trackerDB.saveEntry(entryData);
    closeEntryModal();
    await refreshData();
    showToast(state.currentEditingId ? 'Work entry updated' : 'Work entry logged successfully');
}

// Delete Entry with confirmation
async function deleteEntry(id) {
    if (confirm('Delete this work entry and its attached proofs?')) {
        await window.trackerDB.deleteEntry(id);
        await refreshData();
        showToast('Work entry deleted');
    }
}

// Duplicate Entry for rapid logging
async function duplicateEntry(id) {
    const original = await window.trackerDB.getEntry(id);
    if (!original) return;

    const copy = {
        ...original,
        id: 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        title: original.title + ' (Copy)',
        dateTime: new Date().toISOString().slice(0, 16),
        status: 'In Progress'
    };

    await window.trackerDB.saveEntry(copy);
    await refreshData();
    showToast('Entry duplicated');
}

// Apply Search, Filters, and Sorting
function applyFiltersAndSort() {
    const query = el.searchInput.value.toLowerCase().trim();
    const category = el.filterCategory.value;
    const status = el.filterStatus.value;
    const proofFilter = el.filterProof.value;
    const sort = el.sortSelect.value;

    let list = [...state.entries];

    // Search
    if (query) {
        list = list.filter(item => {
            const matchTitle = (item.title || '').toLowerCase().includes(query);
            const matchGame = (item.game || '').toLowerCase().includes(query);
            const matchNotes = (item.notes || '').toLowerCase().includes(query);
            const matchPlatform = (item.platform || '').toLowerCase().includes(query);
            const matchTags = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(query));
            return matchTitle || matchGame || matchNotes || matchPlatform || matchTags;
        });
    }

    // Category Filter
    if (category) {
        list = list.filter(item => item.category === category);
    }

    // Status Filter
    if (status) {
        list = list.filter(item => item.status === status);
    }

    // Proof Filter
    if (proofFilter === 'has_proof') {
        list = list.filter(item => item.proofs && item.proofs.length > 0);
    } else if (proofFilter === 'no_proof') {
        list = list.filter(item => !item.proofs || item.proofs.length === 0);
    }

    // Sorting
    list.sort((a, b) => {
        if (sort === 'date_desc') return new Date(b.dateTime) - new Date(a.dateTime);
        if (sort === 'date_asc') return new Date(a.dateTime) - new Date(b.dateTime);
        if (sort === 'income_desc') return (b.income || 0) - (a.income || 0);
        if (sort === 'income_asc') return (a.income || 0) - (b.income || 0);
        if (sort === 'title_asc') return (a.title || '').localeCompare(b.title || '');
        return 0;
    });

    state.filteredEntries = list;
    renderEntries();
}

// Render Table and Cards views
function renderEntries() {
    const list = state.filteredEntries;
    el.visibleCount.textContent = list.length;
    el.totalCount.textContent = state.entries.length;

    if (list.length === 0) {
        el.tableContainer.style.display = 'none';
        el.cardsContainer.style.display = 'none';
        el.emptyState.style.display = 'flex';
        return;
    }

    el.emptyState.style.display = 'none';
    if (state.viewMode === 'dense') {
        el.tableContainer.style.display = 'block';
        el.cardsContainer.style.display = 'none';
    } else {
        el.tableContainer.style.display = 'none';
        el.cardsContainer.style.display = 'grid';
    }

    renderTableView(list);
    renderCardsView(list);
}

// Render Dense Table
function renderTableView(list) {
    el.entriesTableBody.innerHTML = '';

    list.forEach(item => {
        const tr = document.createElement('tr');

        // Date formatting
        const dt = new Date(item.dateTime);
        const dateStr = !isNaN(dt) ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '--';
        const timeStr = !isNaN(dt) ? dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

        // Status badge class
        const statusClass = getStatusClass(item.status);

        // Deliverable link icon
        const linkHtml = item.deliverableUrl ? `
            <a href="${escapeHtml(item.deliverableUrl)}" target="_blank" rel="noopener" class="link-icon" title="Open Deliverable Link: ${escapeHtml(item.deliverableUrl)}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
        ` : '';

        // Proof thumbnails
        let proofHtml = '<span class="proof-none">--</span>';
        if (item.proofs && item.proofs.length > 0) {
            proofHtml = `
                <div class="proof-stack">
                    ${item.proofs.slice(0, 3).map((p, idx) => `
                        <img src="${p.dataUrl}" class="proof-thumb-mini" title="${escapeHtml(p.name || 'Screenshot Proof')}" data-proof-index="${idx}">
                    `).join('')}
                    ${item.proofs.length > 3 ? `<span class="badge-tag">+${item.proofs.length - 3}</span>` : ''}
                </div>
            `;
        }

        // Tags
        const tagsHtml = (item.tags && item.tags.length > 0) ? `
            <div class="work-tags-wrap">
                ${item.tags.map(t => `<span class="badge-tag">#${escapeHtml(t)}</span>`).join('')}
            </div>
        ` : '';

        // Notes summary
        const notesHtml = item.notes ? `<div class="work-notes truncate">${escapeHtml(item.notes)}</div>` : '';

        // Formatted income based on entry-specific currency or global default
        const entryCurrency = item.currency && item.currency !== 'DEFAULT' ? item.currency : state.currency;
        const formattedIncome = formatMoney(item.income, entryCurrency);

        tr.innerHTML = `
            <td>
                <div class="cell-datetime">
                    <span>${dateStr}</span>
                    <span class="cell-time">${timeStr}</span>
                </div>
            </td>
            <td>
                <div class="cell-game">
                    <span class="game-title truncate">${escapeHtml(item.game || 'Untitled')}</span>
                    <span class="game-platform truncate">${escapeHtml(item.platform || '')}</span>
                </div>
            </td>
            <td>
                <div class="cell-work">
                    <div class="work-title-row">
                        <span class="work-title">${escapeHtml(item.title)}</span>
                        ${linkHtml}
                    </div>
                    ${notesHtml}
                    ${tagsHtml}
                </div>
            </td>
            <td>
                <span class="badge-cat">${escapeHtml(item.category || 'General')}</span>
            </td>
            <td>
                ${proofHtml}
            </td>
            <td>
                <span class="badge-status ${statusClass}">${escapeHtml(item.status || 'Paid')}</span>
            </td>
            <td>
                <div class="cell-income">
                    <span class="income-amount">${formattedIncome}</span>
                    ${item.hours ? `<div class="income-hours">${item.hours} hrs</div>` : ''}
                </div>
            </td>
            <td>
                <div class="row-actions">
                    <button class="btn-action-icon btn-edit" title="Edit entry">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-action-icon btn-dup" title="Duplicate entry">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="btn-action-icon danger btn-del" title="Delete entry">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        `;

        // Row button events
        tr.querySelector('.btn-edit').addEventListener('click', () => openEntryModal(item));
        tr.querySelector('.btn-dup').addEventListener('click', () => duplicateEntry(item.id));
        tr.querySelector('.btn-del').addEventListener('click', () => deleteEntry(item.id));

        // Thumbnail click for lightbox
        const thumbs = tr.querySelectorAll('.proof-thumb-mini');
        thumbs.forEach(t => {
            t.addEventListener('click', (e) => {
                e.stopPropagation();
                const pIdx = parseInt(t.getAttribute('data-proof-index'), 10);
                const proof = item.proofs[pIdx];
                if (proof) openLightbox(proof.dataUrl, `${item.game} - ${proof.name || 'Proof'}`);
            });
        });

        el.entriesTableBody.appendChild(tr);
    });
}

// Render Cards View
function renderCardsView(list) {
    el.cardsContainer.innerHTML = '';

    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'work-card';

        const dt = new Date(item.dateTime);
        const dateStr = !isNaN(dt) ? dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
        const statusClass = getStatusClass(item.status);
        const entryCurrency = item.currency && item.currency !== 'DEFAULT' ? item.currency : state.currency;

        let proofsHtml = '';
        if (item.proofs && item.proofs.length > 0) {
            proofsHtml = `
                <div class="card-proof-row">
                    ${item.proofs.map((p, idx) => `
                        <img src="${p.dataUrl}" class="card-proof-thumb" data-proof-index="${idx}" title="${escapeHtml(p.name || 'Proof')}">
                    `).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="card-top">
                <div>
                    <div class="card-game">${escapeHtml(item.game || 'Gaming')}</div>
                    <div class="card-title">${escapeHtml(item.title)}</div>
                </div>
                <div class="card-income">${formatMoney(item.income, entryCurrency)}</div>
            </div>

            <div class="card-body">
                <p class="truncate">${escapeHtml(item.notes || 'No extra notes.')}</p>
                ${proofsHtml}
            </div>

            <div class="card-footer">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="badge-status ${statusClass}">${escapeHtml(item.status)}</span>
                    <span class="badge-cat">${escapeHtml(item.category)}</span>
                </div>
                <div class="row-actions">
                    <button class="btn-action-icon btn-edit" title="Edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="btn-action-icon danger btn-del" title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
            </div>
        `;

        card.querySelector('.btn-edit').addEventListener('click', () => openEntryModal(item));
        card.querySelector('.btn-del').addEventListener('click', () => deleteEntry(item.id));

        const thumbs = card.querySelectorAll('.card-proof-thumb');
        thumbs.forEach(t => {
            t.addEventListener('click', (e) => {
                e.stopPropagation();
                const pIdx = parseInt(t.getAttribute('data-proof-index'), 10);
                const proof = item.proofs[pIdx];
                if (proof) openLightbox(proof.dataUrl, `${item.game} - ${proof.name || 'Proof'}`);
            });
        });

        el.cardsContainer.appendChild(card);
    });
}

function getStatusClass(status) {
    switch (status) {
        case 'Paid': return 'status-paid';
        case 'Escrow': return 'status-escrow';
        case 'Invoiced': return 'status-invoiced';
        case 'In Progress': return 'status-progress';
        case 'Pending': return 'status-pending';
        default: return 'status-paid';
    }
}

// Calculate and Update KPI Strip Metrics
function updateKpis() {
    const entries = state.entries;
    let totalPaid = 0;
    let paidCount = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let totalLogged = 0;
    let totalHours = 0;
    const gameRevMap = {};

    entries.forEach(e => {
        const inc = parseFloat(e.income) || 0;
        totalLogged += inc;

        if (e.status === 'Paid') {
            totalPaid += inc;
            paidCount++;
        } else if (e.status === 'Escrow' || e.status === 'Invoiced' || e.status === 'Pending' || e.status === 'In Progress') {
            totalPending += inc;
            pendingCount++;
        }

        if (e.hours) totalHours += parseFloat(e.hours);

        const g = e.game || 'Uncategorized';
        gameRevMap[g] = (gameRevMap[g] || 0) + inc;
    });

    el.kpiTotalPaid.textContent = formatMoney(totalPaid);
    el.kpiPaidCount.textContent = `${paidCount} payout${paidCount === 1 ? '' : 's'} completed`;

    el.kpiPending.textContent = formatMoney(totalPending);
    el.kpiPendingCount.textContent = `${pendingCount} active / in escrow`;

    el.kpiTotalLogged.textContent = formatMoney(totalLogged);
    el.kpiTotalCount.textContent = `${entries.length} total logged jobs`;

    const avgRate = entries.length > 0 ? (totalLogged / entries.length) : 0;
    el.kpiAvgRate.innerHTML = `${formatMoney(avgRate)} <span class="rate-unit">/ job</span>`;

    if (totalHours > 0) {
        const hourly = totalLogged / totalHours;
        el.kpiHourlyStats.textContent = `${formatMoney(hourly)} / hr (${totalHours.toFixed(1)} hrs total)`;
    } else {
        el.kpiHourlyStats.textContent = `-- / hr avg`;
    }

    // Top Game
    let topGame = 'None';
    let topRev = 0;
    for (const [g, rev] of Object.entries(gameRevMap)) {
        if (rev > topRev) {
            topRev = rev;
            topGame = g;
        }
    }
    el.kpiTopGame.textContent = topGame;
    el.kpiTopGameRev.textContent = `${formatMoney(topRev)} rev`;

    // Quick tag updates in analytics header
    el.analyticsQuickTags.innerHTML = `
        <span class="quick-tag">💰 ${formatMoney(totalLogged)}</span>
        <span class="quick-tag">🎮 ${Object.keys(gameRevMap).length} Games</span>
        <span class="quick-tag">⏱️ ${totalHours.toFixed(1)}h</span>
    `;
}

// Lightbox modal for full size viewing
function openLightbox(imgSrc, caption = 'Proof Screenshot') {
    el.lightboxImage.src = imgSrc;
    el.lightboxCaption.textContent = caption;
    el.lightboxDownloadBtn.href = imgSrc;
    el.lightboxDownloadBtn.download = `${caption.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
    el.lightboxModal.style.display = 'flex';
}

function closeLightbox() {
    el.lightboxModal.style.display = 'none';
    el.lightboxImage.src = '';
}

// Chart.js Visualizations (Inter font styled)
function initCharts() {
    const chartDefaults = {
        color: '#94a3b8',
        font: {
            family: "'Inter', -apple-system, sans-serif",
            size: 10
        }
    };
    Chart.defaults.color = chartDefaults.color;
    Chart.defaults.font.family = chartDefaults.font.family;
    Chart.defaults.font.size = chartDefaults.font.size;

    // Monthly Earnings Chart
    const ctxMonthly = document.getElementById('chartMonthlyVelocity').getContext('2d');
    state.charts.monthly = new Chart(ctxMonthly, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Earnings',
                data: [],
                backgroundColor: 'rgba(59, 130, 246, 0.65)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${formatMoney(context.raw)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        callback: (val) => `${formatMoney(val)}`
                    }
                }
            }
        }
    });

    // Category Chart
    const ctxCategory = document.getElementById('chartCategoryBreakdown').getContext('2d');
    state.charts.category = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
                    '#f43f5e', '#ec4899', '#6366f1', '#14b8a6', '#64748b'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 10, font: { size: 9.5 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.raw)}`
                    }
                }
            }
        }
    });

    // Game Breakdown Chart
    const ctxGame = document.getElementById('chartGameBreakdown').getContext('2d');
    state.charts.game = new Chart(ctxGame, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue',
                data: [],
                backgroundColor: 'rgba(16, 185, 129, 0.65)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${formatMoney(context.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        callback: (val) => `${formatMoney(val)}`
                    }
                },
                y: { grid: { display: false } }
            }
        }
    });
}

function updateCharts() {
    if (!state.charts.monthly) return;

    // Monthly Earnings Data (Last 6 months)
    const monthMap = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        monthMap[key] = 0;
    }

    // Category Map & Game Map
    const catMap = {};
    const gameMap = {};

    state.entries.forEach(e => {
        const inc = parseFloat(e.income) || 0;
        const dt = new Date(e.dateTime);
        if (!isNaN(dt)) {
            const key = dt.toLocaleString('en-US', { month: 'short', year: '2-digit' });
            if (monthMap[key] !== undefined) {
                monthMap[key] += inc;
            }
        }

        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + inc;

        const gm = e.game || 'Other';
        gameMap[gm] = (gameMap[gm] || 0) + inc;
    });

    // Update Monthly Chart
    state.charts.monthly.data.labels = Object.keys(monthMap);
    state.charts.monthly.data.datasets[0].data = Object.values(monthMap);
    state.charts.monthly.update();

    // Update Category Chart
    state.charts.category.data.labels = Object.keys(catMap);
    state.charts.category.data.datasets[0].data = Object.values(catMap);
    state.charts.category.update();

    // Update Game Chart (Top 5 games)
    const sortedGames = Object.entries(gameMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    state.charts.game.data.labels = sortedGames.map(g => g[0]);
    state.charts.game.data.datasets[0].data = sortedGames.map(g => g[1]);
    state.charts.game.update();
}

// CSV Export
function exportToCsv() {
    if (state.entries.length === 0) {
        showToast('No entries to export');
        return;
    }

    const headers = ['ID', 'Date & Time', 'Game / Client', 'Work Title', 'Category', 'Platform', 'Currency', 'Income Amount', 'Status', 'Hours', 'Deliverable URL', 'Tags', 'Notes', 'Has Proof Attached'];
    const rows = state.entries.map(e => [
        e.id,
        e.dateTime,
        `"${(e.game || '').replace(/"/g, '""')}"`,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.category || '').replace(/"/g, '""')}"`,
        `"${(e.platform || '').replace(/"/g, '""')}"`,
        `"${e.currency || state.currency}"`,
        e.income,
        e.status,
        e.hours || '',
        `"${(e.deliverableUrl || '').replace(/"/g, '""')}"`,
        `"${(Array.isArray(e.tags) ? e.tags.join(', ') : '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`,
        (e.proofs && e.proofs.length > 0) ? 'YES' : 'NO'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nodrapay_gaming_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded');
}

// JSON Backup Export (Includes screenshot proofs)
function exportToJson() {
    if (state.entries.length === 0) {
        showToast('No entries to export');
        return;
    }

    const backupData = {
        app: 'Nodra Pay',
        exportDate: new Date().toISOString(),
        version: '2.0',
        currency: state.currency,
        entries: state.entries
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nodrapay_ledger_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Full JSON backup with screenshots downloaded');
}

// JSON Backup Import
function handleJsonImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            const importedEntries = Array.isArray(data) ? data : (data.entries || []);

            if (!Array.isArray(importedEntries)) {
                throw new Error('Invalid JSON format');
            }

            if (confirm(`Restore ${importedEntries.length} entries into Nodra Pay ledger?`)) {
                await window.trackerDB.bulkImport(importedEntries);
                await refreshData();
                showToast(`Successfully restored ${importedEntries.length} entries`);
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('Failed to parse JSON backup file.');
        }
        el.importJsonInput.value = '';
    };
    reader.readAsText(file);
}

// Utility: Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Utility: Toast Notification
let toastTimeout;
function showToast(msg) {
    clearTimeout(toastTimeout);
    el.toast.textContent = msg;
    el.toast.style.display = 'block';
    toastTimeout = setTimeout(() => {
        el.toast.style.display = 'none';
    }, 2800);
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
