from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Removed is_active to match existing database schema

    # Relationship to user tables
    tables = relationship("UserTable", back_populates="user")
    # Relationship to API keys
    api_keys = relationship("ApiKey", back_populates="user")
    # Relationship to API usage
    api_usage = relationship("ApiUsage", back_populates="user")

class UserTable(Base):
    __tablename__ = "user_tables"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String, index=True)
    table_data = Column(Text)  # JSON string of table data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to user
    user = relationship("User", back_populates="tables")

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    key_name = Column(String, index=True)  # User-friendly name for the key
    api_key = Column(String, unique=True, index=True)  # The actual API key
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)

    # Relationship to user
    user = relationship("User", back_populates="api_keys")
    # Relationship to usage records
    usage_records = relationship("ApiUsage", back_populates="api_key")

class ApiUsage(Base):
    __tablename__ = "api_usage"

    id = Column(Integer, primary_key=True, index=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String)  # Which API endpoint was called
    job_id = Column(String, index=True)  # Job ID for tracking
    status = Column(String)  # IN_PROGRESS, SUCCEEDED, FAILED
    file_count = Column(Integer, default=0)  # Number of files processed
    processing_time = Column(Float, nullable=True)  # Time taken in seconds
    error_message = Column(Text, nullable=True)  # Error details if failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    api_key = relationship("ApiKey", back_populates="usage_records")
    user = relationship("User", back_populates="api_usage")