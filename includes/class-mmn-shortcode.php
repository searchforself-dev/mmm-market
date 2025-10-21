<?php

if (!defined('ABSPATH')) {
    exit;
}

class MMN_Shortcode {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_shortcode('mmn_market_tracker', array($this, 'render_shortcode'));
    }
    
    public function render_shortcode($atts) {
        $atts = shortcode_atts(array(
            'commodities' => '',
            'zip' => '',
            'unit' => ''
        ), $atts, 'mmn_market_tracker');
        
        $options = get_option('mmn_tracker_settings');
        
        $widget_id = 'mmn-tracker-' . wp_generate_uuid4();
        
        ob_start();
        ?>
        <div id="<?php echo esc_attr($widget_id); ?>" 
             class="mmn-market-tracker" 
             data-commodities="<?php echo esc_attr($atts['commodities']); ?>"
             data-zip="<?php echo esc_attr($atts['zip']); ?>"
             data-unit="<?php echo esc_attr($atts['unit']); ?>"
             data-poll-interval="<?php echo esc_attr($options['poll_interval'] ?? 60); ?>"
             data-max-retention="<?php echo esc_attr($options['max_retention_days'] ?? 365); ?>"
             data-enable-notifications="<?php echo esc_attr($options['enable_notifications'] ?? 1); ?>"
             data-attribution="<?php echo esc_attr($options['attribution_text'] ?? 'Data provided by USDA MyMarketNews (MMN).'); ?>">
            <div class="mmn-loading">
                <div class="mmn-spinner"></div>
                <p><?php _e('Loading market data...', 'mmn-market-tracker'); ?></p>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
