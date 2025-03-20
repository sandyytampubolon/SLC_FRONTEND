from django import forms
from .models import Meeting

class MeetingForm(forms.ModelForm):
    schedule_meeting = forms.BooleanField(required=False, label='Schedule for later')

    class Meta:
        model = Meeting
        fields = ['title', 'description', 'start_time']
        widgets = {
            'start_time': forms.DateTimeInput(attrs={'type': 'datetime-local'}),
        }
