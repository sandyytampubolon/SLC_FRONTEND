from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from rest_framework import generics
from django.contrib.auth import authenticate, login as auth_login
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import MeetingRecording
from django.views import View

User = get_user_model()  # Use the custom user model

from django.http import HttpResponse, HttpResponseBadRequest
from .models import Meeting
from .serializers import MeetingSerializer
import random
import string
from bson import ObjectId

# Create your views here.
def main(request):
    return render(request, 'chat/main.html')

# Login view
def login(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        
        try:
            user = User.objects.get(username=username)
            user = authenticate(request, username=user.username, password=password)
            if user is not None:
                auth_login(request, user)
                return redirect('dashboard')
            else:
                return render(request, 'chat/login.html', {'error': 'Invalid username or password'})
        except User.DoesNotExist:
            return render(request, 'chat/login.html', {'error': 'Invalid username or password'})
    return render(request, 'chat/login.html')


# Register view
def register(request):
    if request.method == 'POST':
        username = request.POST['username']
        email = request.POST['email']
        password = request.POST['password']

        # Validate username
        if User.objects.filter(username=username).exists():
            return render(request, 'chat/register.html', {'error': 'Username already exists'})
        # Validate email
        if User.objects.filter(email=email).exists():
            return render(request, 'chat/register.html', {'error': 'Email already in use'})
        # Create user
        user = User.objects.create_user(username=username, email=email, password=password)
        user.save()

        # Send confirmation email (optional)
        send_mail(
            'Welcome to SLC',
            'Thank you for registering.',
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return redirect('login')
    return render(request, 'chat/register.html')

# Dashboard view
def dashboard(request):
    return render(request, 'chat/dashboard.html')

# New meeting view
def new_meet(request):
    if request.method == 'POST':
        title = request.POST['title']
        description = request.POST['description']
        meeting_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        meeting = Meeting.objects.create(id=str(ObjectId()), title=title, description=description, code=meeting_code)
        return render(request, 'chat/new_meet.html', {'meeting_code': meeting_code, 'meeting_id': meeting.id})
    return render(request, 'chat/new_meet.html')

# Join meeting view
def join_meet(request):
    if request.method == 'POST':
        meeting_code = request.POST.get('meeting_code')
        if not meeting_code:
            return render(request, 'chat/join_meet.html', {'error': 'Meeting Code is required'})
        try:
            meeting = Meeting.objects.get(code=meeting_code)
            return redirect('meeting_page', room_name=meeting.id)
        except Meeting.DoesNotExist:
            return render(request, 'chat/join_meet.html', {'error': 'Meeting not found'})
    return render(request, 'chat/join_meet.html')

# Meeting page view
def meeting_page(request, room_name):
    if not room_name or not ObjectId.is_valid(room_name):
        return HttpResponseBadRequest("Invalid meeting ID")
    try:
        meeting = Meeting.objects.get(id=room_name)
        participants = User.objects.filter(meeting=meeting)  # Assuming a relationship exists
        return render(request, 'chat/meeting_page.html', {'meeting': meeting, 'participants': participants})
    except Meeting.DoesNotExist:
        return render(request, 'chat/meeting_page.html', {'error': 'Meeting not found'})

# Personal info view
def personal_info(request):
    if request.method == 'POST':
        user = request.user
        user.email = request.POST['email']
        user.save()
        return redirect('personal_info')
    return render(request, 'chat/personal_info.html', {'user': request.user})

class RecordedMeetingsView(View):
    def get(self, request):
        recordings = MeetingRecording.objects.all().order_by('-created_at')
        return render(request, 'chat/recorded_meetings.html', {'recordings': recordings})

class MeetingCreateView(generics.CreateAPIView):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer

class MeetingDetailView(generics.RetrieveAPIView):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer
    lookup_field = 'meeting_id'
