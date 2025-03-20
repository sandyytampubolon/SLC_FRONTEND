from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views
from .views import main, login_view,logout_view,google_login_callback, register, dashboard, new_meet, join_meet, meeting_page, personal_info,edit_personal_info, MeetingCreateView, MeetingDetailView

urlpatterns = [
    path('', views.main, name='main'),
    path('dashboard/', dashboard, name='dashboard'),
    path('login/', login_view, name='login'),
    path('register/', register, name='register'),
    path("logout", logout_view, name="logout"),
    path("google-login-callback/", google_login_callback, name="google-login-callback"),  
    path('register/', views.register, name='register'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('new_meet/', views.new_meet, name='new_meet'),
    path('join_meet/', views.join_meet, name='join_meet'),
    path('meeting/<str:room_name>/', views.meeting_page, name='meeting_page'),
    path('personal_info/', personal_info, name='personal_info'),
    path('edit_personal_info/', edit_personal_info, name='edit_personal_info'),
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
