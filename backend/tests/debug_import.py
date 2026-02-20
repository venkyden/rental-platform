try:
    from app.main import app
    print("Import Successful")
except Exception as e:
    import traceback
    traceback.print_exc()
