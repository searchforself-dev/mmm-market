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
            
            const settings = await this.stores.settings.getItem('local-settings');
            
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
            if (!zip || zip.length !== 5) {
                return 'IA';
            }
            
            const zipToState = this.getZipToStateMapping();
            const zipInt = parseInt(zip);
            
            for (const [range, state] of zipToState) {
                if (zipInt >= range[0] && zipInt <= range[1]) {
                    return state;
                }
            }
            
            return 'IA';
        },
        
        getZipToStateMapping: function() {
            return [
                [[501, 524], 'NY'], [[10001, 14999], 'NY'],
                [[15001, 19699], 'PA'],
                [[20001, 20599], 'DC'],
                [[20601, 21999], 'MD'],
                [[22001, 24699], 'VA'],
                [[27001, 28999], 'NC'],
                [[29001, 29999], 'SC'],
                [[30001, 31999], 'GA'],
                [[32001, 34999], 'FL'],
                [[35001, 36999], 'AL'],
                [[37001, 38599], 'TN'],
                [[38601, 39799], 'MS'],
                [[39801, 39999], 'GA'],
                [[40001, 42799], 'KY'],
                [[43001, 45999], 'OH'],
                [[46001, 47999], 'IN'],
                [[48001, 49999], 'MI'],
                [[50001, 52999], 'IA'],
                [[53001, 54999], 'WI'],
                [[55001, 56799], 'MN'],
                [[57001, 57799], 'SD'],
                [[58001, 58899], 'ND'],
                [[59001, 59999], 'MT'],
                [[60001, 62999], 'IL'],
                [[63001, 65899], 'MO'],
                [[66001, 67999], 'KS'],
                [[68001, 69399], 'NE']
            ];
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
