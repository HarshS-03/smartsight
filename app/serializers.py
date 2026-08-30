from rest_framework import serializers
from app.models import User, Camera, Person, PersonImage, RecognitionLog, Notification

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'code', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'password']

    def validate_password(self, value):
        if self.instance and value:
            from django.contrib.auth.hashers import check_password
            if check_password(value, self.instance.password):
                raise serializers.ValidationError("New password cannot be the same as the old password.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = ['id', 'name', 'source', 'orientation', 'is_active', 'created_at']

class PersonImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = PersonImage
        fields = ['id', 'image', 'url', 'uploaded_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

class PersonSerializer(serializers.ModelSerializer):
    images = PersonImageSerializer(many=True, read_only=True)
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = Person
        fields = ['id', 'name', 'created_at', 'images']

class RecognitionLogSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = RecognitionLog
        fields = ['id', 'person_name', 'camera_name', 'confidence', 'detection_confidence', 'recognition_similarity', 'status', 'image_path', 'timestamp']

class NotificationSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    processed_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'image_url', 'status', 'action_source',
            'processed_at', 'is_read', 'created_at', 'telegram_message_id',
            'alert_person_name', 'alert_camera_name', 'alert_confidence'
        ]

