from app.models.user import User

user = User(email="test@test.com")
print(f"User is_active before flush: {user.is_active}")
