# MMN Market Tracker WordPress Plugin

A comprehensive WordPress plugin for tracking US commodity prices using the USDA MyMarketNews (MMN) API.

## Features

- **Local-First Storage**: All user data stored in browser IndexedDB
- **Secure Server Proxy**: API keys protected server-side
- **Real-Time Updates**: Configurable polling (15-1440 minutes)
- **Multiple Commodities**: Corn, soybeans, wheat, cotton, rice, cattle, hogs, and more
- **Location-Based**: ZIP code lookup for local market prices
- **Price Alerts**: Custom thresholds with browser notifications
- **Offline Support**: Cached data when disconnected
- **Privacy-Focused**: No server-side user data storage
- **Responsive**: Desktop, tablet, and mobile
- **Dark Mode**: Automatic theme support

## Installation

### Method 1: Manual Upload

1. Download the `mmn-market-tracker` folder
2. Upload to `/wp-content/plugins/` on your WordPress server
3. Activate via WordPress Admin > Plugins
4. Configure at Settings > MMN Market Tracker

### Method 2: ZIP Upload

1. Compress the `mmn-market-tracker` folder as a ZIP file
2. Go to WordPress Admin > Plugins > Add New > Upload Plugin
3. Upload the ZIP file
4. Activate and configure

## Configuration

### Required: MMN API Key

1. Visit [USDA MyMarketNews MARS API](https://mymarketnews.ams.usda.gov/mars-api)
2. Register for a free API key
3. In WordPress Admin, go to Settings > MMN Market Tracker
4. Enter your API key
5. Configure default commodities, units, and preferences

### Admin Settings

- **MMN API Key**: Your MyMarketNews API key (required)
- **Default Commodities**: Pre-select commodities to track
- **Default Unit**: bushel, ton, cwt, or lb
- **Poll Interval**: How often to refresh (default: 60 minutes)
- **Max Retention Days**: How long to keep cached data (default: 365 days)
- **Enable Notifications**: Browser push notifications for alerts
- **Attribution Text**: Customize footer attribution

## Usage

### Shortcode

Add to any post or page:

```
[mmn_market_tracker]
```

With parameters:

```
[mmn_market_tracker commodities="corn,soybeans" zip="50310" unit="bushel"]
```

### Gutenberg Block

1. Add block > Widgets > MMN Market Tracker
2. Configure in block settings sidebar
3. Preview in editor, renders on frontend

### Widget Features

- **ZIP Lookup**: Enter ZIP code for local market prices
- **Commodity Selector**: Choose which commodities to track
- **Refresh Button**: Manual data refresh
- **Expandable Rows**: Click rows to see full MMN response data
- **Menu Options**:
  - Clear Local Data
  - Export CSV
  - Help (links to MMN docs)

## Architecture

### Frontend (Browser)

- **UI**: Vanilla JavaScript ES6+
- **Storage**: LocalForage (IndexedDB wrapper)
- **Stores**: settings, locations, price_snapshots, alerts
- **No server-side user data**: 100% client-side persistence

### Backend (WordPress/PHP)

- **Proxy**: REST API endpoint at `/wp-json/mmn-proxy/v1/query`
- **Security**: Validates actions, rate limiting, API key injection
- **Allowed Actions**:
  - `reportsIndex`: List reports by commodity/state
  - `reportDetails`: Fetch specific report data
  - `reportsByState`: Filter reports by state + commodity

### Data Flow

1. Widget loads cached data from IndexedDB immediately
2. If online, calls WP proxy with action + params
3. Proxy validates request, adds API key, calls MMN
4. Response returned to browser
5. Browser saves to IndexedDB, updates UI
6. Polling continues at configured interval

## Privacy & Security

### User Privacy

- ✅ All preferences stored in browser (IndexedDB)
- ✅ No user data sent to server
- ✅ No cookies or tracking
- ✅ GDPR-friendly design

### API Security

- ✅ API key stored in WordPress options (server-side only)
- ✅ Never exposed to browser or client-side code
- ✅ Proxy validates all parameters
- ✅ Rate limiting on proxy endpoint
- ✅ Action whitelist (only 3 allowed actions)

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Mobile browsers (iOS Safari 11+, Chrome Android)

## File Structure

```
mmn-market-tracker/
├── mmn-market-tracker.php          # Main plugin file
├── readme.txt                      # WordPress.org readme
├── README.md                       # This file
├── includes/
│   ├── class-mmn-admin.php         # Admin settings page
│   ├── class-mmn-proxy.php         # REST API proxy
│   ├── class-mmn-shortcode.php     # Shortcode handler
│   ├── class-mmn-block.php         # Gutenberg block
│   └── class-mmn-assets.php        # Asset enqueue manager
└── assets/
    ├── css/
    │   └── mmn-tracker.css         # Widget styles
    └── js/
        ├── mmn-tracker-app.js      # Main frontend app
        └── block-editor.js         # Gutenberg block editor
```

## MMN API Integration

### Endpoint

Base URL: `https://marsapi.ams.usda.gov/services/v1.2/reports`

### Authentication

Header: `x-api-key: YOUR_API_KEY`

### Response Mapping

The plugin intelligently extracts price data from varied MMN response formats:

1. Looks for: `price`, `value`, `amount`, `pricePerUnit` fields
2. Unit from: `unit`, `units`, `priceUnit` fields
3. Date from: `reportDate`, `date`, `reportedAt`, `published`
4. Stores full response in `meta` for complete data preservation

## Troubleshooting

### "Invalid MMN API key" error

- Verify key in Settings > MMN Market Tracker
- Check key is active at https://mymarketnews.ams.usda.gov/mars-api/key-management

### "Rate limit reached" message

- MMN has rate limits per API key
- Widget shows cached data and pauses polling
- Will auto-resume after limit resets

### Widget not loading

- Check JavaScript console for errors
- Ensure LocalForage CDN is accessible
- Verify shortcode spelling: `[mmn_market_tracker]`

### No data for ZIP code

- Some ZIPs may not have local market reports
- Widget shows "No market reports found for ZIP"
- Try nearby ZIP or leave blank for general data

## Development

### Requirements

- WordPress 5.8+
- PHP 7.4+
- Modern browser with IndexedDB support

### Local Development

1. Clone to `/wp-content/plugins/`
2. No build process required (vanilla JS/CSS)
3. For block development, use `@wordpress/scripts` if needed

### API Testing

Test proxy endpoint directly:

```bash
curl -X POST https://yoursite.com/wp-json/mmn-proxy/v1/query \
  -H "Content-Type: application/json" \
  -d '{"action":"reportsIndex","commodity":"corn","page":1}'
```

## Support

- **MMN Documentation**: https://mymarketnews.ams.usda.gov/mars-api
- **API Key Management**: https://mymarketnews.ams.usda.gov/mars-api/key-management
- **USDA MMN Portal**: https://mymarketnews.ams.usda.gov/

## License

GPL v2 or later

## Credits

- Data provided by USDA MyMarketNews (MMN)
- LocalForage by Mozilla: https://github.com/localForage/localForage

## Changelog

### 1.0.0 (2024-10-20)
- Initial release
- MMN API integration with secure proxy
- Local-first IndexedDB storage
- Shortcode and Gutenberg block
- ZIP-based location lookup
- Price alerts with browser notifications
- Offline support
- Dark mode
- Responsive design
- CSV export
