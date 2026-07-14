from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key)

@register.filter
def splitlines(value):
    if not value:
        return []
    return [line.strip() for line in value.splitlines() if line.strip()]
