import os
import requests
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import time
import json

# Configuration from environment variables
ACCESS_CODE = os.getenv('ACCESS_CODE')
EMAIL_USER = os.getenv('EMAIL_USER')
EMAIL_PASS = os.getenv('EMAIL_PASS')
RECIPIENT = os.getenv('RECIPIENT_EMAIL')
LOCATION = os.getenv('LOCATION', 'MUMBAI')  # Default to Mumbai, change as needed

SLOTS_URL = "https://app.checkvisaslots.com/slots/v3"

def get_headers():
    return {
        'authority': 'app.checkvisaslots.com',
        'origin': 'chrome-extension://beepaenfejnphdgnkmccjcfiieihhogl',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        'x-api-key': ACCESS_CODE,
    }

def check_slots():
    response = requests.get(SLOTS_URL, headers=get_headers())
    if response.status_code != 200:
        raise Exception(f"API request failed: {response.status_code}")
    results = response.json()  # Assuming it's JSON now, adjust if needed
    # Filter for location
    location_data = [each for each in results if LOCATION.upper() in each.get('visa_location', '').upper()]
    if not location_data:
        return None
    return location_data[0]['slots']

def send_email(subject, body):
    message = MIMEMultipart()
    message['From'] = EMAIL_USER
    message['To'] = RECIPIENT
    message['Subject'] = subject
    message.attach(MIMEText(body, 'plain'))
    
    session = smtplib.SMTP('smtp.gmail.com', 587)
    session.starttls()
    session.login(EMAIL_USER, EMAIL_PASS)
    session.sendmail(EMAIL_USER, RECIPIENT, message.as_string())
    session.quit()

def main():
    # For testing, run once. For production, loop or schedule.
    try:
        slots = check_slots()
        if slots and slots > 0:
            send_email("Visa Slots Available", f"New slots available in {LOCATION}: {slots}")
        else:
            print("No slots available.")
    except Exception as e:
        send_email("Visa Slot Checker Error", str(e))

if __name__ == "__main__":
    main()