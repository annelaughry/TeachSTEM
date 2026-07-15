from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, HttpResponse
from django.views.static import serve


def _react_app(request, **kwargs):
    """Serve the React SPA index for any path not handled by Django."""
    index = settings.STATIC_ROOT / 'index.html'
    if index.exists():
        return FileResponse(open(index, 'rb'), content_type='text/html')
    return HttpResponse('Frontend not built.', status=503)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.api.urls')),

    # React static assets — served from staticfiles/ at their original paths
    # so that index.html's <script src="/assets/..."> references resolve.
    re_path(r'^assets/(?P<path>.+)$', serve,
            {'document_root': settings.STATIC_ROOT / 'assets'}),
    re_path(r'^fonts/(?P<path>.+)$', serve,
            {'document_root': settings.STATIC_ROOT / 'fonts'}),
    re_path(r'^logo\.png$', serve,
            {'document_root': settings.STATIC_ROOT, 'path': 'logo.png'}),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + [
    # Catch-all: let React Router handle everything else.
    re_path(r'^.*$', _react_app),
]
