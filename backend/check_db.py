from sqlalchemy import create_engine, inspect
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nook.db")
print(f"Connecting to: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)
inspector = inspect(engine)
columns = [col['name'] for col in inspector.get_columns('users')]
print(f"Columns in 'users' table: {columns}")
if 'is_admin' in columns:
    print("SUCCESS: is_admin column exists.")
else:
    print("FAILURE: is_admin column MISSING.")
