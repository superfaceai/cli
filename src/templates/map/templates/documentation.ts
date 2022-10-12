export default `{{#if description }}
"""
{{ title }}
{{ description }}
"""
{{/if}}
{{#unless description }}
{{#if title }}
"""
{{ title }}
"""
{{/if }}
{{/unless }}`;
