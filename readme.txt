=== MMN Market Tracker ===
Contributors: yourname
Tags: commodities, prices, agriculture, USDA, MyMarketNews
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Track US commodity prices using USDA MyMarketNews (MMN) API with local-first storage and secure server proxy.

== Description ==

MMN Market Tracker is a WordPress plugin that displays real-time commodity prices from the USDA MyMarketNews (MMN) API. It features:

* **Local-First Storage**: All user preferences, snapshots, and alerts are stored in the browser using IndexedDB
* **Secure Server Proxy**: API keys never exposed to the browser
* **Real-Time Updates**: Configurable polling intervals (15-1440 minutes)
* **Multiple Commodities**: Track corn, soybeans, wheat, cotton, rice, cattle, hogs, and more
* **Location-Based Pricing**: ZIP code lookup for local market prices
* **Price Alerts**: Set custom alerts with browser notifications
* **Offline Support**: Cached data available when offline
* **Privacy-Focused**: No user data stored on the server
* **Responsive Design**: Works on desktop, tablet, and mobile
* **Dark Mode**: Automatic dark mode support

== Installation ==

1. Upload the `mmn-market-tracker` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > MMN Market Tracker
4. Enter your MMN API key (get one at https://mymarketnews.ams.usda.gov/)
5. Configure default commodities and preferences
6. Add the widget using shortcode `[mmn_market_tracker]` or the Gutenberg block

== Frequently Asked Questions ==

= Where do I get an MMN API key? =

Visit https://mymarketnews.ams.usda.gov/mars-api to register and obtain your free API key.

= Is my data stored on the server? =

No. All user preferences, price snapshots, and alerts are stored locally in your browser using IndexedDB. The server only proxies API requests to protect your API key.

= How often are prices updated? =

By default, prices refresh every 60 minutes while the page is open. You can change this in Settings (15-1440 minutes).

= Can I track multiple commodities? =

Yes. Select multiple commodities in the widget or configure defaults in Settings.

= Does it work offline? =

Yes. The widget displays cached data when offline and shows a status message indicating the last sync time.

== Screenshots ==

1. Main widget showing commodity prices
2. Admin settings page
3. Price table with expandable rows
4. Mobile responsive view

== Changelog ==

= 1.0.0 =
* Initial release
* Support for USDA MyMarketNews API
* Local-first storage with IndexedDB
* Shortcode and Gutenberg block
* Price alerts and notifications
* ZIP-based location lookup
* Offline support
* Dark mode support

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Privacy Policy ==

This plugin:
* Stores user preferences locally in the browser (IndexedDB)
* Does NOT store any user data on the server
* Makes API requests to USDA MyMarketNews via server proxy
* The server proxy only injects the admin API key and forwards requests
* No personally identifiable information is collected or transmitted

== Support ==

For issues, questions, or feature requests:
* USDA MyMarketNews: https://mymarketnews.ams.usda.gov/
* MMN API Documentation: https://mymarketnews.ams.usda.gov/mars-api

== Credits ==

* Data provided by USDA MyMarketNews (MMN)
* LocalForage library for IndexedDB abstraction
