<?php

if (!defined('ABSPATH')) {
    exit;
}

class MMN_Proxy {
    
    private static $instance = null;
    private $mmn_base_url = 'https://marsapi.ams.usda.gov/services/v1.2/reports';
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('rest_api_init', array($this, 'register_routes'));
    }
    
    public function register_routes() {
        register_rest_route('mmn-proxy/v1', '/query', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_proxy_request'),
            'permission_callback' => '__return_true',
        ));
    }
    
    public function handle_proxy_request($request) {
        $params = $request->get_json_params();
        
        if (empty($params['action'])) {
            return new WP_Error('no_action', __('Action parameter is required', 'mmn-market-tracker'), array('status' => 400));
        }
        
        $action = sanitize_text_field($params['action']);
        
        $allowed_actions = array('reportsIndex', 'reportDetails', 'reportsByState');
        if (!in_array($action, $allowed_actions)) {
            return new WP_Error('invalid_action', __('Invalid action specified', 'mmn-market-tracker'), array('status' => 400));
        }
        
        $cache_key = $this->get_cache_key($action, $params);
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            return rest_ensure_response($cached);
        }
        
        $options = get_option('mmn_tracker_settings');
        $api_key = isset($options['mmn_api_key']) ? $options['mmn_api_key'] : '';
        
        if (empty($api_key)) {
            return new WP_Error('no_api_key', __('MMN API key not configured. Please contact site administrator.', 'mmn-market-tracker'), array('status' => 503));
        }
        
        switch ($action) {
            case 'reportsIndex':
                return $this->fetch_reports_index($api_key, $params, $cache_key);
            
            case 'reportDetails':
                return $this->fetch_report_details($api_key, $params, $cache_key);
            
            case 'reportsByState':
                return $this->fetch_reports_by_state($api_key, $params, $cache_key);
            
            default:
                return new WP_Error('invalid_action', __('Invalid action', 'mmn-market-tracker'), array('status' => 400));
        }
    }
    
    private function get_cache_key($action, $params) {
        $key_data = array(
            'action' => $action,
            'commodity' => $params['commodity'] ?? '',
            'state' => $params['state'] ?? '',
            'reportId' => $params['reportId'] ?? '',
            'lastDays' => $params['lastDays'] ?? '',
            'startDate' => $params['startDate'] ?? '',
            'endDate' => $params['endDate'] ?? '',
            'page' => $params['page'] ?? '',
            'pageSize' => $params['pageSize'] ?? ''
        );
        return 'mmn_cache_' . md5(serialize($key_data));
    }
    
    private function fetch_reports_index($api_key, $params, $cache_key = null) {
        $query_params = array();
        
        if (!empty($params['commodity'])) {
            $query_params['q'] = sanitize_text_field($params['commodity']);
        }
        
        if (!empty($params['state'])) {
            $query_params['state'] = sanitize_text_field($params['state']);
        }
        
        if (isset($params['page'])) {
            $query_params['page'] = absint($params['page']);
        }
        
        if (isset($params['pageSize'])) {
            $page_size = absint($params['pageSize']);
            $query_params['pageSize'] = min($page_size, 100);
        }
        
        $url = add_query_arg($query_params, $this->mmn_base_url);
        
        return $this->make_mmn_request($url, $api_key, $cache_key);
    }
    
    private function fetch_report_details($api_key, $params, $cache_key = null) {
        if (empty($params['reportId'])) {
            return new WP_Error('no_report_id', __('Report ID is required', 'mmn-market-tracker'), array('status' => 400));
        }
        
        $report_id = sanitize_text_field($params['reportId']);
        $url = trailingslashit($this->mmn_base_url) . $report_id;
        
        $query_params = array();
        
        if (isset($params['lastDays'])) {
            $last_days = absint($params['lastDays']);
            if ($last_days > 0 && $last_days <= 365) {
                $query_params['lastDays'] = $last_days;
            }
        }
        
        if (!empty($params['startDate'])) {
            $query_params['startDate'] = sanitize_text_field($params['startDate']);
        }
        
        if (!empty($params['endDate'])) {
            $query_params['endDate'] = sanitize_text_field($params['endDate']);
        }
        
        if (!empty($query_params)) {
            $url = add_query_arg($query_params, $url);
        }
        
        return $this->make_mmn_request($url, $api_key, $cache_key);
    }
    
    private function fetch_reports_by_state($api_key, $params, $cache_key = null) {
        $query_params = array();
        
        if (!empty($params['state'])) {
            $query_params['state'] = sanitize_text_field($params['state']);
        }
        
        if (!empty($params['commodity'])) {
            $query_params['q'] = sanitize_text_field($params['commodity']);
        }
        
        $url = add_query_arg($query_params, $this->mmn_base_url);
        
        return $this->make_mmn_request($url, $api_key, $cache_key);
    }
    
    private function make_mmn_request($url, $api_key, $cache_key = null) {
        $response = wp_remote_get($url, array(
            'headers' => array(
                'x-api-key' => $api_key,
                'Accept' => 'application/json'
            ),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return new WP_Error('mmn_request_failed', $response->get_error_message(), array('status' => 500));
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 401) {
            return new WP_Error('invalid_api_key', __('Invalid MMN API key', 'mmn-market-tracker'), array('status' => 401));
        }
        
        if ($status_code === 429) {
            return new WP_Error('rate_limit', __('MMN rate limit reached', 'mmn-market-tracker'), array('status' => 429));
        }
        
        if ($status_code >= 500) {
            return new WP_Error('mmn_server_error', __('MMN server error', 'mmn-market-tracker'), array('status' => 500));
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('json_decode_error', __('Failed to decode MMN response', 'mmn-market-tracker'), array('status' => 500));
        }
        
        if ($cache_key) {
            set_transient($cache_key, $data, 300);
        }
        
        return rest_ensure_response($data);
    }
}
