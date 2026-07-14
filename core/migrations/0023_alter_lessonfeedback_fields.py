from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_lessonfeedback'),
    ]

    operations = [
        migrations.RemoveField(model_name='lessonfeedback', name='activity'),
        migrations.RemoveField(model_name='lessonfeedback', name='grade_level'),
        migrations.RemoveField(model_name='lessonfeedback', name='classroom'),
        migrations.AddField(
            model_name='lessonfeedback',
            name='activity_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='lessonfeedback',
            name='grade_level_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='lessonfeedback',
            name='classroom_name',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
