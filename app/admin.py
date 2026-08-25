from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Person, PersonImage, PersonEmbedding, RecognitionLog

# Register User model using BaseUserAdmin to handle password hashing
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'code', 'is_staff')
    search_fields = ('username', 'email', 'code')
    
    # Add 'code' field to the admin forms
    fieldsets = BaseUserAdmin.fieldsets + (
        (None, {'fields': ('code',)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (None, {'fields': ('code',)}),
    )

class PersonImageInline(admin.TabularInline):
    model = PersonImage
    extra = 1

class PersonEmbeddingInline(admin.TabularInline):
    model = PersonEmbedding
    extra = 0
    readonly_fields = ('source_image', 'created_at')
    fields = ('source_image', 'created_at')

# Register surveillance models
@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at', 'image_count', 'embedding_count')
    search_fields = ('name',)
    inlines = [PersonImageInline, PersonEmbeddingInline]

    def image_count(self, obj):
        return obj.images.count()
    image_count.short_description = 'Images'

    def embedding_count(self, obj):
        return obj.embeddings.count()
    embedding_count.short_description = 'Embeddings'

@admin.register(RecognitionLog)
class RecognitionLogAdmin(admin.ModelAdmin):
    list_display = ('person_name', 'status', 'confidence', 'detection_confidence', 'recognition_similarity', 'timestamp')
    list_filter = ('status', 'timestamp')
    search_fields = ('person_name',)

@admin.register(PersonEmbedding)
class PersonEmbeddingAdmin(admin.ModelAdmin):
    list_display = ('person', 'source_image', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('person__name',)
    readonly_fields = ('embedding',)

