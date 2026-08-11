from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from app import views

router = DefaultRouter()
router.register(r'cameras', views.CameraViewSet, basename='camera')
router.register(r'persons', views.PersonViewSet, basename='person')
router.register(r'logs', views.RecognitionLogViewSet, basename='log')

urlpatterns = [
    # JWT & Auth API Endpoints
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.UserMeView.as_view(), name='user_me'),
    path('auth/forgot_password/', views.ForgotPasswordAPIView.as_view(), name='api_forgot_password'),
    path('auth/face/feed/', views.face_login_feed, name='api_face_login_feed'),
    path('auth/face/check/', views.face_login_check, name='api_face_login_check'),
    path('auth/face/verify/', views.face_verify_frame, name='api_face_verify_frame'),

    # Dataset & File Management API Endpoints
    path('dataset/upload/', views.DatasetUploadView.as_view(), name='dataset_upload'),
    path('dataset/classify/', views.ClassifyUnknownsAPIView.as_view(), name='api_classify_unknowns'),
    path('dataset/assign/', views.AssignClassifiedGroupAPIView.as_view(), name='api_assign_classified_group'),
    path('persons/images/<int:image_id>/', views.PersonImageDeleteView.as_view(), name='person_image_delete'),

    # Recognition Log & Export API Endpoints
    path('logs/unknown/<int:log_id>/dismiss/', views.DismissUnknownLogView.as_view(), name='dismiss_unknown_log'),
    path('reports/export/', views.ReportsExportView.as_view(), name='reports_export'),
    path('reports/stats/', views.ReportsStatsAPIView.as_view(), name='reports_stats'),

    # Notification & Push Notification API Endpoints
    path('notifications/', views.NotificationListAPIView.as_view(), name='notification_list'),
    path('notifications/<int:pk>/action/', views.NotificationActionAPIView.as_view(), name='notification_action'),
    path('notifications/register_push_token/', views.RegisterPushTokenAPIView.as_view(), name='register_push_token'),

    # Video Feed & Streaming Endpoints
    path('video_feed/', views.video_feed, name='video_feed'),
    path('video_stats/', views.video_stats, name='video_stats'),
    path('start_video_feed/', views.start_video_feed, name='start_video_feed'),
    path('stop_video_feed/', views.stop_video_feed, name='stop_video_feed'),
    path('process_client_frame/', views.process_client_frame, name='process_client_frame'),
    path('test_alert/', views.test_alert, name='test_alert'),

    # Router URLs for CRUD operations (cameras, persons, logs)
    path('', include(router.urls)),
]
