from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_projecttopicsubmission'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='projecttopicsubmission',
            name='research_questions',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='projecttopicsubmission',
            name='status',
            field=models.CharField(
                choices=[('draft', 'Draft'), ('submitted', 'Submitted for Review'), ('reviewed', 'Reviewed')],
                default='draft',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='projecttopicsubmission',
            name='admin_feedback',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='projecttopicsubmission',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_project_topics',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='projecttopicsubmission',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
