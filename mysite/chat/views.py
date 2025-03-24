from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.models import User
from rest_framework import generics
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate, login as auth_login, logout
from django.contrib.auth.backends import ModelBackend
from .models import MeetingRecording, UserProfile, Meeting
from django.views import View
from django.http import HttpResponseBadRequest, JsonResponse, HttpResponseRedirect
from .serializers import MeetingSerializer
import random, string,json,traceback
from bson import ObjectId
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.contrib.sessions.models import Session
from django.contrib.auth.hashers import check_password
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse
from chat.models import UserProfile, Meeting
from .forms import MeetingForm
import re 
User = get_user_model()  # Use the custom user model



# Create your views here.
def main(request):
    return render(request, 'chat/main.html')

# Login view
def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        user = User.objects.filter(username=username).first()

        if user and check_password(password, user.password):
            auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')

            request.session['user_id'] = str(user._id)  # Simpan _id ke sesi
            request.session["login_method"] = "username_password"  # Tambahkan metode login ke sesi
            request.session.modified = True

            print(f"User ditemukan: {user.username}")
            print(f"Session ID setelah login: {request.session.session_key}")
            return redirect('dashboard')

        print("User tidak ditemukan atau password salah.")
        return render(request, 'chat/login.html', {'error': 'Invalid credentials'})

    return render(request, 'chat/login.html')

import traceback  # Tambahkan untuk menangkap error lebih jelas

@csrf_exempt  # Pastikan CSRF di-bypass untuk uji coba
def google_login_callback(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)  # Ambil data JSON dari request
            print("Google Callback Data:", data)  # Debugging

            google_email = data.get("email")
            google_name = data.get("name")

            if not google_email:
                return JsonResponse({"error": "Invalid Google response: missing email"}, status=400)

            # Cek apakah user sudah ada di database
            user, created = User.objects.get_or_create(username=google_email, defaults={"first_name": google_name})
            
            # **Simpan sesi login di Django**
            auth_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            request.session["user_id"] = str(user._id)
            request.session["login_method"] = "google"
            request.session.modified = True

            print(f"User {user.username} berhasil login dengan Google.")

            return JsonResponse({"message": "Login successful", "user": user.username})
        
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON format"}, status=400)
        except Exception as e:
            print("Google Login Error:", str(e))  # Debugging ke terminal
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request"}, status=400)


# Register view
def register(request):
    if request.method == 'POST':
        username = request.POST['username']
        email = request.POST['email']
        password = request.POST['password']

        if User.objects.filter(username=username).exists():
            return render(request, 'chat/register.html', {'error': 'Username sudah digunakan'})

        if User.objects.filter(email=email).exists():
            return render(request, 'chat/register.html', {'error': 'Email sudah digunakan'})

        user = User(username=username, email=email)
        user.set_password(password)  # Gunakan hashing saat menyimpan password
        user.save()

        return redirect('login')
    return render(request, 'chat/register.html')

# Dashboard view
def dashboard(request):
    print(f"Dashboard: User - {request.user}")
    print(f"Dashboard: Authenticated - {request.user.is_authenticated}")

    if not request.user.is_authenticated:
        print("User tidak terautentikasi, redirect ke login...")
        return redirect('login')

    return render(request, 'chat/dashboard.html')

# New meeting view
@login_required
def new_meet(request):
    meeting_code = None
    if request.method == 'POST':
        form = MeetingForm(request.POST)
        if form.is_valid():
            meeting = form.save(commit=False)
            meeting.created_by = request.user
            meeting_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            meeting.code = meeting_code
            meeting.save()
            
            if form.cleaned_data['schedule_meeting']:
                return redirect('join_meet')
            else:
                return render(request, 'chat/new_meet.html', {'form': form, 'meeting_code': meeting_code, 'meeting_id': meeting.id})
    else:
        form = MeetingForm()
    return render(request, 'chat/new_meet.html', {'form': form, 'meeting_code': meeting_code, 'meeting_id': None})

# Join meeting view
@login_required
def join_meet(request):
    if request.method == 'POST':
        meeting_code = request.POST.get('meeting_code')
        if not meeting_code:
            return render(request, 'chat/join_meet.html', {'error_message': 'Meeting Code is required'})
        try:
            meeting = Meeting.objects.get(code=meeting_code)
            return redirect('meeting_page', room_name=meeting.id)
        except Meeting.DoesNotExist:
            return render(request, 'chat/join_meet.html', {'error_message': 'Meeting not found'})
    # Menggunakan participants karena created_by tidak ada
    meetings = Meeting.objects.filter(participants=request.user)
    return render(request, 'chat/join_meet.html', {'meetings': meetings})

# Delete meeting view
@login_required
def delete_meeting(request, meeting_id):
    meeting = get_object_or_404(Meeting, id=meeting_id, created_by=request.user)
    if request.method == 'POST':
        meeting.delete()
        return redirect('join_meet')
    return render(request, 'chat/delete_meeting.html', {'meeting': meeting})

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
@login_required
def personal_info(request):
    # Ambil atau buat UserProfile jika belum ada
    user_profile, created = UserProfile.objects.get_or_create(user=request.user)

    return render(request, 'chat/personal_info.html', {'user_profile': user_profile})

# Edit personal info view
@login_required
def edit_personal_info(request):
    user_profile = UserProfile.objects.filter(user=request.user).first()

    if request.method == "POST":
        user_profile.nama_lengkap = request.POST.get("nama_lengkap")
        user_profile.email = request.POST.get("email")
        user_profile.nomor_ponsel = request.POST.get("nomor_ponsel")

        # Cek apakah ada file foto yang diunggah
        if 'foto' in request.FILES:
            user_profile.foto = request.FILES['foto']  # ✅ Simpan file yang diunggah

        user_profile.save()
        return redirect('personal_info')

    return render(request, 'chat/edit_personal_info.html', {'user_profile': user_profile})

def logout_view(request):
    if request.method == "POST":
        logout(request)  # Logout dari Django
        return JsonResponse({"status": "success", "message": "Logged out successfully"})
    
    return JsonResponse({"status": "error", "message": "Invalid request"}, status=400)

class MeetingCreateView(generics.CreateAPIView):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer

class MeetingDetailView(generics.RetrieveAPIView):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer
    lookup_field = 'meeting_id'
