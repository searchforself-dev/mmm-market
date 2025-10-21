<?php

if (!defined('ABSPATH')) {
    exit;
}

class MMN_Assets {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_assets'));
    }
    
    public function enqueue_frontend_assets() {
        if (!$this->should_load_assets()) {
            return;
        }
        
        wp_enqueue_style(
            'mmn-tracker-styles',
            MMN_TRACKER_PLUGIN_URL . 'assets/css/mmn-tracker.css',
            array(),
            MMN_TRACKER_VERSION
        );
        
        wp_enqueue_script(
            'localforage',
            'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
            array(),
            '1.10.0',
            true
        );
        
        wp_enqueue_script(
            'mmn-tracker-app',
            MMN_TRACKER_PLUGIN_URL . 'assets/js/mmn-tracker-app.js',
            array('localforage'),
            MMN_TRACKER_VERSION,
            true
        );
        
        $options = get_option('mmn_tracker_settings');
        
        wp_localize_script('mmn-tracker-app', 'mmnTrackerConfig', array(
            'proxyUrl' => rest_url('mmn-proxy/v1/query'),
            'nonce' => wp_create_nonce('wp_rest'),
            'defaultCommodities' => $options['default_commodities'] ?? array('corn', 'soybeans', 'wheat'),
            'defaultUnit' => $options['default_unit'] ?? 'bushel',
            'pollInterval' => $options['poll_interval'] ?? 60,
            'maxRetentionDays' => $options['max_retention_days'] ?? 365,
            'enableNotifications' => $options['enable_notifications'] ?? true,
            'attributionText' => $options['attribution_text'] ?? 'Data provided by USDA MyMarketNews (MMN).',
            'i18n' => array(
                'offline' => __('Offline — displaying cached prices. Last sync:', 'mmn-market-tracker'),
                'noData' => __('No market reports found for ZIP', 'mmn-market-tracker'),
                'rateLimit' => __('MMN rate limit reached — refresh paused. Showing cached data.', 'mmn-market-tracker'),
                'serviceUnavailable' => __('Price service unavailable — contact site admin.', 'mmn-market-tracker'),
                'loadingMarketData' => __('Loading market data...', 'mmn-market-tracker'),
                'refreshData' => __('Refresh Data', 'mmn-market-tracker'),
                'clearData' => __('Clear Local Data', 'mmn-market-tracker'),
                'exportCSV' => __('Export CSV', 'mmn-market-tracker'),
                'useMyLocation' => __('Use My Location', 'mmn-market-tracker'),
                'commodity' => __('Commodity', 'mmn-market-tracker'),
                'localPrice' => __('Local Price', 'mmn-market-tracker'),
                'unit' => __('Unit', 'mmn-market-tracker'),
                'reportDate' => __('Report Date', 'mmn-market-tracker'),
                'source' => __('Source', 'mmn-market-tracker'),
                'saveSnapshot' => __('Save Snapshot', 'mmn-market-tracker'),
                'addAlert' => __('Add Alert', 'mmn-market-tracker'),
                'viewChart' => __('View Chart', 'mmn-market-tracker')
            )
        ));
    }
    
    private function should_load_assets() {
        global $post;
        
        if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'mmn_market_tracker')) {
            return true;
        }
        
        if (has_block('mmn/market-tracker')) {
            return true;
        }
        
        return false;
    }
}
