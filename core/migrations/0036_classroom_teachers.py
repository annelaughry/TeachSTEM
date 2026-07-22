from django.conf import settings
from django.db import migrations, models


def copy_teacher_to_teachers(apps, schema_editor):
    Classroom = apps.get_model('core', 'Classroom')
    for classroom in Classroom.objects.all():
        classroom.teachers.add(classroom.teacher_id)


def copy_teachers_to_teacher(apps, schema_editor):
    Classroom = apps.get_model('core', 'Classroom')
    for classroom in Classroom.objects.all():
        first = classroom.teachers.first()
        if first is not None:
            classroom.teacher_id = first.id
            classroom.save()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_teachersurveyresponse'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='classroom',
            name='teachers',
            field=models.ManyToManyField(related_name='classrooms', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(copy_teacher_to_teachers, copy_teachers_to_teacher),
        migrations.RemoveField(
            model_name='classroom',
            name='teacher',
        ),
    ]
