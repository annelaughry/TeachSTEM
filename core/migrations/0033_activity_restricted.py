from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_activity_video_url'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='activity',
            name='is_restricted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='activity',
            name='restricted_teachers',
            field=models.ManyToManyField(
                blank=True,
                related_name='restricted_activities',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
