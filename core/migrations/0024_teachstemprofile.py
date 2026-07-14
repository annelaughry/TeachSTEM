from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_alter_lessonfeedback_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TeachSTEMProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(blank=True, max_length=200)),
                ('school', models.CharField(blank=True, max_length=200)),
                ('subject_taught', models.CharField(blank=True, max_length=200)),
                ('num_students', models.PositiveIntegerField(blank=True, null=True)),
                ('years_teaching', models.PositiveIntegerField(blank=True, null=True)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('teacher', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='teach_stem_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
