from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    code = models.CharField(max_length=100, unique=True, null=True, blank=True)
    
    def __str__(self):
        return self.username

# Surveillance Models
class Camera(models.Model):
    ORIENTATION_CHOICES = [
        ('normal', 'Normal'),
        ('rot90_cw', 'Rotate 90° CW'),
        ('rot90_ccw', 'Rotate 90° CCW'),
        ('flip180', 'Flip 180°'),
        ('mirror_h', 'Mirror Horizontally'),
    ]
    name = models.CharField(max_length=100)
    source = models.CharField(max_length=255, help_text="Webcam index (e.g. 0) or IP Camera RTSP/HTTP URL")
    orientation = models.CharField(max_length=20, choices=ORIENTATION_CHOICES, default='normal')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.source})"


class Person(models.Model):
    CATEGORY_CHOICES = [
        ('STUDENT', 'Student'),
        ('FACULTY', 'Faculty'),
        ('OFFICE_STAFF', 'Office Member'),
        ('PEON', 'Peon'),
        ('LAB_STAFF', 'Lab Staff'),
        ('OTHER', 'Other'),
    ]
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='STUDENT')
    class_name = models.CharField(max_length=100, blank=True, null=True, help_text="Class / Batch for student")
    department = models.CharField(max_length=100, blank=True, null=True, help_text="Department / Role for staff")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"

def person_directory_path(instance, filename):
    # file will be uploaded to MEDIA_ROOT/dataset/<person_name>/<filename>
    return f'dataset/{instance.person.name}/{filename}'

class PersonImage(models.Model):
    person = models.ForeignKey(Person, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to=person_directory_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.person.name}"


class PersonEmbedding(models.Model):
    """Stores a 512-d ArcFace embedding vector for a person's face image."""
    person = models.ForeignKey(Person, related_name='embeddings', on_delete=models.CASCADE)
    source_image = models.ForeignKey(PersonImage, null=True, blank=True, on_delete=models.SET_NULL)
    embedding = models.JSONField()  # 512-d float vector stored as JSON list
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Embedding for {self.person.name} (dim={len(self.embedding) if self.embedding else 0})"


class RecognitionLog(models.Model):
    STATUS_CHOICES = [
        ('KNOWN', 'Known'),
        ('UNKNOWN', 'Unknown'),
    ]
    person_name = models.CharField(max_length=100, null=True, blank=True)
    camera_name = models.CharField(max_length=100, default='Default Camera')
    confidence = models.FloatField()
    detection_confidence = models.FloatField(null=True, blank=True)
    recognition_similarity = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    image_path = models.CharField(max_length=255, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.person_name if self.person_name else 'Unknown'} - {self.status} at {self.timestamp}"


class Notification(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('CANCELLED', 'Cancelled'),
        ('EXPIRED', 'Expired'),
    ]
    SOURCE_CHOICES = [
        ('APP', 'Mobile App'),
        ('TELEGRAM', 'Telegram Bot'),
    ]
    title = models.CharField(max_length=255)
    message = models.TextField()
    image_url = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    action_source = models.CharField(max_length=20, choices=SOURCE_CHOICES, null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    telegram_message_id = models.CharField(max_length=100, null=True, blank=True)

    # Structured alert fields (Fix 8)
    alert_person_name = models.CharField(max_length=100, null=True, blank=True)
    alert_camera_name = models.CharField(max_length=100, null=True, blank=True)
    alert_confidence = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        source_str = f" via {self.action_source}" if self.action_source else ""
        return f"{self.title} [{self.status}{source_str}] - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class DevicePushToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=20, default='android')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.platform} Token: {self.token[:20]}..."

