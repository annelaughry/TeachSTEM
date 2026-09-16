from io import BytesIO

from django.template.loader import render_to_string
from xhtml2pdf import pisa


def render_activity_pdf(template_name, context):
    """Render a Django template to PDF bytes via xhtml2pdf."""
    html = render_to_string(template_name, context)
    buffer = BytesIO()
    result = pisa.CreatePDF(html, dest=buffer)
    if result.err:
        raise RuntimeError(f'Failed to render PDF from {template_name} ({result.err} errors).')
    return buffer.getvalue()
