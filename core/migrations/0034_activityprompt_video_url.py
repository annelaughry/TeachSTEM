from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0033_activity_restricted'),
    ]

    operations = [
        migrations.AddField(
            model_name='activityprompt',
            name='video_url',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
