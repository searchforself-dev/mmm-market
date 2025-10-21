<?php
/**
 * Plugin Name: MMN Market Tracker
 * Plugin URI: https://github.com/yourusername/mmn-market-tracker
 * Description: Track US commodity prices using USDA MyMarketNews (MMN) API with local-first storage and secure server proxy
 * Version: 1.0.0
 * Author: Your Name
 * Author URI: https://yourwebsite.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: mmn-market-tracker
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MMN_TRACKER_VERSION', '1.0.0');
define('MMN_TRACKER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MMN_TRACKER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('MMN_TRACKER_PLUGIN_FILE', __FILE__);

class MMN_Market_Tracker {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->includes();
        $this->init_hooks();
    }
    
    private function includes() {
        require_once MMN_TRACKER_PLUGIN_DIR . 'includes/class-mmn-admin.php';
        require_once MMN_TRACKER_PLUGIN_DIR . 'includes/class-mmn-proxy.php';
        require_once MMN_TRACKER_PLUGIN_DIR . 'includes/class-mmn-shortcode.php';
        require_once MMN_TRACKER_PLUGIN_DIR . 'includes/class-mmn-block.php';
        require_once MMN_TRACKER_PLUGIN_DIR . 'includes/class-mmn-assets.php';
    }
    
    private function init_hooks() {
        register_activation_hook(MMN_TRACKER_PLUGIN_FILE, array($this, 'activate'));
        register_deactivation_hook(MMN_TRACKER_PLUGIN_FILE, array($this, 'deactivate'));
        
        add_action('plugins_loaded', array($this, 'load_textdomain'));
        add_action('init', array($this, 'init'));
    }
    
    public function activate() {
        $default_options = array(
            'mmn_api_key' => '',
            'default_commodities' => array('corn', 'soybeans', 'wheat', 'cotton', 'rice'),
            'default_unit' => 'bushel',
            'poll_interval' => 60,
            'max_retention_days' => 365,
            'enable_notifications' => true,
            'attribution_text' => 'Data provided by USDA MyMarketNews (MMN).'
        );
        
        if (!get_option('mmn_tracker_settings')) {
            add_option('mmn_tracker_settings', $default_options);
        }
        
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    public function load_textdomain() {
        load_plugin_textdomain('mmn-market-tracker', false, dirname(plugin_basename(MMN_TRACKER_PLUGIN_FILE)) . '/languages');
    }
    
    public function init() {
        MMN_Admin::get_instance();
        MMN_Proxy::get_instance();
        MMN_Shortcode::get_instance();
        MMN_Block::get_instance();
        MMN_Assets::get_instance();
    }
}

function mmn_market_tracker() {
    return MMN_Market_Tracker::get_instance();
}

mmn_market_tracker();
