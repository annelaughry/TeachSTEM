from django.http import HttpResponse


class HealthCheckMiddleware:
    """
    Answers the ALB target group health check before Django's Host-header
    validation (ALLOWED_HOSTS) runs. The load balancer sends health check
    requests with the task's private IP as the Host header, which will
    never be in ALLOWED_HOSTS, so this must sit first in MIDDLEWARE and
    return a response without touching request.get_host().
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.META.get('PATH_INFO') == '/health/':
            return HttpResponse('OK')
        return self.get_response(request)
