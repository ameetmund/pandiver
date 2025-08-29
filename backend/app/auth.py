"""
Authentication utilities for the Pandiver API
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session
from .models import User as UserModel

# Security scheme
security = HTTPBearer()

# Authentication configuration (should match main.py)
SECRET_KEY = "your-secret-key-here"  # In production, use environment variable
ALGORITHM = "HS256"


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user ID"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_db():
    """Database dependency - import from main to avoid circular imports"""
    from .main import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(user_id: str = Depends(verify_token), db: Session = Depends(get_db)):
    """Get current authenticated user"""
    # Convert string user_id to integer for database query
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format")
    
    user = db.query(UserModel).filter(UserModel.id == user_id_int).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user