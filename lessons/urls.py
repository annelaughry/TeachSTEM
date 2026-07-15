from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, HttpResponse


def _react_app(request, **kwargs):
    """Serve the React SPA index for any path not handled by Django."""
    index = settings.BASE_DIR / 'frontend' / 'dist' / 'index.html'
    if index.exists():
        return FileResponse(open(index, 'rb'), content_type='text/html')
    return HttpResponse(
        'Frontend not built.',
        status=503,
    )


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.api.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) + [
    # Catch-all: let React Router handle everything else.
    # Placed after static() so local media URLs resolve first in dev.
    re_path(r'^.*$', _react_app),
]
