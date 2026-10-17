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
    images = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Person
        fields = ['id', 'name', 'category', 'category_display', 'class_name', 'department', 'created_at', 'images']

    def get_images(self, obj):
        import os
        request = self.context.get('request')
        valid_images = []
        for img in obj.images.all():
            if img.image:
                try:
                    if os.path.exists(img.image.path):
                        url = request.build_absolute_uri(img.image.url) if request else img.image.url
                        valid_images.append({
                            'id': img.id,
                            'image': img.image.url,
                            'url': url,
                            'uploaded_at': img.uploaded_at
                        })
                except Exception:
                    continue
        return valid_images

    def validate(self, data):
        # Format name to Title Case and optionally append class/department to guarantee uniqueness
        name = data.get('name')
        if name:
            name = name.title().strip()
            # If the instance exists (update), use its values if not in data
            category = data.get('category', getattr(self.instance, 'category', 'STUDENT')).upper()
            class_name = data.get('class_name', getattr(self.instance, 'class_name', '')).strip()
            department = data.get('department', getattr(self.instance, 'department', '')).strip()

            if category == 'STUDENT' and class_name and class_name.upper() not in name.upper():
                name = f"{name} {class_name}"
            elif category != 'STUDENT' and department and department.upper() not in name.upper():
                name = f"{name} {department}"
            
            data['name'] = name
        return data

class RecognitionLogSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    class_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = RecognitionLog
        fields = [
            'id', 'person_name', 'display_name', 'class_name', 'department', 'role',
            'camera_name', 'confidence', 'detection_confidence', 'recognition_similarity',
            'status', 'image_path', 'timestamp'
        ]

    def _get_person(self, obj):
        if not obj.person_name:
            return None
        # Cache person lookup on serializer context
        if not hasattr(self, '_person_cache'):
            self._person_cache = {}
        cleaned = obj.person_name.strip()
        if cleaned in self._person_cache:
            return self._person_cache[cleaned]

        from app.models import Person
        # Try exact match, prefix match or contains
        p = Person.objects.filter(name__iexact=cleaned).first()
        if not p:
            first_word = cleaned.split()[0] if cleaned else ''
            p = Person.objects.filter(name__istartswith=first_word).first() if first_word else None
        self._person_cache[cleaned] = p
        return p

    def get_class_name(self, obj):
        p = self._get_person(obj)
        return p.class_name if p and p.class_name else ''

    def get_department(self, obj):
        p = self._get_person(obj)
        return p.department if p and p.department else ''

    def get_role(self, obj):
        p = self._get_person(obj)
        if not p:
            return ''
        return p.get_category_display() if hasattr(p, 'get_category_display') and p.get_category_display() else p.category

    def get_display_name(self, obj):
        if not obj.person_name:
            return 'Unregistered Person'
        p = self._get_person(obj)
        if p:
            # Clean up redundant class suffixes from raw name if already embedded
            raw = obj.person_name.strip()
            if p.class_name:
                import re
                raw = re.sub(re.escape(p.class_name), '', raw, flags=re.IGNORECASE).strip(' -').strip()
            return raw or obj.person_name
        return obj.person_name

class NotificationSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    processed_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'image_url', 'status', 'action_source',
            'processed_at', 'is_read', 'created_at', 'telegram_message_id',
            'alert_person_name', 'alert_camera_name', 'alert_confidence', 'security_note'
        ]

