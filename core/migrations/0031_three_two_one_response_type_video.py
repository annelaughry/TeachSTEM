from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_three_two_one'),
    ]

    operations = [
        migrations.AddField(
            model_name='threetwooneassignment',
            name='response_type',
            field=models.CharField(
                choices=[('written', 'Written'), ('video', 'Video')],
                default='written',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='threetwooneresponse',
            name='response_video',
            field=models.FileField(blank=True, null=True, upload_to='321/videos/'),
        ),
        migrations.AlterField(
            model_name='threetwooneresponse',
            name='learned_1',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='threetwooneresponse',
            name='learned_2',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='threetwooneresponse',
            name='learned_3',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='threetwooneresponse',
            name='question_1',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='threetwooneresponse',
            name='question_2',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='threetwooneresponse',
            name='most_interesting',
            field=models.TextField(blank=True),
        ),
    ]
