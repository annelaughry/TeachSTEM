"""Email notifications.

Every notify_* function is called from a view after something is saved. Emails go out after the
database transaction commits and, by default, on a background thread, so a slow or failing email
service never slows down or breaks the request that triggered it. Failures are logged, not raised.
"""
import logging
import threading
import time

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import EmailMessage, get_connection
from django.db import transaction
from django.db.models import Q

from .models import TeacherProfile

logger = logging.getLogger(__name__)

# Resend allows a few API requests per second; space individual sends out to stay under it.
SEND_INTERVAL_SECONDS = 0.6

SIGN_OFF = '\n\n-- \nYoung Scientist Academy'
TEACHER_FOOTER = (
    '\n\nYou are receiving this because you are a member of a Young Scientist Academy program. '
    'To stop these emails, uncheck "Email me about new tasks, events and feedback" on your profile page.'
)


def email_for(user):
    """The best address on file: the one the teacher manages on their program profile, else their account email."""
    for related in ('teach_stem_profile', 'staff_profile'):
        profile = getattr(user, related, None)
        if profile is not None and profile.email:
            return profile.email
    return user.email or ''


def wants_email(user):
    profile = getattr(user, 'teacher_profile', None)
    return profile is None or profile.email_notifications


def _url(path):
    return f'{settings.SITE_URL}{path}'


def _first_name(user):
    return user.first_name or user.username


def _send(messages):
    if not messages:
        return
    try:
        connection = get_connection()
        connection.open()
        try:
            for i, message in enumerate(messages):
                if i and settings.NOTIFICATIONS_ASYNC:
                    time.sleep(SEND_INTERVAL_SECONDS)
                try:
                    message.connection = connection
                    message.send()
                except Exception:
                    logger.exception('Failed to send notification email to %s', message.to)
        finally:
            connection.close()
    except Exception:
        logger.exception('Failed to send notification emails')


def _queue(messages):
    """Send once the current transaction commits, so emails never describe something that was rolled back."""
    if not messages:
        return

    def dispatch():
        if settings.NOTIFICATIONS_ASYNC:
            threading.Thread(target=_send, args=(messages,), daemon=True).start()
        else:
            _send(messages)

    transaction.on_commit(dispatch)


def _personal_messages(users, subject, body_for):
    """One email per user (so addresses aren't shared), skipping opted-out users and users with no address."""
    messages = []
    for user in users:
        address = email_for(user)
        if address and wants_email(user):
            messages.append(EmailMessage(subject, body_for(user) + SIGN_OFF + TEACHER_FOOTER, to=[address]))
    return messages


# ── Teach STEM announcements ──────────────────────────────────────────────────

def teach_stem_members():
    return (
        User.objects.filter(is_active=True, teacher_profile__teach_stem_approved=True)
        .select_related('teacher_profile', 'teach_stem_profile', 'staff_profile')
    )


def teach_stem_members_without_email():
    return [u for u in teach_stem_members() if not email_for(u)]


def notify_new_teach_stem_task(task):
    """Returns how many teachers will be emailed."""
    kind = 'poll' if task.poll_options.exists() else 'task'
    subject = f'New Teach STEM {kind}: {task.title}'

    def body(user):
        lines = [f'Hi {_first_name(user)},', '']
        if kind == 'poll':
            lines.append(f'A new poll has been posted for Teach STEM members:\n\n{task.title}')
            lines.extend(f'  - {o.text}' for o in task.poll_options.all())
        else:
            lines.append(f'A new task has been posted for Teach STEM members:\n\n{task.title}')
        if task.description:
            lines.extend(['', task.description])
        if task.due_date:
            lines.extend(['', f'Due: {task.due_date.strftime("%A, %B %-d, %Y")}'])
        action = 'Answer the poll' if kind == 'poll' else 'See your tasks'
        lines.extend(['', f'{action} on your Teach STEM dashboard: {_url("/teach-stem")}'])
        return '\n'.join(lines)

    messages = _personal_messages(teach_stem_members(), subject, body)
    _queue(messages)
    return len(messages)


def _event_when(event):
    fmt = '%A, %B %-d, %Y'
    when = event.date.strftime(fmt)
    if event.end_date:
        when += f' to {event.end_date.strftime(fmt)}'
    if event.start_time:
        when += ', ' + event.start_time.strftime('%-I:%M %p')
        if event.end_time:
            when += ' to ' + event.end_time.strftime('%-I:%M %p')
    return when


def notify_new_calendar_event(event):
    """Returns how many teachers will be emailed."""
    subject = f'New Teach STEM event: {event.title}'

    def body(user):
        lines = [f'Hi {_first_name(user)},', '', 'A new event has been added to the Teach STEM calendar:', '',
                 event.title, f'When: {_event_when(event)}']
        if event.location:
            lines.append(f'Where: {event.location}')
        if event.link:
            lines.append(f'Link: {event.link}')
        if event.description:
            lines.extend(['', event.description])
        lines.extend(['', f'See the full calendar on your Teach STEM dashboard: {_url("/teach-stem")}'])
        return '\n'.join(lines)

    messages = _personal_messages(teach_stem_members(), subject, body)
    _queue(messages)
    return len(messages)


# ── Feedback on a teacher's submission ────────────────────────────────────────

FEEDBACK_KINDS = {
    # kind: (what it's called in the email, where the teacher reads the feedback)
    'project_topic': ('project topic plan', '/teach-stem/project-topics'),
    'project_starter': ('project starter', '/teach-stem/project-starter'),
    'topic_suggestion': ('topic suggestion', '/teacher'),
    'staff_project_topic': ('project topic plan', '/program-staff/project-topics'),
    'staff_project_starter': ('project starter', '/program-staff/project-starter'),
}


def notify_feedback(kind, teacher, item_name):
    label, path = FEEDBACK_KINDS[kind]
    named = f' "{item_name}"' if item_name else ''
    subject = f'New feedback on your {label}'

    def body(user):
        return '\n'.join([
            f'Hi {_first_name(user)},', '',
            f'An admin has reviewed your {label}{named} and left feedback for you.', '',
            f'Read it here: {_url(path)}',
        ])

    _queue(_personal_messages([teacher], subject, body))


# ── Alerts for admins ─────────────────────────────────────────────────────────

def admin_addresses():
    if settings.ADMIN_NOTIFICATION_EMAILS:
        return list(settings.ADMIN_NOTIFICATION_EMAILS)
    admins = User.objects.filter(Q(is_staff=True) | Q(is_superuser=True), is_active=True).exclude(email='')
    return sorted({u.email for u in admins})


def _notify_admins(subject, lines):
    body = '\n'.join(lines + ['', f'Review it on the admin dashboard: {_url("/admin")}']) + SIGN_OFF
    _queue([EmailMessage(subject, body, to=[address]) for address in admin_addresses()])


def _display_name(user):
    full = user.get_full_name()
    return f'{full} ({user.username})' if full else user.username


def notify_admins_new_signup(user):
    profile = getattr(user, 'teacher_profile', None)
    programs = []
    if profile and profile.is_teach_stem:
        programs.append('Teach STEM')
    if profile and profile.is_program_staff:
        programs.append('Program Staff')
    lines = [f'{_display_name(user)} created a teacher account and is waiting for approval.']
    if user.email:
        lines.append(f'Email: {user.email}')
    if programs:
        lines.append(f'Also requested: {", ".join(programs)}')
    _notify_admins(f'New teacher sign-up: {_display_name(user)}', lines)


def notify_admins_submission(teacher, what, item_name=''):
    named = f': {item_name}' if item_name else ''
    _notify_admins(
        f'New {what} to review from {_display_name(teacher)}',
        [f'{_display_name(teacher)} submitted a {what} for review{named}.'],
    )
