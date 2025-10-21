<?php

if (!defined('ABSPATH')) {
    exit;
}

class MMN_Block {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('init', array($this, 'register_block'));
    }
    
    public function register_block() {
        if (!function_exists('register_block_type')) {
            return;
        }
        
        wp_register_script(
            'mmn-block-editor',
            MMN_TRACKER_PLUGIN_URL . 'assets/js/block-editor.js',
            array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components', 'wp-i18n'),
            MMN_TRACKER_VERSION,
            true
        );
        
        register_block_type('mmn/market-tracker', array(
            'editor_script' => 'mmn-block-editor',
            'render_callback' => array($this, 'render_block'),
            'attributes' => array(
                'commodities' => array(
                    'type' => 'string',
                    'default' => ''
                ),
                'zip' => array(
                    'type' => 'string',
                    'default' => ''
                ),
                'unit' => array(
                    'type' => 'string',
                    'default' => ''
                )
            )
        ));
    }
    
    public function render_block($attributes) {
        $shortcode_atts = array();
        
        if (!empty($attributes['commodities'])) {
            $shortcode_atts[] = 'commodities="' . esc_attr($attributes['commodities']) . '"';
        }
        
        if (!empty($attributes['zip'])) {
            $shortcode_atts[] = 'zip="' . esc_attr($attributes['zip']) . '"';
        }
        
        if (!empty($attributes['unit'])) {
            $shortcode_atts[] = 'unit="' . esc_attr($attributes['unit']) . '"';
        }
        
        $shortcode = '[mmn_market_tracker ' . implode(' ', $shortcode_atts) . ']';
        
        return do_shortcode($shortcode);
    }
}
