from pydantic import BaseModel, HttpUrl, validator
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from datetime import datetime


class ProcessingStatus(str, Enum):
    """Status values for processing jobs"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExtractionMethod(str, Enum):
    """Available extraction methods - matches UI options"""
    AI_BANK_PARSER = "ai_bank_parser"      # AWS Textract Tables (same as UI "AI Bank Parser")
    FORM_DATA_PARSER = "form_data_parser"  # AWS Textract Forms (same as UI "Form Data Parser")


# API Request Models
class SingleFileProcessRequest(BaseModel):
    """Request model for single file processing"""
    extraction_method: ExtractionMethod = ExtractionMethod.AI_BANK_PARSER
    webhook_url: Optional[HttpUrl] = None
    webhook_events: Optional[List[str]] = ["processing.completed", "processing.failed"]
    metadata: Optional[Dict[str, Any]] = {}
    
    @validator('webhook_events')
    def validate_webhook_events(cls, v):
        if v is not None:
            allowed_events = ["processing.started", "processing.completed", "processing.failed"]
            for event in v:
                if event not in allowed_events:
                    raise ValueError(f"Invalid webhook event: {event}")
        return v


class BulkFileProcessRequest(BaseModel):
    """Request model for bulk file processing"""
    extraction_method: ExtractionMethod = ExtractionMethod.AI_BANK_PARSER
    webhook_url: Optional[HttpUrl] = None
    webhook_events: Optional[List[str]] = ["processing.completed", "processing.failed"]
    metadata: Optional[Dict[str, Any]] = {}
    max_concurrent_jobs: Optional[int] = 3
    
    @validator('max_concurrent_jobs')
    def validate_concurrent_jobs(cls, v):
        if v is not None and (v < 1 or v > 10):
            raise ValueError("max_concurrent_jobs must be between 1 and 10")
        return v


class WatchFolderConfig(BaseModel):
    """Configuration for watch folder functionality"""
    folder_type: str  # 's3', 'drive', 'dropbox'
    folder_path: str
    credentials: Dict[str, str]
    poll_interval_hours: int = 24
    extraction_method: ExtractionMethod = ExtractionMethod.AI_BANK_PARSER
    webhook_url: Optional[HttpUrl] = None
    auto_delete_processed: bool = False
    file_patterns: Optional[List[str]] = ["*.pdf"]


# API Response Models  
class JobResponse(BaseModel):
    """Response model for job creation"""
    job_id: str
    status: ProcessingStatus
    message: str
    created_at: datetime
    webhook_url: Optional[str] = None
    metadata: Dict[str, Any] = {}


class JobStatusResponse(BaseModel):
    """Response model for job status"""
    job_id: str
    status: ProcessingStatus
    progress_percentage: int
    current_step: str
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    estimated_completion: Optional[datetime] = None


class BulkJobResponse(BaseModel):
    """Response model for bulk job creation"""
    bulk_job_id: str
    individual_job_ids: List[str]
    total_files: int
    status: ProcessingStatus
    created_at: datetime
    webhook_url: Optional[str] = None


class BulkJobStatusResponse(BaseModel):
    """Response model for bulk job status"""
    bulk_job_id: str
    status: ProcessingStatus
    total_files: int
    completed_files: int
    failed_files: int
    individual_jobs: List[JobStatusResponse]
    created_at: datetime
    updated_at: datetime


class ExtractionResult(BaseModel):
    """Standardized extraction result"""
    job_id: str
    status: ProcessingStatus
    file_name: str
    extraction_method: ExtractionMethod
    total_transactions: int
    transactions: List[Dict[str, Any]]
    summary: Dict[str, Any]
    processing_time_seconds: float
    created_at: datetime
    completed_at: Optional[datetime] = None


# Webhook Models
class WebhookEvent(BaseModel):
    """Webhook event payload"""
    event_type: str
    job_id: str
    timestamp: datetime
    data: Dict[str, Any]
    
    class Config:
        schema_extra = {
            "example": {
                "event_type": "processing.completed",
                "job_id": "job_123456",
                "timestamp": "2025-08-20T10:30:00Z",
                "data": {
                    "status": "completed",
                    "total_transactions": 45,
                    "processing_time_seconds": 12.5,
                    "file_name": "bank_statement.pdf"
                }
            }
        }


class WebhookDeliveryAttempt(BaseModel):
    """Webhook delivery attempt record"""
    webhook_id: str
    attempt_number: int
    status_code: int
    response_body: str
    attempted_at: datetime
    success: bool


# Watch Folder Models
class WatchFolderStatus(BaseModel):
    """Status of a watch folder"""
    folder_id: str
    folder_path: str
    last_scan: datetime
    files_processed_today: int
    status: str  # "active", "paused", "error"
    next_scan: datetime


class ProcessedFile(BaseModel):
    """Record of a processed file"""
    file_path: str
    job_id: str
    processed_at: datetime
    status: ProcessingStatus
    result_summary: Optional[Dict[str, Any]] = None