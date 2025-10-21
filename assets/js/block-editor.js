(function(wp) {
    const { registerBlockType } = wp.blocks;
    const { InspectorControls } = wp.blockEditor || wp.editor;
    const { PanelBody, TextControl, SelectControl } = wp.components;
    const { createElement: el } = wp.element;
    const { __ } = wp.i18n;
    
    registerBlockType('mmn/market-tracker', {
        title: __('MMN Market Tracker', 'mmn-market-tracker'),
        description: __('Display commodity prices from USDA MyMarketNews', 'mmn-market-tracker'),
        icon: 'chart-line',
        category: 'widgets',
        attributes: {
            commodities: {
                type: 'string',
                default: ''
            },
            zip: {
                type: 'string',
                default: ''
            },
            unit: {
                type: 'string',
                default: ''
            }
        },
        
        edit: function(props) {
            const { attributes, setAttributes } = props;
            const { commodities, zip, unit } = attributes;
            
            return el(
                'div',
                { className: 'mmn-block-editor' },
                el(
                    InspectorControls,
                    {},
                    el(
                        PanelBody,
                        { title: __('Widget Settings', 'mmn-market-tracker'), initialOpen: true },
                        el(TextControl, {
                            label: __('Commodities (comma-separated)', 'mmn-market-tracker'),
                            value: commodities,
                            onChange: function(value) {
                                setAttributes({ commodities: value });
                            },
                            help: __('e.g., corn,soybeans,wheat', 'mmn-market-tracker')
                        }),
                        el(TextControl, {
                            label: __('ZIP Code', 'mmn-market-tracker'),
                            value: zip,
                            onChange: function(value) {
                                setAttributes({ zip: value });
                            },
                            help: __('Default ZIP code for location-based pricing', 'mmn-market-tracker')
                        }),
                        el(SelectControl, {
                            label: __('Unit', 'mmn-market-tracker'),
                            value: unit,
                            onChange: function(value) {
                                setAttributes({ unit: value });
                            },
                            options: [
                                { label: __('Default (from settings)', 'mmn-market-tracker'), value: '' },
                                { label: __('Bushel', 'mmn-market-tracker'), value: 'bushel' },
                                { label: __('Ton', 'mmn-market-tracker'), value: 'ton' },
                                { label: __('CWT', 'mmn-market-tracker'), value: 'cwt' },
                                { label: __('Pound', 'mmn-market-tracker'), value: 'lb' }
                            ]
                        })
                    )
                ),
                el(
                    'div',
                    { 
                        className: 'mmn-block-preview',
                        style: {
                            padding: '2rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            borderRadius: '8px',
                            textAlign: 'center'
                        }
                    },
                    el('h3', { style: { margin: '0 0 1rem 0' } }, __('MMN Market Tracker', 'mmn-market-tracker')),
                    el('p', { style: { margin: 0, opacity: 0.9 } }, __('Widget will display here on the frontend', 'mmn-market-tracker')),
                    commodities && el('p', { style: { margin: '0.5rem 0 0 0', fontSize: '0.9rem' } }, 
                        __('Tracking: ', 'mmn-market-tracker') + commodities
                    )
                )
            );
        },
        
        save: function() {
            return null;
        }
    });
    
})(window.wp);
