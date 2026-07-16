from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_three_two_one_response_type_video'),
    ]

    operations = [
        migrations.AddField(
            model_name='activity',
            name='video_url',
            field=models.URLField(blank=True, default=''),
        ),
    ]
