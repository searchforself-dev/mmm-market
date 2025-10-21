# MMN Market Tracker - Installation Guide

## Quick Start (3 Steps)

### Step 1: Upload Plugin to WordPress

Choose one of these methods:

#### Method A: Direct Upload (Recommended)
1. Download the entire `mmn-market-tracker` folder from this Replit
2. Compress it as a ZIP file:
   - **Windows**: Right-click folder > Send to > Compressed (zipped) folder
   - **Mac**: Right-click folder > Compress "mmn-market-tracker"
   - **Linux**: `zip -r mmn-market-tracker.zip mmn-market-tracker/`
3. In WordPress Admin, go to: **Plugins > Add New > Upload Plugin**
4. Choose the ZIP file and click **Install Now**
5. Click **Activate Plugin**

#### Method B: FTP/SFTP Upload
1. Download the `mmn-market-tracker` folder
2. Connect to your WordPress server via FTP/SFTP
3. Upload the entire folder to: `/wp-content/plugins/`
4. In WordPress Admin, go to **Plugins** and activate "MMN Market Tracker"

### Step 2: Get Your MMN API Key

1. Visit: https://mymarketnews.ams.usda.gov/mars-api
2. Register for a free API key (if you don't have one)
3. Copy your API key

### Step 3: Configure Plugin

1. In WordPress, go to: **Settings > MMN Market Tracker**
2. Paste your MMN API key in the "MMN API Key" field
3. Configure default commodities (corn, soybeans, wheat, etc.)
4. Set default unit (bushel, ton, cwt, lb)
5. Click **Save Settings**

### Step 4: Add Widget to Page

#### Option A: Use Shortcode (Any Page/Post)
1. Edit any page or post
2. Add this shortcode: `[mmn_market_tracker]`
3. Publish and view the page

#### Option B: Use Gutenberg Block
1. Edit any page or post
2. Click **+** to add a block
3. Search for "MMN Market Tracker"
4. Add the block
5. Configure in the sidebar settings
6. Publish and view the page

## What You Get

The widget will display:
- Real-time commodity prices from USDA MyMarketNews
- ZIP code lookup for local markets
- Price table with expandable rows showing full data
- Offline support with cached data
- Auto-refresh every 60 minutes (configurable)
- Dark mode support
- Mobile responsive design

## Verifying Installation

### Check Plugin Files

SSH into your server and verify:

```bash
cd /path/to/wordpress/wp-content/plugins/mmn-market-tracker
ls -la
```

You should see:
```
mmn-market-tracker.php
readme.txt
README.md
includes/
assets/
```

### Check Admin Settings

1. Go to: **Settings > MMN Market Tracker**
2. Verify API key is present
3. Check proxy endpoint shows: `/wp-json/mmn-proxy/v1/query`

### Test Proxy Endpoint

Open browser developer tools (F12) and run:

```javascript
fetch('/wp-json/mmn-proxy/v1/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'reportsIndex',
    commodity: 'corn',
    page: 1
  })
})
.then(r => r.json())
.then(console.log)
```

Should return MMN report data.

### Test Widget on Page

1. Add shortcode `[mmn_market_tracker]` to a test page
2. View the page
3. Open browser console (F12)
4. Should see: "Loading market data..."
5. After a few seconds, price table should populate

## Troubleshooting

### Plugin Not Appearing in Admin

**Problem**: Plugin doesn't show in Plugins list

**Solution**:
1. Verify folder name is exactly: `mmn-market-tracker`
2. Verify main file is: `mmn-market-tracker/mmn-market-tracker.php`
3. Check file permissions: `chmod 755 mmn-market-tracker/`
4. Check PHP error log for syntax errors

### "Invalid MMN API Key" Error

**Problem**: Admin shows invalid API key

**Solution**:
1. Verify key at: https://mymarketnews.ams.usda.gov/mars-api/key-management
2. Ensure no extra spaces in the key field
3. Try regenerating key in MMN portal
4. Check server can reach MMN API (firewall/proxy)

### Widget Shows "Loading..." Forever

**Problem**: Widget stuck on loading screen

**Solution**:
1. Open browser console (F12) and check for errors
2. Verify LocalForage CDN is accessible:
   - Check network tab for failed requests
   - Some ad blockers may block CDN
3. Check if IndexedDB is enabled in browser
4. Try different browser (Chrome, Firefox, Safari)

### "Price Service Unavailable" Message

**Problem**: Widget shows service unavailable error

**Solution**:
1. Check WordPress admin: **Settings > MMN Market Tracker**
2. Verify API key is entered and saved
3. Check proxy endpoint is accessible
4. Test proxy manually (see "Test Proxy Endpoint" above)

### No Data for ZIP Code

**Problem**: Widget says "No market reports found for ZIP"

**Solution**:
1. Try a different ZIP code in a major agricultural area
2. Leave ZIP blank to see general/national data
3. Verify the commodity is actually traded in that region
4. Check MMN directly: https://mymarketnews.ams.usda.gov/

### JavaScript Errors in Console

**Problem**: Console shows JavaScript errors

**Solution**:
1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
2. Disable other plugins that might conflict
3. Switch to default WordPress theme (Twenty Twenty-Four) to test
4. Check if jQuery or other scripts are conflicting

## Advanced Configuration

### Custom Polling Interval

In **Settings > MMN Market Tracker**, change **Poll Interval**:
- Fast updates: 15 minutes
- Balanced: 60 minutes (default)
- Slow updates: 120-1440 minutes

### Custom Commodities

In shortcode:
```
[mmn_market_tracker commodities="cattle,hogs,poultry"]
```

In Gutenberg block:
- Settings sidebar > Commodities field > "cattle,hogs,poultry"

### Custom Default ZIP

In shortcode:
```
[mmn_market_tracker zip="50310"]
```

Users can still change ZIP in the widget.

## Browser Compatibility

Minimum versions:
- Chrome 60+ (2017)
- Firefox 55+ (2017)
- Safari 11+ (2017)
- Edge 79+ (2020)
- Mobile: iOS 11+, Android Chrome 60+

IndexedDB required (all modern browsers support it).

## Server Requirements

- WordPress 5.8+
- PHP 7.4+ (8.0+ recommended)
- `allow_url_fopen` enabled (for MMN API calls)
- No MySQL requirements (all data in browser)
- HTTPS recommended (for geolocation features)

## Security Checklist

✅ API key stored server-side only (WordPress options table)  
✅ Never exposed to browser or client code  
✅ Proxy validates all requests  
✅ Only 3 whitelisted actions allowed  
✅ No user data stored on server  
✅ No cookies or tracking  
✅ GDPR compliant (browser-only storage)  

## Performance Tips

1. **Increase Poll Interval**: Set to 120+ minutes for less frequent updates
2. **Reduce Retention Days**: Lower from 365 to 90 days to save browser storage
3. **Select Fewer Commodities**: Track only what you need
4. **Enable Browser Notifications**: Let users know when prices change without constant checking

## API Rate Limits

USDA MyMarketNews API has rate limits:
- If you see "Rate limit reached" message
- Widget automatically shows cached data
- Polling pauses until limit resets
- No action needed - it handles this automatically

## Data Privacy & GDPR

This plugin is GDPR-friendly:
- ✅ No personal data collected
- ✅ No cookies set
- ✅ All data stored in user's browser (IndexedDB)
- ✅ Users control their own data
- ✅ "Clear Local Data" option available
- ✅ No data sent to third parties (except USDA MMN API for prices)

## Getting Help

1. **MMN API Issues**: https://mymarketnews.ams.usda.gov/mars-api
2. **API Key Management**: https://mymarketnews.ams.usda.gov/mars-api/key-management
3. **USDA Support**: Contact USDA MyMarketNews support
4. **WordPress Issues**: Check WordPress.org forums

## Updating the Plugin

When a new version is released:
1. Deactivate plugin in WordPress Admin
2. Delete old `mmn-market-tracker` folder via FTP
3. Upload new version
4. Reactivate plugin
5. User data preserved (stored in browser, not affected)

## Uninstalling

To completely remove:
1. Deactivate plugin in WordPress Admin
2. Click "Delete" on the plugin
3. WordPress removes plugin files and database options
4. Users still have their local data (in browser)
5. Users can click "Clear Local Data" in widget menu to remove

## Next Steps

After installation:
1. ✅ Test widget on a page
2. ✅ Verify prices are loading
3. ✅ Test ZIP code lookup
4. ✅ Try different commodities
5. ✅ Set up a price alert
6. ✅ Test on mobile device
7. ✅ Share with your users!

---

**Plugin Version**: 1.0.0  
**Last Updated**: 2024-10-20  
**Support**: See documentation at https://mymarketnews.ams.usda.gov/
