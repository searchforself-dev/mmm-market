<?php

if (!defined('ABSPATH')) {
    exit;
}

class MMN_Admin {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }
    
    public function add_admin_menu() {
        add_options_page(
            __('MMN Market Tracker Settings', 'mmn-market-tracker'),
            __('MMN Market Tracker', 'mmn-market-tracker'),
            'manage_options',
            'mmn-market-tracker',
            array($this, 'render_admin_page')
        );
    }
    
    public function register_settings() {
        register_setting('mmn_tracker_settings_group', 'mmn_tracker_settings', array($this, 'sanitize_settings'));
        
        add_settings_section(
            'mmn_tracker_main_section',
            __('MyMarketNews API Configuration', 'mmn-market-tracker'),
            array($this, 'render_section_info'),
            'mmn-market-tracker'
        );
        
        add_settings_field(
            'mmn_api_key',
            __('MMN API Key (required)', 'mmn-market-tracker'),
            array($this, 'render_api_key_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'proxy_endpoint',
            __('WP Proxy Endpoint', 'mmn-market-tracker'),
            array($this, 'render_proxy_endpoint_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'default_commodities',
            __('Default Commodities', 'mmn-market-tracker'),
            array($this, 'render_commodities_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'default_unit',
            __('Default Unit', 'mmn-market-tracker'),
            array($this, 'render_unit_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'poll_interval',
            __('Default Poll Interval (minutes)', 'mmn-market-tracker'),
            array($this, 'render_poll_interval_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'max_retention_days',
            __('Max Local Retention Days', 'mmn-market-tracker'),
            array($this, 'render_retention_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'enable_notifications',
            __('Enable Browser Notifications', 'mmn-market-tracker'),
            array($this, 'render_notifications_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
        
        add_settings_field(
            'attribution_text',
            __('Attribution Text', 'mmn-market-tracker'),
            array($this, 'render_attribution_field'),
            'mmn-market-tracker',
            'mmn_tracker_main_section'
        );
    }
    
    public function sanitize_settings($input) {
        $sanitized = array();
        
        if (isset($input['mmn_api_key'])) {
            $sanitized['mmn_api_key'] = sanitize_text_field($input['mmn_api_key']);
        }
        
        if (isset($input['default_commodities']) && is_array($input['default_commodities'])) {
            $sanitized['default_commodities'] = array_map('sanitize_text_field', $input['default_commodities']);
        }
        
        if (isset($input['default_unit'])) {
            $sanitized['default_unit'] = sanitize_text_field($input['default_unit']);
        }
        
        if (isset($input['poll_interval'])) {
            $sanitized['poll_interval'] = absint($input['poll_interval']);
        }
        
        if (isset($input['max_retention_days'])) {
            $sanitized['max_retention_days'] = absint($input['max_retention_days']);
        }
        
        if (isset($input['enable_notifications'])) {
            $sanitized['enable_notifications'] = (bool) $input['enable_notifications'];
        }
        
        if (isset($input['attribution_text'])) {
            $sanitized['attribution_text'] = sanitize_text_field($input['attribution_text']);
        }
        
        return $sanitized;
    }
    
    public function render_section_info() {
        ?>
        <div class="notice notice-warning inline">
            <p><strong><?php _e('Important Security Notice:', 'mmn-market-tracker'); ?></strong></p>
            <p><?php _e('All user preferences, snapshots and alerts are stored locally in the user\'s browser (IndexedDB) and are not transmitted to this site. The plugin uses the USDA MyMarketNews (MMN) API via a secure server proxy that only injects the admin API key (stored in WP options). No user data is stored on the server by default. See MMN terms for permissible use of data.', 'mmn-market-tracker'); ?></p>
            <p><strong><?php _e('MMN keys must not be exposed to the browser. A server proxy is required.', 'mmn-market-tracker'); ?></strong></p>
        </div>
        <?php
    }
    
    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        if (isset($_GET['settings-updated'])) {
            add_settings_error('mmn_tracker_messages', 'mmn_tracker_message', __('Settings Saved', 'mmn-market-tracker'), 'updated');
        }
        
        settings_errors('mmn_tracker_messages');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields('mmn_tracker_settings_group');
                do_settings_sections('mmn-market-tracker');
                submit_button(__('Save Settings', 'mmn-market-tracker'));
                ?>
            </form>
            
            <hr>
            
            <h2><?php _e('Help & Resources', 'mmn-market-tracker'); ?></h2>
            <ul>
                <li><a href="https://mymarketnews.ams.usda.gov/" target="_blank"><?php _e('USDA MyMarketNews Portal', 'mmn-market-tracker'); ?></a></li>
                <li><a href="https://mymarketnews.ams.usda.gov/mars-api" target="_blank"><?php _e('MMN API Documentation', 'mmn-market-tracker'); ?></a></li>
                <li><a href="https://mymarketnews.ams.usda.gov/mars-api/key-management" target="_blank"><?php _e('API Key Management', 'mmn-market-tracker'); ?></a></li>
            </ul>
        </div>
        <?php
    }
    
    public function render_api_key_field() {
        $options = get_option('mmn_tracker_settings');
        $value = isset($options['mmn_api_key']) ? $options['mmn_api_key'] : '';
        $has_key = !empty($value);
        ?>
        <input type="text" 
               name="mmn_tracker_settings[mmn_api_key]" 
               value="<?php echo esc_attr($value); ?>" 
               class="regular-text" 
               placeholder="Enter your MMN API key"
               required>
        <?php if (!$has_key): ?>
            <p class="description" style="color: #d63638;">
                <strong><?php _e('⚠️ API key required:', 'mmn-market-tracker'); ?></strong>
                <?php _e('Get your free API key at', 'mmn-market-tracker'); ?>
                <a href="https://mymarketnews.ams.usda.gov/mars-api" target="_blank">mymarketnews.ams.usda.gov/mars-api</a>
            </p>
        <?php endif; ?>
        <p class="description">
            <?php _e('Paste your MMN API key here. This key will be stored in WordPress options and used by the server proxy to call MMN. Do NOT expose this key to site visitors or client-side code.', 'mmn-market-tracker'); ?>
        </p>
        <?php
    }
    
    public function render_proxy_endpoint_field() {
        $endpoint = rest_url('mmn-proxy/v1/query');
        ?>
        <input type="text" value="<?php echo esc_attr($endpoint); ?>" class="regular-text" readonly>
        <p class="description">
            <?php _e('Plugin REST route for frontend calls. The proxy injects the MMN API key server-side and forwards allowed actions only.', 'mmn-market-tracker'); ?>
        </p>
        <?php
    }
    
    public function render_commodities_field() {
        $options = get_option('mmn_tracker_settings');
        $selected = isset($options['default_commodities']) ? $options['default_commodities'] : array('corn', 'soybeans', 'wheat', 'cotton', 'rice');
        $commodities = array('corn', 'soybeans', 'wheat', 'cotton', 'rice', 'cattle', 'hogs', 'poultry');
        
        foreach ($commodities as $commodity) {
            $checked = in_array($commodity, $selected) ? 'checked' : '';
            ?>
            <label style="display: inline-block; margin-right: 15px;">
                <input type="checkbox" 
                       name="mmn_tracker_settings[default_commodities][]" 
                       value="<?php echo esc_attr($commodity); ?>" 
                       <?php echo $checked; ?>>
                <?php echo esc_html(ucfirst($commodity)); ?>
            </label>
            <?php
        }
        ?>
        <p class="description"><?php _e('Select default commodities to track.', 'mmn-market-tracker'); ?></p>
        <?php
    }
    
    public function render_unit_field() {
        $options = get_option('mmn_tracker_settings');
        $selected = isset($options['default_unit']) ? $options['default_unit'] : 'bushel';
        $units = array('bushel', 'ton', 'cwt', 'lb');
        ?>
        <select name="mmn_tracker_settings[default_unit]">
            <?php foreach ($units as $unit): ?>
                <option value="<?php echo esc_attr($unit); ?>" <?php selected($selected, $unit); ?>>
                    <?php echo esc_html(ucfirst($unit)); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description"><?php _e('Default unit for price display.', 'mmn-market-tracker'); ?></p>
        <?php
    }
    
    public function render_poll_interval_field() {
        $options = get_option('mmn_tracker_settings');
        $value = isset($options['poll_interval']) ? $options['poll_interval'] : 60;
        ?>
        <input type="number" 
               name="mmn_tracker_settings[poll_interval]" 
               value="<?php echo esc_attr($value); ?>" 
               min="15" 
               max="1440" 
               step="15">
        <p class="description"><?php _e('How often to refresh prices while page is open (15-1440 minutes). Default: 60 minutes.', 'mmn-market-tracker'); ?></p>
        <?php
    }
    
    public function render_retention_field() {
        $options = get_option('mmn_tracker_settings');
        $value = isset($options['max_retention_days']) ? $options['max_retention_days'] : 365;
        ?>
        <input type="number" 
               name="mmn_tracker_settings[max_retention_days]" 
               value="<?php echo esc_attr($value); ?>" 
               min="30" 
               max="730">
        <p class="description"><?php _e('Maximum days to retain local price snapshots. Default: 365 days.', 'mmn-market-tracker'); ?></p>
        <?php
    }
    
    public function render_notifications_field() {
        $options = get_option('mmn_tracker_settings');
        $checked = isset($options['enable_notifications']) ? $options['enable_notifications'] : true;
        ?>
        <label>
            <input type="checkbox" 
                   name="mmn_tracker_settings[enable_notifications]" 
                   value="1" 
                   <?php checked($checked, true); ?>>
            <?php _e('Enable browser notifications for price alerts', 'mmn-market-tracker'); ?>
        </label>
        <?php
    }
    
    public function render_attribution_field() {
        $options = get_option('mmn_tracker_settings');
        $value = isset($options['attribution_text']) ? $options['attribution_text'] : 'Data provided by USDA MyMarketNews (MMN).';
        ?>
        <input type="text" 
               name="mmn_tracker_settings[attribution_text]" 
               value="<?php echo esc_attr($value); ?>" 
               class="large-text">
        <p class="description"><?php _e('Attribution text displayed in widget footer.', 'mmn-market-tracker'); ?></p>
        <?php
    }
}
