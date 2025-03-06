from django.urls import re_path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from . import consumers

# websocket_urlpatterns = [
#     re_path(r'ws/meeting/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),
# ]
websocket_urlpatterns = [
    re_path(r'(?P<room_name>\w+)/', consumers.ChatConsumer.as_asgi()),
]
