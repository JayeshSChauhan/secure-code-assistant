from flask import Flask

app = Flask(__name__)

# Insecure: Hardcoded secret!
API_KEY = "sk-12345abcdefg67890hijklmn"
secret_key = "my-super-secret-password-that-is-not-safe"

@app.route("/admin")
def admin_panel():
    # Insecure: Missing authorization check!
    return "Welcome to the admin panel."