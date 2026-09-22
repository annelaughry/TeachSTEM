from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, HttpResponse
from django.views.static import serve as serve_static


def _react_app(request, **kwargs):
    """Serve the React SPA index for any path not handled by Django."""
    index = settings.BASE_DIR / 'frontend' / 'dist' / 'index.html'
    if index.exists():
        return FileResponse(open(index, 'rb'), content_type='text/html')
    return HttpResponse('Frontend not built.', status=503)


# Uploaded media (student videos/drawings, handout files, etc.) live on local disk
# whenever AWS_STORAGE_BUCKET_NAME isn't set (see settings.py) -- there's no S3/CDN
# to serve them in that case, so Django must, regardless of DEBUG. static()'s
# DEBUG-only behavior is meant for local disk storage that's *never* used in real
# production, which holds here: real deployments always configure S3.
if settings.AWS_STORAGE_BUCKET_NAME:
    media_patterns = []
elif settings.DEBUG:
    media_patterns = static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    media_patterns = [
        re_path(r'^%s(?P<path>.*)$' % settings.MEDIA_URL.lstrip('/'), serve_static, {'document_root': settings.MEDIA_ROOT}),
    ]

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('core.api.urls')),
] + media_patterns + [
    re_path(r'^.*$', _react_app),
]
