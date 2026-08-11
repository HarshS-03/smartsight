from rest_framework import serializers
from app.models import User, Camera, Person, PersonImage, RecognitionLog, Notification

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'code', 'first_name', 'last_name']

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
        fields = ['id', 'person_name', 'camera_name', 'confidence', 'status', 'image_path', 'timestamp']

class NotificationSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    processed_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'image_url', 'status', 'action_source', 'processed_at', 'is_read', 'created_at', 'telegram_message_id']

