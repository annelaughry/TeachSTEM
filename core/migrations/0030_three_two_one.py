from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0029_tstemsurveyresponse'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ThreeTwoOneAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=200)),
                ('is_open', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('activity', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='three_two_one', to='core.activity',
                )),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='three_two_one_assignments', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='threetwooneassignment',
            name='classrooms',
            field=models.ManyToManyField(blank=True, related_name='three_two_one', to='core.classroom'),
        ),
        migrations.CreateModel(
            name='ThreeTwoOneResponse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('learned_1', models.TextField()),
                ('learned_2', models.TextField()),
                ('learned_3', models.TextField()),
                ('question_1', models.TextField()),
                ('question_2', models.TextField()),
                ('most_interesting', models.TextField()),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('assignment', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='responses', to='core.threetwooneassignment',
                )),
                ('student', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='three_two_one_responses', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['submitted_at'],
                'unique_together': {('assignment', 'student')},
            },
        ),
    ]
