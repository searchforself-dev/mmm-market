(function() {
    'use strict';
    
    const MMNTrackerApp = {
        stores: {
            settings: null,
            locations: null,
            priceSnapshots: null,
            alerts: null
        },
        config: window.mmnTrackerConfig || {},
        pollTimer: null,
        isOnline: navigator.onLine,
        
        init: function() {
            this.initIndexedDB();
            this.initEventListeners();
            this.findWidgets();
        },
        
        initIndexedDB: function() {
            localforage.config({
                driver: localforage.INDEXEDDB,
                name: 'mmnMarketTracker',
                version: 1.0,
                storeName: 'mmn_data'
            });
            
            this.stores.settings = localforage.createInstance({
                name: 'mmnMarketTracker',
                storeName: 'settings'
            });
            
            this.stores.locations = localforage.createInstance({
                name: 'mmnMarketTracker',
                storeName: 'locations'
            });
            
            this.stores.priceSnapshots = localforage.createInstance({
                name: 'mmnMarketTracker',
                storeName: 'price_snapshots'
            });
            
            this.stores.alerts = localforage.createInstance({
                name: 'mmnMarketTracker',
                storeName: 'alerts'
            });
            
            this.initDefaultSettings();
        },
        
        initDefaultSettings: async function() {
            const existing = await this.stores.settings.getItem('local-settings');
            if (!existing) {
                await this.stores.settings.setItem('local-settings', {
                    preferred_zip: '',
                    preferred_commodities: this.config.defaultCommodities || ['corn', 'soybeans', 'wheat'],
                    unit: this.config.defaultUnit || 'bushel',
                    last_sync_at: null,
                    poll_interval: this.config.pollInterval || 60,
                    max_retention_days: this.config.maxRetentionDays || 365
                });
            }
        },
        
        initEventListeners: function() {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.showOnlineStatus(true);
            });
            
            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.showOnlineStatus(false);
            });
            
            window.addEventListener('beforeunload', () => {
                if (this.pollTimer) {
                    clearInterval(this.pollTimer);
                }
            });
        },
        
        findWidgets: function() {
            const widgets = document.querySelectorAll('.mmn-market-tracker');
            widgets.forEach(widget => this.initWidget(widget));
        },
        
        initWidget: async function(widget) {
            const commodities = widget.dataset.commodities || '';
            const zip = widget.dataset.zip || '';
            const unit = widget.dataset.unit || '';
            
            let settings = await this.stores.settings.getItem('local-settings');

            // If settings are null (e.g., first visit), create a default object.
            if (!settings) {
                settings = {
                    preferred_zip: '',
                    preferred_commodities: this.config.defaultCommodities || ['corn', 'soybeans', 'wheat'],
                    unit: this.config.defaultUnit || 'bushel',
                    last_sync_at: null,
                    poll_interval: this.config.pollInterval || 60,
                    max_retention_days: this.config.maxRetentionDays || 365
                };
            }
            
            if (commodities) {
                settings.preferred_commodities = commodities.split(',').map(c => c.trim());
            }
            if (zip) {
                settings.preferred_zip = zip;
            }
            if (unit) {
                settings.unit = unit;
            }
            
            await this.stores.settings.setItem('local-settings', settings);
            
            this.renderWidget(widget, settings);
            
            await this.loadCachedData(widget);
            
            if (this.isOnline) {
                await this.refreshData(widget, settings);
            }
            
            this.startPolling(widget, settings);
        },
        
        renderWidget: function(widget, settings) {
            const html = `
                <div class="mmn-widget">
                    <div class="mmn-header">
                        <div class="mmn-header-left">
                            <h2 class="mmn-title">
                                <svg class="mmn-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 3h18v18H3z"></path>
                                    <path d="M3 9h18"></path>
                                    <path d="M9 21V9"></path>
                                </svg>
                                ${this.config.i18n.commodity || 'US Market Prices'} — MyMarketNews
                            </h2>
                        </div>
                        <div class="mmn-header-right">
                            <input type="text" 
                                   class="mmn-zip-input" 
                                   placeholder="ZIP Code" 
                                   value="${settings.preferred_zip || ''}"
                                   maxlength="5"
                                   pattern="[0-9]{5}">
                            <button class="mmn-btn mmn-location-btn" title="${this.config.i18n.useMyLocation}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                            <select class="mmn-commodity-select" multiple>
                                ${this.renderCommodityOptions(settings.preferred_commodities)}
                            </select>
                            <button class="mmn-btn mmn-refresh-btn" title="${this.config.i18n.refreshData}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                                </svg>
                            </button>
                            <div class="mmn-menu">
                                <button class="mmn-btn mmn-menu-btn">⋮</button>
                                <div class="mmn-menu-dropdown">
                                    <button class="mmn-menu-item" data-action="clear">${this.config.i18n.clearData}</button>
                                    <button class="mmn-menu-item" data-action="export">${this.config.i18n.exportCSV}</button>
                                    <button class="mmn-menu-item" data-action="help">Help</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mmn-status-bar" style="display: none;"></div>
                    
                    <div class="mmn-main">
                        <div class="mmn-price-table-container">
                            <table class="mmn-price-table">
                                <thead>
                                    <tr>
                                        <th>${this.config.i18n.commodity}</th>
                                        <th>${this.config.i18n.localPrice}</th>
                                        <th>${this.config.i18n.unit}</th>
                                        <th>${this.config.i18n.reportDate}</th>
                                        <th>${this.config.i18n.source}</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="mmn-price-tbody">
                                    <tr class="mmn-no-data">
                                        <td colspan="6">${this.config.i18n.loadingMarketData}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="mmn-footer">
                        <p class="mmn-attribution">${widget.dataset.attribution || this.config.attributionText}</p>
                    </div>
                </div>
            `;
            
            widget.innerHTML = html;
            
            this.attachWidgetEvents(widget, settings);
        },
        
        renderCommodityOptions: function(selected) {
            const commodities = ['corn', 'soybeans', 'wheat', 'cotton', 'rice', 'cattle', 'hogs'];
            return commodities.map(c => {
                const isSelected = selected.includes(c);
                return `<option value="${c}" ${isSelected ? 'selected' : ''}>${this.capitalize(c)}</option>`;
            }).join('');
        },
        
        attachWidgetEvents: function(widget, settings) {
            const zipInput = widget.querySelector('.mmn-zip-input');
            const locationBtn = widget.querySelector('.mmn-location-btn');
            const commoditySelect = widget.querySelector('.mmn-commodity-select');
            const refreshBtn = widget.querySelector('.mmn-refresh-btn');
            const menuBtn = widget.querySelector('.mmn-menu-btn');
            const menuDropdown = widget.querySelector('.mmn-menu-dropdown');
            
            if (zipInput) {
                zipInput.addEventListener('change', async (e) => {
                    settings.preferred_zip = e.target.value;
                    await this.stores.settings.setItem('local-settings', settings);
                    await this.refreshData(widget, settings);
                });
            }
            
            if (locationBtn) {
                locationBtn.addEventListener('click', () => this.useGeolocation(widget, settings));
            }
            
            if (commoditySelect) {
                commoditySelect.addEventListener('change', async (e) => {
                    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                    settings.preferred_commodities = selected;
                    await this.stores.settings.setItem('local-settings', settings);
                    await this.refreshData(widget, settings);
                });
            }
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.refreshData(widget, settings));
            }
            
            if (menuBtn) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.toggle('mmn-show');
                });
                
                document.addEventListener('click', () => {
                    menuDropdown.classList.remove('mmn-show');
                });
            }
            
            const menuItems = widget.querySelectorAll('.mmn-menu-item');
            menuItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    this.handleMenuAction(action, widget, settings);
                });
            });
        },
        
        loadCachedData: async function(widget) {
            const snapshots = [];
            await this.stores.priceSnapshots.iterate((value) => {
                snapshots.push(value);
            });
            
            if (snapshots.length > 0) {
                this.renderPriceTable(widget, snapshots);
            }
        },
        
        refreshData: async function(widget, settings) {
            if (!this.isOnline) {
                this.showStatusMessage(widget, this.config.i18n.offline + ' ' + (settings.last_sync_at || ''), 'warning');
                return;
            }
            
            const refreshBtn = widget.querySelector('.mmn-refresh-btn');
            if (refreshBtn) {
                refreshBtn.classList.add('mmn-spinning');
            }
            
            try {
                const state = await this.getStateFromZip(settings.preferred_zip);
                
                for (const commodity of settings.preferred_commodities) {
                    await this.fetchReportsForCommodity(widget, commodity, state, settings);
                }
                
                settings.last_sync_at = new Date().toISOString();
                await this.stores.settings.setItem('local-settings', settings);
                
                await this.loadCachedData(widget);
                await this.checkAlerts();
                
            } catch (error) {
                console.error('Refresh error:', error);
                this.handleProxyError(widget, error);
            } finally {
                if (refreshBtn) {
                    refreshBtn.classList.remove('mmn-spinning');
                }
            }
        },
        
        fetchReportsForCommodity: async function(widget, commodity, state, settings) {
            try {
                const response = await fetch(this.config.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'reportsByState',
                        commodity: commodity,
                        state: state
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data && data.results && data.results.length > 0) {
                    const report = data.results[0];
                    await this.fetchReportDetails(commodity, report.slug_id || report.reportId, settings);
                }
                
            } catch (error) {
                console.error(`Error fetching ${commodity}:`, error);
            }
        },
        
        fetchReportDetails: async function(commodity, reportId, settings) {
            try {
                const response = await fetch(this.config.proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'reportDetails',
                        reportId: reportId,
                        lastDays: 7
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data && data.results && data.results.length > 0) {
                    const latestEntry = data.results[0];
                    await this.savePriceSnapshot(commodity, latestEntry, settings);
                }
                
            } catch (error) {
                console.error(`Error fetching report details for ${commodity}:`, error);
            }
        },
        
        savePriceSnapshot: async function(commodity, rawData, settings) {
            const price = this.extractPrice(rawData);
            const unit = this.extractUnit(rawData) || settings.unit;
            const reportedAt = this.extractReportDate(rawData);
            
            const snapshot = {
                id: this.generateUUID(),
                commodity: commodity,
                source: 'mmn',
                location_id: this.extractLocationId(rawData),
                price: price,
                unit: unit,
                reported_at: reportedAt,
                fetched_at: new Date().toISOString(),
                meta: rawData
            };
            
            const existing = await this.findExistingSnapshot(commodity, reportedAt);
            if (!existing) {
                await this.stores.priceSnapshots.setItem(snapshot.id, snapshot);
            }
            
            await this.purgeOldSnapshots(settings.max_retention_days);
        },
        
        extractPrice: function(data) {
            if (data.price !== undefined) return parseFloat(data.price);
            if (data.value !== undefined) return parseFloat(data.value);
            if (data.amount !== undefined) return parseFloat(data.amount);
            if (data.pricePerUnit !== undefined) return parseFloat(data.pricePerUnit);
            
            if (data.reportSection && Array.isArray(data.reportSection)) {
                for (const section of data.reportSection) {
                    if (section.price !== undefined) return parseFloat(section.price);
                }
            }
            
            return null;
        },
        
        extractUnit: function(data) {
            if (data.unit) return data.unit;
            if (data.units) return data.units;
            if (data.priceUnit) return data.priceUnit;
            return null;
        },
        
        extractReportDate: function(data) {
            if (data.reportDate) return data.reportDate;
            if (data.date) return data.date;
            if (data.reportedAt) return data.reportedAt;
            if (data.published) return data.published;
            if (data.report_date) return data.report_date;
            return new Date().toISOString();
        },
        
        extractLocationId: function(data) {
            if (data.market) return 'market_' + data.market.toLowerCase().replace(/\s+/g, '_');
            if (data.marketCity) return 'market_' + data.marketCity.toLowerCase().replace(/\s+/g, '_');
            return null;
        },
        
        findExistingSnapshot: async function(commodity, reportedAt) {
            let found = null;
            await this.stores.priceSnapshots.iterate((value) => {
                if (value.commodity === commodity && value.reported_at === reportedAt) {
                    found = value;
                    return;
                }
            });
            return found;
        },
        
        purgeOldSnapshots: async function(maxDays) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxDays);
            const cutoffTime = cutoffDate.getTime();
            
            const keysToRemove = [];
            await this.stores.priceSnapshots.iterate((value, key) => {
                const snapshotTime = new Date(value.fetched_at).getTime();
                if (snapshotTime < cutoffTime) {
                    keysToRemove.push(key);
                }
            });
            
            for (const key of keysToRemove) {
                await this.stores.priceSnapshots.removeItem(key);
            }
        },
        
        renderPriceTable: function(widget, snapshots) {
            const tbody = widget.querySelector('.mmn-price-tbody');
            if (!tbody) return;
            
            if (snapshots.length === 0) {
                tbody.innerHTML = `<tr class="mmn-no-data"><td colspan="6">${this.config.i18n.noData}</td></tr>`;
                return;
            }
            
            const grouped = this.groupSnapshotsByCommodity(snapshots);
            
            let html = '';
            for (const [commodity, items] of Object.entries(grouped)) {
                const latest = items[0];
                const priceDisplay = latest.price !== null ? `$${latest.price.toFixed(2)}` : 'N/A';
                const dateDisplay = latest.reported_at ? new Date(latest.reported_at).toLocaleDateString() : 'N/A';
                
                html += `
                    <tr class="mmn-price-row" data-commodity="${commodity}">
                        <td class="mmn-commodity-cell">
                            <span class="mmn-expand-icon">▶</span>
                            ${this.capitalize(commodity)}
                        </td>
                        <td>${priceDisplay}</td>
                        <td>${latest.unit || 'N/A'}</td>
                        <td>${dateDisplay}</td>
                        <td>MMN</td>
                        <td>
                            <button class="mmn-btn-small mmn-snapshot-btn" data-id="${latest.id}">
                                ${this.config.i18n.saveSnapshot || 'Save'}
                            </button>
                        </td>
                    </tr>
                    <tr class="mmn-details-row" data-commodity="${commodity}" style="display: none;">
                        <td colspan="6">
                            <div class="mmn-details-content">
                                <pre>${JSON.stringify(latest.meta, null, 2)}</pre>
                            </div>
                        </td>
                    </tr>
                `;
            }
            
            tbody.innerHTML = html;
            
            const rows = tbody.querySelectorAll('.mmn-price-row');
            rows.forEach(row => {
                row.addEventListener('click', () => {
                    const commodity = row.dataset.commodity;
                    const detailsRow = tbody.querySelector(`.mmn-details-row[data-commodity="${commodity}"]`);
                    const icon = row.querySelector('.mmn-expand-icon');
                    
                    if (detailsRow.style.display === 'none') {
                        detailsRow.style.display = 'table-row';
                        icon.textContent = '▼';
                    } else {
                        detailsRow.style.display = 'none';
                        icon.textContent = '▶';
                    }
                });
            });
        },
        
        groupSnapshotsByCommodity: function(snapshots) {
            const grouped = {};
            snapshots.forEach(snapshot => {
                if (!grouped[snapshot.commodity]) {
                    grouped[snapshot.commodity] = [];
                }
                grouped[snapshot.commodity].push(snapshot);
            });
            
            for (const commodity in grouped) {
                grouped[commodity].sort((a, b) => {
                    return new Date(b.reported_at) - new Date(a.reported_at);
                });
            }
            
            return grouped;
        },
        
        getStateFromZip: async function(zip) {
            if (!zip || zip.length < 3) {
                return 'IA'; // Default to Iowa if ZIP is invalid
            }
            
            const zipPrefix = zip.substring(0, 3);
            const zipToState = this.getZipToStateMapping();
            
            return zipToState[zipPrefix] || 'IA'; // Return state or default to Iowa
        },
        
        getZipToStateMapping: function() {
            // Comprehensive mapping of 3-digit ZIP prefixes to state abbreviations
            return {
                '005': 'NY', '006': 'PR', '007': 'PR', '008': 'PR', '009': 'PR', '010': 'MA', '011': 'MA', '012': 'MA', '013': 'MA', '014': 'MA', '015': 'MA', '016': 'MA', '017': 'MA', '018': 'MA', '019': 'MA', '020': 'MA', '021': 'MA', '022': 'MA', '023': 'MA', '024': 'MA', '025': 'MA', '026': 'MA', '027': 'RI', '028': 'RI', '029': 'RI', '030': 'NH', '031': 'NH', '032': 'NH', '033': 'NH', '034': 'NH', '035': 'VT', '036': 'VT', '037': 'VT', '038': 'NH', '039': 'NH', '040': 'ME', '041': 'ME', '042': 'ME', '043': 'ME', '044': 'ME', '045': 'ME', '046': 'ME', '047': 'ME', '048': 'ME', '049': 'ME', '050': 'VT', '051': 'VT', '052': 'VT', '053': 'VT', '054': 'VT', '055': 'MA', '056': 'VT', '057': 'VT', '058': 'VT', '059': 'VT',
                '060': 'CT', '061': 'CT', '062': 'CT', '063': 'CT', '064': 'CT', '065': 'CT', '066': 'CT', '067': 'CT', '068': 'CT', '069': 'CT', '070': 'NJ', '071': 'NJ', '072': 'NJ', '073': 'NJ', '074': 'NJ', '075': 'NJ', '076': 'NJ', '077': 'NJ', '078': 'NJ', '079': 'NJ', '080': 'NJ', '081': 'NJ', '082': 'NJ', '083': 'NJ', '084': 'NJ', '085': 'NJ', '086': 'NJ', '087': 'NJ', '088': 'NJ', '089': 'NJ', '090': 'AE', '091': 'AE', '092': 'AE', '093': 'AE', '094': 'AE', '095': 'AE', '096': 'AE', '097': 'AE', '098': 'AE', '099': 'AE', '100': 'NY', '101': 'NY', '102': 'NY', '103': 'NY', '104': 'NY', '105': 'NY', '106': 'NY', '107': 'NY', '108': 'NY', '109': 'NY', '110': 'NY', '111': 'NY', '112': 'NY', '113': 'NY', '114': 'NY', '115': 'NY', '116': 'NY', '117': 'NY', '118': 'NY', '119': 'NY',
                '120': 'NY', '121': 'NY', '122': 'NY', '123': 'NY', '124': 'NY', '125': 'NY', '126': 'NY', '127': 'NY', '128': 'NY', '129': 'NY', '130': 'NY', '131': 'NY', '132': 'NY', '133': 'NY', '134': 'NY', '135': 'NY', '136': 'NY', '137': 'NY', '138': 'NY', '139': 'NY', '140': 'NY', '141': 'NY', '142': 'NY', '143': 'NY', '144': 'NY', '145': 'NY', '146': 'NY', '147': 'NY', '148': 'NY', '149': 'NY', '150': 'PA', '151': 'PA', '152': 'PA', '153': 'PA', '154': 'PA', '155': 'PA', '156': 'PA', '157': 'PA', '158': 'PA', '159': 'PA', '160': 'PA', '161': 'PA', '162': 'PA', '163': 'PA', '164': 'PA', '165': 'PA', '166': 'PA', '167': 'PA', '168': 'PA', '169': 'PA', '170': 'PA', '171': 'PA', '172': 'PA', '173': 'PA', '174': 'PA', '175': 'PA', '176': 'PA', '177': 'PA', '178': 'PA', '179': 'PA', '180': 'PA', '181': 'PA',
                '182': 'PA', '183': 'PA', '184': 'PA', '185': 'PA', '186': 'PA', '187': 'PA', '188': 'PA', '189': 'PA', '190': 'PA', '191': 'PA', '192': 'PA', '193': 'PA', '194': 'PA', '195': 'PA', '196': 'PA', '197': 'DE', '198': 'DE', '199': 'DE', '200': 'DC', '201': 'VA', '202': 'DC', '203': 'DC', '204': 'DC', '205': 'DC', '206': 'MD', '207': 'MD', '208': 'MD', '209': 'MD', '210': 'MD', '211': 'MD', '212': 'MD', '214': 'MD', '215': 'MD', '216': 'MD', '217': 'MD', '218': 'MD', '219': 'MD', '220': 'VA', '221': 'VA', '222': 'VA', '223': 'VA', '224': 'VA', '225': 'VA', '226': 'VA', '227': 'VA', '228': 'VA', '229': 'VA', '230': 'VA', '231': 'VA', '232': 'VA', '233': 'VA', '234': 'VA', '235': 'VA', '236': 'VA', '237': 'VA', '238': 'VA', '239': 'VA', '240': 'VA', '241': 'VA', '242': 'VA', '243': 'VA', '244': 'VA', '245': 'VA',
                '246': 'WV', '247': 'WV', '248': 'WV', '249': 'WV', '250': 'WV', '251': 'WV', '252': 'WV', '253': 'WV', '254': 'WV', '255': 'WV', '256': 'WV', '257': 'WV', '258': 'WV', '259': 'WV', '260': 'WV', '261': 'WV', '262': 'WV', '263': 'WV', '264': 'WV', '265': 'WV', '266': 'WV', '267': 'MD', '268': 'WV', '270': 'NC', '271': 'NC', '272': 'NC', '273': 'NC', '274': 'NC', '275': 'NC', '276': 'NC', '277': 'NC', '278': 'NC', '279': 'NC', '280': 'NC', '281': 'NC', '282': 'NC', '283': 'NC', '284': 'NC', '285': 'NC', '286': 'NC', '287': 'NC', '288': 'NC', '289': 'NC', '290': 'SC', '291': 'SC', '292': 'SC', '293': 'SC', '294': 'SC', '295': 'SC', '296': 'SC', '297': 'NC', '298': 'GA', '299': 'GA', '300': 'GA', '301': 'GA', '302': 'GA', '303': 'GA', '304': 'GA', '305': 'GA', '306': 'GA',
                '307': 'TN', '308': 'GA', '309': 'GA', '310': 'GA', '311': 'GA', '312': 'GA', '313': 'GA', '314': 'GA', '315': 'GA', '316': 'GA', '317': 'GA', '318': 'GA', '319': 'GA', '320': 'FL', '321': 'FL', '322': 'FL', '323': 'FL', '324': 'FL', '325': 'FL', '326': 'FL', '327': 'FL', '328': 'FL', '329': 'FL', '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL', '335': 'FL', '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL', '340': 'AA', '341': 'FL', '342': 'FL', '344': 'FL', '346': 'FL', '347': 'FL', '349': 'FL', '350': 'AL', '351': 'AL', '352': 'AL', '354': 'AL', '355': 'AL', '356': 'AL', '357': 'AL', '358': 'AL', '359': 'AL', '360': 'AL', '361': 'AL', '362': 'AL', '363': 'AL', '364': 'AL', '365': 'AL', '366': 'AL', '367': 'AL', '368': 'AL',
                '369': 'MS', '370': 'TN', '371': 'TN', '372': 'TN', '373': 'TN', '374': 'TN', '375': 'TN', '376': 'TN', '377': 'TN', '378': 'TN', '379': 'TN', '380': 'TN', '381': 'TN', '382': 'TN', '383': 'TN', '384': 'TN', '385': 'TN', '386': 'TN', '387': 'MS', '388': 'MS', '389': 'MS', '390': 'MS', '391': 'MS', '392': 'MS', '393': 'MS', '394': 'MS', '395': 'MS', '396': 'MS', '397': 'MS', '398': 'GA', '399': 'GA', '400': 'KY', '401': 'KY', '402': 'KY', '403': 'KY', '404': 'KY', '405': 'KY', '406': 'KY', '407': 'KY', '408': 'KY', '409': 'KY', '410': 'OH', '411': 'KY', '412': 'KY', '413': 'KY', '414': 'KY', '415': 'KY', '416': 'KY', '417': 'KY', '418': 'KY', '420': 'KY', '421': 'KY', '422': 'KY', '423': 'KY', '424': 'IN', '425': 'KY', '426': 'KY',
                '427': 'KY', '430': 'OH', '431': 'OH', '432': 'OH', '433': 'OH', '434': 'OH', '435': 'OH', '436': 'OH', '437': 'OH', '438': 'OH', '439': 'OH', '440': 'OH', '441': 'OH', '442': 'OH', '443': 'OH', '444': 'OH', '445': 'OH', '446': 'OH', '447': 'OH', '448': 'OH', '449': 'OH', '450': 'OH', '451': 'OH', '452': 'OH', '453': 'OH', '454': 'OH', '455': 'OH', '456': 'OH', '457': 'OH', '458': 'OH', '459': 'OH', '460': 'IN', '461': 'IN', '462': 'IN', '463': 'IN', '464': 'IN', '465': 'IN', '466': 'IN', '467': 'IN', '468': 'IN', '469': 'IN', '470': 'OH', '471': 'KY', '472': 'IN', '473': 'IN', '474': 'IN', '475': 'IN', '476': 'IN', '477': 'IN', '478': 'IN', '479': 'IN', '480': 'MI', '481': 'MI', '482': 'MI', '483': 'MI', '484': 'MI', '485': 'MI',
                '486': 'MI', '487': 'MI', '488': 'MI', '489': 'MI', '490': 'MI', '491': 'MI', '492': 'MI', '493': 'MI', '494': 'MI', '495': 'MI', '496': 'MI', '497': 'MI', '498': 'MI', '499': 'MI', '500': 'IA', '501': 'IA', '502': 'IA', '503': 'IA', '504': 'IA', '505': 'IA', '506': 'IA', '507': 'IA', '508': 'IA', '509': 'IA', '510': 'IA', '511': 'IA', '512': 'IA', '513': 'IA', '514': 'IA', '515': 'NE', '516': 'NE', '520': 'IA', '521': 'IA', '522': 'IA', '523': 'IA', '524': 'IA', '525': 'IA', '526': 'IA', '527': 'IL', '528': 'IA', '530': 'WI', '531': 'WI', '532': 'WI', '534': 'WI', '535': 'WI', '537': 'WI', '538': 'WI', '539': 'WI', '540': 'MN', '541': 'WI', '542': 'WI', '543': 'WI', '544': 'WI', '545': 'WI', '546': 'WI', '547': 'WI',
                '548': 'WI', '549': 'WI', '550': 'MN', '551': 'MN', '553': 'MN', '554': 'MN', '555': 'MN', '556': 'MN', '557': 'MN', '558': 'MN', '559': 'MN', '560': 'MN', '561': 'MN', '562': 'MN', '563': 'MN', '564': 'MN', '565': 'MN', '566': 'MN', '567': 'ND', '570': 'SD', '571': 'SD', '572': 'SD', '573': 'SD', '574': 'SD', '575': 'SD', '576': 'SD', '577': 'SD', '580': 'ND', '581': 'ND', '582': 'ND', '583': 'ND', '584': 'ND', '585': 'ND', '586': 'ND', '587': 'ND', '588': 'ND', '590': 'MT', '591': 'MT', '592': 'MT', '593': 'MT', '594': 'MT', '595': 'MT', '596': 'MT', '597': 'MT', '598': 'MT', '599': 'MT', '600': 'IL', '601': 'IL', '602': 'IL', '603': 'IL', '604': 'IL', '605': 'IL', '606': 'IL', '607': 'IL', '608': 'IL',
                '609': 'IL', '610': 'IL', '611': 'IL', '612': 'IL', '613': 'IL', '614': 'IL', '615': 'IL', '616': 'IL', '617': 'IL', '618': 'IL', '619': 'IL', '620': 'MO', '622': 'MO', '623': 'IL', '624': 'IL', '625': 'IL', '626': 'IL', '627': 'IL', '628': 'IL', '629': 'IL', '630': 'MO', '631': 'MO', '633': 'MO', '634': 'IL', '635': 'IL', '636': 'MO', '637': 'MO', '638': 'MO', '639': 'MO', '640': 'MO', '641': 'MO', '644': 'MO', '645': 'MO', '646': 'MO', '647': 'MO', '648': 'MO', '649': 'MO', '650': 'MO', '651': 'MO', '652': 'MO', '653': 'MO', '654': 'MO', '655': 'MO', '656': 'MO', '657': 'MO', '658': 'MO', '660': 'KS', '661': 'KS', '662': 'KS', '664': 'KS', '665': 'KS', '666': 'KS', '667': 'KS', '668': 'KS', '669': 'KS', '670': 'KS', '671': 'KS',
                '672': 'KS', '673': 'KS', '674': 'KS', '675': 'KS', '676': 'KS', '677': 'KS', '678': 'KS', '679': 'KS', '680': 'NE', '681': 'NE', '683': 'NE', '684': 'NE', '685': 'NE', '686': 'NE', '687': 'NE', '688': 'NE', '689': 'NE', '690': 'NE', '691': 'NE', '692': 'NE', '693': 'NE', '700': 'LA', '701': 'LA', '703': 'LA', '704': 'LA', '705': 'LA', '706': 'LA', '707': 'LA', '708': 'LA', '710': 'LA', '711': 'LA', '712': 'LA', '713': 'LA', '714': 'LA', '716': 'AR', '717': 'AR', '718': 'TX', '719': 'AR', '720': 'AR', '721': 'AR', '722': 'AR', '723': 'TN', '724': 'AR', '725': 'AR', '726': 'AR', '727': 'AR', '728': 'AR', '729': 'AR', '730': 'OK', '731': 'OK', '733': 'TX', '734': 'OK', '735': 'OK', '736': 'OK', '737': 'OK',
                '738': 'OK', '739': 'KS', '740': 'OK', '741': 'OK', '743': 'OK', '744': 'OK', '745': 'OK', '746': 'OK', '747': 'OK', '748': 'OK', '749': 'OK', '750': 'TX', '751': 'TX', '752': 'TX', '753': 'TX', '754': 'TX', '755': 'TX', '756': 'TX', '757': 'TX', '758': 'TX', '759': 'TX', '760': 'TX', '761': 'TX', '762': 'TX', '763': 'TX', '764': 'TX', '765': 'TX', '766': 'TX', '767': 'TX', '768': 'TX', '769': 'TX', '770': 'TX', '771': 'TX', '772': 'TX', '773': 'TX', '774': 'TX', '775': 'TX', '776': 'TX', '777': 'TX', '778': 'TX', '779': 'TX', '780': 'TX', '781': 'TX', '782': 'TX', '783': 'TX', '784': 'TX', '785': 'TX', '786': 'TX', '787': 'TX', '788': 'TX', '789': 'TX', '790': 'TX', '791': 'TX', '792': 'TX', '793': 'TX', '794': 'TX', '795': 'TX', '796': 'TX',
                '797': 'TX', '798': 'TX', '799': 'TX', '800': 'CO', '801': 'CO', '802': 'CO', '803': 'CO', '804': 'CO', '805': 'CO', '806': 'CO', '807': 'CO', '808': 'CO', '809': 'CO', '810': 'CO', '811': 'CO', '812': 'CO', '813': 'CO', '814': 'CO', '815': 'CO', '816': 'CO', '820': 'WY', '821': 'WY', '822': 'WY', '823': 'WY', '824': 'WY', '825': 'WY', '826': 'WY', '827': 'WY', '828': 'WY', '829': 'WY', '830': 'WY', '831': 'WY', '832': 'ID', '833': 'ID', '834': 'ID', '835': 'ID', '836': 'ID', '837': 'ID', '838': 'WA', '840': 'UT', '841': 'UT', '842': 'UT', '843': 'UT', '844': 'UT', '845': 'UT', '846': 'UT', '847': 'UT', '850': 'AZ', '852': 'AZ', '853': 'AZ', '855': 'AZ', '856': 'AZ', '857': 'AZ', '859': 'AZ', '860': 'AZ', '863': 'AZ', '864': 'AZ',
                '865': 'NM', '870': 'NM', '871': 'NM', '872': 'NM', '873': 'NM', '874': 'NM', '875': 'NM', '877': 'NM', '878': 'NM', '879': 'NM', '880': 'NM', '881': 'NM', '882': 'NM', '883': 'NM', '884': 'NM', '885': 'TX', '889': 'NV', '890': 'NV', '891': 'NV', '893': 'NV', '894': 'NV', '895': 'NV', '897': 'NV', '898': 'NV', '900': 'CA', '901': 'CA', '902': 'CA', '903': 'CA', '904': 'CA', '905': 'CA', '906': 'CA', '907': 'CA', '908': 'CA', '910': 'CA', '911': 'CA', '912': 'CA', '913': 'CA', '914': 'CA', '915': 'CA', '916': 'CA', '917': 'CA', '918': 'CA', '919': 'CA', '920': 'CA', '921': 'CA', '922': 'CA', '923': 'CA', '924': 'CA', '925': 'CA', '926': 'CA', '927': 'CA', '928': 'CA', '930': 'CA', '931': 'CA', '932': 'CA', '933': 'CA',
                '934': 'CA', '935': 'CA', '936': 'CA', '937': 'CA', '938': 'CA', '939': 'CA', '940': 'CA', '941': 'CA', '942': 'CA', '943': 'CA', '944': 'CA', '945': 'CA', '946': 'CA', '947': 'CA', '948': 'CA', '949': 'CA', '950': 'CA', '951': 'CA', '952': 'CA', '953': 'CA', '954': 'CA', '955': 'CA', '956': 'CA', '957': 'CA', '958': 'CA', '959': 'CA', '960': 'CA', '961': 'NV', '962': 'AP', '963': 'AP', '964': 'AP', '965': 'AP', '966': 'AP', '967': 'HI', '968': 'HI', '969': 'GU', '970': 'OR', '971': 'OR', '972': 'OR', '973': 'OR', '974': 'OR', '975': 'OR', '976': 'OR', '977': 'OR', '978': 'OR', '979': 'ID', '980': 'WA', '981': 'WA', '982': 'WA', '983': 'WA', '984': 'WA', '985': 'WA', '986': 'OR', '988': 'WA', '989': 'WA', '990': 'WA', '991': 'WA', '992': 'WA',
                '993': 'WA', '994': 'ID', '995': 'AK', '996': 'AK', '997': 'AK', '998': 'AK', '999': 'AK'
            };
        },
        
        useGeolocation: function(widget, settings) {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser');
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    console.log(`Location: ${lat}, ${lon}`);
                    
                    this.showStatusMessage(widget, 'Location detected - please enter ZIP code manually', 'info');
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Unable to retrieve your location');
                }
            );
        },
        
        checkAlerts: async function() {
            const alerts = [];
            await this.stores.alerts.iterate((value) => {
                alerts.push(value);
            });
            
            if (alerts.length === 0) return;
            
            for (const alert of alerts) {
                const latestSnapshot = await this.getLatestSnapshotForCommodity(alert.commodity);
                if (latestSnapshot && latestSnapshot.price !== null) {
                    if (this.checkAlertCondition(alert, latestSnapshot.price)) {
                        this.triggerAlert(alert, latestSnapshot);
                    }
                }
            }
        },
        
        getLatestSnapshotForCommodity: async function(commodity) {
            const snapshots = [];
            await this.stores.priceSnapshots.iterate((value) => {
                if (value.commodity === commodity) {
                    snapshots.push(value);
                }
            });
            
            if (snapshots.length === 0) return null;
            
            snapshots.sort((a, b) => new Date(b.reported_at) - new Date(a.reported_at));
            return snapshots[0];
        },
        
        checkAlertCondition: function(alert, price) {
            const condition = alert.condition;
            if (condition.includes('>=')) {
                const threshold = parseFloat(condition.split('>=')[1]);
                return price >= threshold;
            } else if (condition.includes('<=')) {
                const threshold = parseFloat(condition.split('<=')[1]);
                return price <= threshold;
            } else if (condition.includes('>')) {
                const threshold = parseFloat(condition.split('>')[1]);
                return price > threshold;
            } else if (condition.includes('<')) {
                const threshold = parseFloat(condition.split('<')[1]);
                return price < threshold;
            }
            return false;
        },
        
        triggerAlert: function(alert, snapshot) {
            if (this.config.enableNotifications && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('MMN Price Alert', {
                    body: `${this.capitalize(alert.commodity)} price is $${snapshot.price.toFixed(2)} (${alert.condition})`,
                    icon: MMN_TRACKER_PLUGIN_URL + 'assets/images/icon.png'
                });
            }
            
            alert.last_triggered_at = new Date().toISOString();
            this.stores.alerts.setItem(alert.id, alert);
        },
        
        startPolling: function(widget, settings) {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
            }
            
            const intervalMs = settings.poll_interval * 60 * 1000;
            
            this.pollTimer = setInterval(() => {
                if (this.isOnline) {
                    this.refreshData(widget, settings);
                }
            }, intervalMs);
        },
        
        showOnlineStatus: function(online) {
            const widgets = document.querySelectorAll('.mmn-market-tracker');
            widgets.forEach(widget => {
                if (!online) {
                    this.showStatusMessage(widget, this.config.i18n.offline, 'warning');
                } else {
                    this.hideStatusMessage(widget);
                }
            });
        },
        
        showStatusMessage: function(widget, message, type = 'info') {
            const statusBar = widget.querySelector('.mmn-status-bar');
            if (statusBar) {
                statusBar.textContent = message;
                statusBar.className = 'mmn-status-bar mmn-status-' + type;
                statusBar.style.display = 'block';
            }
        },
        
        hideStatusMessage: function(widget) {
            const statusBar = widget.querySelector('.mmn-status-bar');
            if (statusBar) {
                statusBar.style.display = 'none';
            }
        },
        
        handleProxyError: function(widget, error) {
            if (error.message.includes('401')) {
                this.showStatusMessage(widget, this.config.i18n.serviceUnavailable, 'error');
            } else if (error.message.includes('429')) {
                this.showStatusMessage(widget, this.config.i18n.rateLimit, 'warning');
            } else {
                this.showStatusMessage(widget, 'Error loading data - showing cached prices', 'warning');
            }
        },
        
        handleMenuAction: async function(action, widget, settings) {
            switch (action) {
                case 'clear':
                    if (confirm('Clear all local data? This cannot be undone.')) {
                        await this.clearAllData();
                        location.reload();
                    }
                    break;
                    
                case 'export':
                    await this.exportToCSV();
                    break;
                    
                case 'help':
                    window.open('https://mymarketnews.ams.usda.gov/', '_blank');
                    break;
            }
        },
        
        clearAllData: async function() {
            await this.stores.priceSnapshots.clear();
            await this.stores.locations.clear();
            await this.stores.alerts.clear();
        },
        
        exportToCSV: async function() {
            const snapshots = [];
            await this.stores.priceSnapshots.iterate((value) => {
                snapshots.push(value);
            });
            
            if (snapshots.length === 0) {
                alert('No data to export');
                return;
            }
            
            let csv = 'Commodity,Price,Unit,Report Date,Fetched Date,Source\n';
            snapshots.forEach(s => {
                csv += `${s.commodity},${s.price || 'N/A'},${s.unit || 'N/A'},${s.reported_at},${s.fetched_at},${s.source}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mmn-price-data-' + new Date().toISOString().split('T')[0] + '.csv';
            a.click();
            URL.revokeObjectURL(url);
        },
        
        capitalize: function(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        generateUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MMNTrackerApp.init());
    } else {
        MMNTrackerApp.init();
    }
    
})();
