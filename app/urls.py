from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.core.cache import cache
from rest_framework.exceptions import Throttled
import time
import math

class CustomTokenObtainPairView(TokenObtainPairView):
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    def post(self, request, *args, **kwargs):
        ip = self.get_client_ip(request)
        cache_key = f"login_penalty_{ip}"
        
        state = cache.get(cache_key, {"failures": 0, "penalty_level": 0, "blocked_until": 0})
        now = time.time()
        
        if state["blocked_until"] > now:
            wait = math.ceil(state["blocked_until"] - now)
            
            if wait >= 86400:
                time_str = f"{math.ceil(wait / 86400)} days"
            elif wait >= 3600:
                time_str = f"{math.ceil(wait / 3600)} hours"
            elif wait >= 60:
                time_str = f"{math.ceil(wait / 60)} minutes"
            else:
                time_str = f"{wait} seconds"
                
            raise Throttled(detail=f"Request was throttled. Expected available in {time_str}.")
            
        try:
            response = super().post(request, *args, **kwargs)
            # On successful login, clear the penalty state
            cache.delete(cache_key)
            return response
        except Exception as e:
            if hasattr(e, 'status_code') and e.status_code in [400, 401]:
                state["failures"] += 1
                if state["failures"] >= 3:
                    state["penalty_level"] += 1
                    state["failures"] = 0
                    
                    level = state["penalty_level"]
                    if level == 1:
                        wait = 60         # 1 min
                    elif level == 2:
                        wait = 300        # 5 mins
                    elif level == 3:
                        wait = 1200       # 20 mins
                    elif level == 4:
                        wait = 3600       # 1 hour
                    else:
                        wait = 86400      # 1 day (next day)
                        
                    state["blocked_until"] = now + wait

                    if level >= 3:
                        from app.services.notification_service import dispatch_notification
                        if wait >= 86400:
                            t_str = f"{math.ceil(wait / 86400)} days"
                        elif wait >= 3600:
                            t_str = f"{math.ceil(wait / 3600)} hours"
                        else:
                            t_str = f"{math.ceil(wait / 60)} minutes"
                            
                        try:
                            dispatch_notification(
                                title="Security Alert: Brute Force",
                                message=f"Multiple failed login attempts detected. IP Address: {ip}. System has blocked this IP for {t_str}."
                            )
                        except Exception as notif_err:
                            print("[Auth Throttle] Failed to send notification:", notif_err)
                
                cache.set(cache_key, state, timeout=86400 * 2)
            raise e

from app import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'cameras', views.CameraViewSet, basename='camera')
router.register(r'persons', views.PersonViewSet, basename='person')
router.register(r'logs', views.RecognitionLogViewSet, basename='log')

urlpatterns = [
    # Health Check API Endpoint
    path('health/', views.health_check, name='api_health_check'),

    # JWT & Auth API Endpoints
    path('auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
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
    path('set_model/', views.set_model, name='set_model'),
    path('stop_video_feed/', views.stop_video_feed, name='stop_video_feed'),
    path('process_client_frame/', views.process_client_frame, name='process_client_frame'),
    path('webrtc/offer/', views.webrtc_offer, name='webrtc_offer'),
    path('test_alert/', views.test_alert, name='test_alert'),

    # Gallery Management API Endpoints (ArcFace Embedding Engine)
    path('gallery/status/', views.GalleryStatusAPIView.as_view(), name='gallery_status'),
    path('gallery/rebuild/', views.GalleryRebuildAPIView.as_view(), name='gallery_rebuild'),
    path('gallery/compute/<int:person_id>/', views.ComputePersonEmbeddingsAPIView.as_view(), name='compute_person_embeddings'),


    # Router URLs for CRUD operations (cameras, persons, logs)
    path('', include(router.urls)),
]
