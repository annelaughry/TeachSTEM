from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import TeacherProfile, TeachSTEMTask, TeachSTEMTaskCompletion


class TeachSTEMPollTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin', password='x', is_staff=True)
        self.teacher = User.objects.create_user('teacher', password='x')
        TeacherProfile.objects.create(user=self.teacher, is_approved=True, is_teach_stem=True, teach_stem_approved=True)
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def make_poll(self, options=('Yes', 'No')):
        r = self.as_user(self.admin).post('/api/teach-stem/tasks/', {
            'title': 'Can you attend the June workshop?', 'description': '', 'due_date': '',
            'poll_options': list(options),
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_admin_creates_poll(self):
        poll = self.make_poll()
        self.assertTrue(poll['is_poll'])
        self.assertEqual([o['text'] for o in poll['poll_options']], ['Yes', 'No'])

    def test_plain_task_still_works(self):
        r = self.as_user(self.admin).post('/api/teach-stem/tasks/', {'title': 'Read handbook'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.data['is_poll'])

    def test_poll_needs_two_distinct_options(self):
        c = self.as_user(self.admin)
        self.assertEqual(c.post('/api/teach-stem/tasks/', {'title': 'Q', 'poll_options': ['Only']}, format='json').status_code, 400)
        self.assertEqual(c.post('/api/teach-stem/tasks/', {'title': 'Q', 'poll_options': ['A', 'a']}, format='json').status_code, 400)

    def test_teacher_cannot_create_poll(self):
        r = self.as_user(self.teacher).post('/api/teach-stem/tasks/', {'title': 'Q', 'poll_options': ['A', 'B']}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_vote_completes_task_and_can_be_changed(self):
        poll = self.make_poll()
        yes, no = [o['id'] for o in poll['poll_options']]
        c = self.as_user(self.teacher)
        self.assertEqual(c.post(f"/api/teach-stem/tasks/{poll['id']}/vote/", {'option': yes}, format='json').status_code, 200)
        self.assertEqual(c.post(f"/api/teach-stem/tasks/{poll['id']}/vote/", {'option': no}, format='json').status_code, 200)

        mine = c.get('/api/teach-stem/tasks/').data[0]
        self.assertTrue(mine['completed'])
        self.assertEqual(mine['my_vote'], no)
        self.assertNotIn('votes', mine['poll_options'][0])  # teachers don't see tallies
        self.assertEqual(TeachSTEMTaskCompletion.objects.count(), 1)

        admin_view = self.as_user(self.admin).get('/api/teach-stem/tasks/').data[0]
        self.assertEqual(admin_view['total_votes'], 1)
        self.assertEqual([o['votes'] for o in admin_view['poll_options']], [0, 1])

    def test_vote_rejects_option_from_another_poll(self):
        a = self.make_poll()
        b = self.make_poll(('Red', 'Blue'))
        r = self.as_user(self.teacher).post(f"/api/teach-stem/tasks/{a['id']}/vote/", {'option': b['poll_options'][0]['id']}, format='json')
        self.assertEqual(r.status_code, 404)

    def test_mark_complete_blocked_for_polls(self):
        poll = self.make_poll()
        r = self.as_user(self.teacher).post(f"/api/teach-stem/tasks/{poll['id']}/complete/")
        self.assertEqual(r.status_code, 400)

    def test_options_locked_after_votes(self):
        poll = self.make_poll()
        self.as_user(self.teacher).post(f"/api/teach-stem/tasks/{poll['id']}/vote/", {'option': poll['poll_options'][0]['id']}, format='json')
        c = self.as_user(self.admin)
        r = c.put(f"/api/teach-stem/tasks/{poll['id']}/", {'poll_options': ['Yes', 'Maybe']}, format='json')
        self.assertEqual(r.status_code, 400)
        # Editing the title with unchanged options is fine and keeps the votes.
        r = c.put(f"/api/teach-stem/tasks/{poll['id']}/", {'title': 'New title', 'poll_options': ['Yes', 'No']}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['total_votes'], 1)


class TeachSTEMCalendarTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin', password='x', is_staff=True)
        self.teacher = User.objects.create_user('teacher', password='x')
        TeacherProfile.objects.create(user=self.teacher, is_approved=True, is_teach_stem=True, teach_stem_approved=True)
        self.outsider = User.objects.create_user('outsider', password='x')
        TeacherProfile.objects.create(user=self.outsider, is_approved=True)
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def test_admin_adds_edits_and_deletes_event(self):
        c = self.as_user(self.admin)
        r = c.post('/api/teach-stem/calendar/events/', {
            'title': 'Spring workshop', 'date': '2027-03-16', 'end_date': '',
            'start_time': '09:00', 'end_time': '15:00', 'location': 'Room 4', 'link': '',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        r = c.put(f"/api/teach-stem/calendar/events/{r.data['id']}/", {'title': 'Spring workshop (moved)', 'date': '2027-03-23'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['start_time'], '09:00:00')
        self.assertEqual(c.delete(f"/api/teach-stem/calendar/events/{r.data['id']}/").status_code, 200)

    def test_event_validation(self):
        c = self.as_user(self.admin)
        bad_range = c.post('/api/teach-stem/calendar/events/', {'title': 'X', 'date': '2027-03-16', 'end_date': '2027-03-10'}, format='json')
        self.assertEqual(bad_range.status_code, 400)
        bad_time = c.post('/api/teach-stem/calendar/events/', {'title': 'X', 'date': '2027-03-16', 'start_time': '15:00', 'end_time': '09:00'}, format='json')
        self.assertEqual(bad_time.status_code, 400)

    def test_teacher_can_view_but_not_edit(self):
        self.as_user(self.admin).post('/api/teach-stem/calendar/events/', {'title': 'Kickoff', 'date': '2027-01-10'}, format='json')
        c = self.as_user(self.teacher)
        r = c.get('/api/teach-stem/calendar/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['events'][0]['title'], 'Kickoff')
        self.assertEqual(c.post('/api/teach-stem/calendar/events/', {'title': 'X', 'date': '2027-01-10'}, format='json').status_code, 403)
        self.assertEqual(c.put('/api/teach-stem/calendar/google/', {'url': ''}, format='json').status_code, 403)

    def test_non_teach_stem_teacher_cannot_view(self):
        self.assertEqual(self.as_user(self.outsider).get('/api/teach-stem/calendar/').status_code, 403)

    def test_google_link_formats(self):
        import base64
        cal_id = 'abc123@group.calendar.google.com'
        expected = 'https://calendar.google.com/calendar/embed?src=abc123%40group.calendar.google.com'
        cid = base64.urlsafe_b64encode(cal_id.encode()).decode().rstrip('=')
        accepted = [
            cal_id,
            f'https://calendar.google.com/calendar/u/0?cid={cid}',
            'https://calendar.google.com/calendar/ical/abc123%40group.calendar.google.com/public/basic.ics',
            f'<iframe src="{expected}" style="border: 0" width="800" height="600"></iframe>',
            expected,
        ]
        c = self.as_user(self.admin)
        for raw in accepted:
            r = c.put('/api/teach-stem/calendar/google/', {'url': raw}, format='json')
            self.assertEqual(r.status_code, 200, raw)
            self.assertEqual(r.data['google_calendar_embed_url'], expected, raw)

        for raw in ['https://evil.example.com/calendar/embed?src=x', 'javascript:alert(1)', 'not a link']:
            self.assertEqual(c.put('/api/teach-stem/calendar/google/', {'url': raw}, format='json').status_code, 400, raw)

        r = c.put('/api/teach-stem/calendar/google/', {'url': ''}, format='json')
        self.assertEqual(r.data['google_calendar_embed_url'], '')


from django.core import mail
from django.test import override_settings

from .models import ProjectStarter, TeachSTEMProfile


@override_settings(NOTIFICATIONS_ASYNC=False, ADMIN_NOTIFICATION_EMAILS=[], SITE_URL='https://example.test')
class NotificationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin', password='x', is_staff=True, email='admin@example.com')
        self.teacher = User.objects.create_user('teacher', password='x', first_name='Jo', email='jo@example.com')
        TeacherProfile.objects.create(user=self.teacher, is_approved=True, is_teach_stem=True, teach_stem_approved=True)
        self.no_email = User.objects.create_user('noemail', password='x')
        TeacherProfile.objects.create(user=self.no_email, is_approved=True, is_teach_stem=True, teach_stem_approved=True)
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def test_new_task_emails_members_with_an_address(self):
        with self.captureOnCommitCallbacks(execute=True):
            r = self.as_user(self.admin).post('/api/teach-stem/tasks/', {'title': 'Read handbook'}, format='json')
        self.assertEqual(r.data['notified'], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['jo@example.com'])
        self.assertIn('New Teach STEM task: Read handbook', mail.outbox[0].subject)
        self.assertIn('https://example.test/teach-stem', mail.outbox[0].body)

    def test_new_poll_lists_options(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.admin).post('/api/teach-stem/tasks/', {'title': 'Pick a week', 'poll_options': ['March 9', 'March 16']}, format='json')
        self.assertIn('New Teach STEM poll', mail.outbox[0].subject)
        self.assertIn('March 16', mail.outbox[0].body)

    def test_new_event_emails_members(self):
        with self.captureOnCommitCallbacks(execute=True):
            r = self.as_user(self.admin).post('/api/teach-stem/calendar/events/', {'title': 'Workshop', 'date': '2027-03-16', 'start_time': '09:00'}, format='json')
        self.assertEqual(r.data['notified'], 1)
        self.assertIn('Tuesday, March 16, 2027, 9:00 AM', mail.outbox[0].body)

    def test_opted_out_teacher_is_skipped(self):
        c = self.as_user(self.teacher)
        c.post('/api/teach-stem/profile/', {'email_notifications': False}, format='json')
        self.assertFalse(c.get('/api/teach-stem/profile/').data['email_notifications'])
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.admin).post('/api/teach-stem/tasks/', {'title': 'T'}, format='json')
        self.assertEqual(len(mail.outbox), 0)

    def test_profile_email_preferred_over_account_email(self):
        TeachSTEMProfile.objects.create(teacher=self.teacher, email='jo.school@example.com')
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.admin).post('/api/teach-stem/tasks/', {'title': 'T'}, format='json')
        self.assertEqual(mail.outbox[0].to, ['jo.school@example.com'])

    def test_feedback_emails_teacher_once(self):
        starter = ProjectStarter.objects.create(teacher=self.teacher, title='Bridges', status='submitted')
        c = self.as_user(self.admin)
        url = f'/api/admin/project-starters/{starter.id}/feedback/'
        with self.captureOnCommitCallbacks(execute=True):
            c.post(url, {'feedback': 'Great start'}, format='json')
            c.post(url, {'feedback': 'Great start'}, format='json')  # unchanged re-save: no second email
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('"Bridges"', mail.outbox[0].body)
        self.assertIn('https://example.test/teach-stem/project-starter', mail.outbox[0].body)

    def test_submission_alerts_admins(self):
        starter = ProjectStarter.objects.create(teacher=self.teacher, title='Bridges')
        with self.captureOnCommitCallbacks(execute=True):
            self.as_user(self.teacher).post(f'/api/teach-stem/project-starters/{starter.id}/submit/')
        self.assertEqual(mail.outbox[0].to, ['admin@example.com'])
        self.assertIn('project starter', mail.outbox[0].subject)

    @override_settings(ADMIN_NOTIFICATION_EMAILS=['team@example.com'])
    def test_signup_requires_email_and_alerts_admin_inbox(self):
        c = APIClient()
        data = {'first_name': 'Sam', 'last_name': 'Lee', 'username': 'sam', 'password': 'pw12345!', 'is_teach_stem': True}
        self.assertEqual(c.post('/api/auth/register/teacher/', data, format='json').status_code, 400)
        self.assertEqual(c.post('/api/auth/register/teacher/', {**data, 'email': 'nope'}, format='json').status_code, 400)
        with self.captureOnCommitCallbacks(execute=True):
            r = c.post('/api/auth/register/teacher/', {**data, 'email': 'sam@example.com'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(username='sam').email, 'sam@example.com')
        self.assertEqual(mail.outbox[0].to, ['team@example.com'])
        self.assertIn('Teach STEM', mail.outbox[0].body)

    def test_dashboard_lists_members_without_email(self):
        r = self.as_user(self.admin).get('/api/admin/dashboard/')
        self.assertEqual(r.data['teach_stem_missing_email'], ['noemail'])

