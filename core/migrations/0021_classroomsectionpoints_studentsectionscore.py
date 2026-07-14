from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_teacherprofile_is_teach_stem_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ClassroomSectionPoints',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('max_points', models.PositiveIntegerField(default=0)),
                ('classroom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='section_points', to='core.classroom')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='classroom_points', to='core.activitysection')),
            ],
            options={
                'unique_together': {('classroom', 'section')},
            },
        ),
        migrations.CreateModel(
            name='StudentSectionScore',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('points_earned', models.PositiveIntegerField(blank=True, null=True)),
                ('graded_at', models.DateTimeField(auto_now=True)),
                ('classroom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='section_scores', to='core.classroom')),
                ('graded_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='graded_scores', to=settings.AUTH_USER_MODEL)),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='student_scores', to='core.activitysection')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='section_scores', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('student', 'classroom', 'section')},
            },
        ),
    ]
