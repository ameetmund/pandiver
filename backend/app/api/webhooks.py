import os
import json
import uuid
import hmac
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Integer, Boolean, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from ..auth import get_current_user, get_db
from ..models import User as UserModel

router = APIRouter()

# Webhook Models (you might want to add these to your existing models.py)
class WebhookEndpoint:
    """Model for storing webhook endpoints"""
    def __init__(self, url: str, events: List[str], secret: Optional[str] = None, 
                 user_id: Optional[int] = None, active: bool = True):
        self.id = str(uuid.uuid4())
        self.url = url
        self.events = events
        self.secret = secret or generate_webhook_secret()
        self.user_id = user_id
        self.active = active
        self.created_at = datetime.utcnow()

# In-memory storage for demonstration (use database in production)
webhook_endpoints = {}
webhook_deliveries = {}


def generate_webhook_secret() -> str:
    """Generate a random webhook secret"""
    return "whsec_" + uuid.uuid4().hex


def sign_webhook_payload(payload: str, secret: str) -> str:
    """Generate HMAC signature for webhook payload"""
    key = secret.encode('utf-8')
    message = payload.encode('utf-8')
    signature = hmac.new(key, message, hashlib.sha256).hexdigest()
    return f"sha256={signature}"


def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    """Verify webhook signature"""
    expected_signature = sign_webhook_payload(payload, secret)
    return hmac.compare_digest(signature, expected_signature)


@router.post("/webhooks/endpoints")
async def create_webhook_endpoint(
    url: str = Body(...),
    events: List[str] = Body(...),
    description: Optional[str] = Body(""),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Create a new webhook endpoint for receiving processing notifications.
    
    **Parameters:**
    - `url`: The URL to send webhooks to (must be HTTPS in production)
    - `events`: List of events to subscribe to
    - `description`: Optional description for the webhook
    
    **Available Events:**
    - `processing.started`: When a job starts processing
    - `processing.completed`: When a job completes successfully  
    - `processing.failed`: When a job fails
    - `bulk.processing.completed`: When a bulk job completes
    - `bulk.processing.failed`: When a bulk job fails
    
    **Returns:**
    - Webhook endpoint details including secret for signature verification
    
    **Example curl:**
    ```bash
    curl -X POST "http://localhost:8000/api/v1/webhooks/endpoints" \
         -H "Authorization: Bearer YOUR_JWT_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{
           "url": "https://yourdomain.com/webhooks/pandiver",
           "events": ["processing.completed", "processing.failed"],
           "description": "Production webhook for processing results"
         }'
    ```
    """
    # Validate events
    valid_events = [
        "processing.started", 
        "processing.completed", 
        "processing.failed",
        "bulk.processing.completed",
        "bulk.processing.failed"
    ]
    
    for event in events:
        if event not in valid_events:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event: {event}. Valid events: {', '.join(valid_events)}"
            )
    
    # Create webhook endpoint
    webhook = WebhookEndpoint(
        url=url,
        events=events,
        user_id=current_user.id
    )
    
    # Store in memory (use database in production)
    webhook_endpoints[webhook.id] = webhook
    
    return {
        "webhook_id": webhook.id,
        "url": webhook.url,
        "events": webhook.events,
        "secret": webhook.secret,
        "active": webhook.active,
        "created_at": webhook.created_at.isoformat(),
        "description": description,
        "signature_info": {
            "header_name": "X-Pandiver-Signature",
            "algorithm": "HMAC-SHA256",
            "example": "sha256=1a2b3c4d5e6f..."
        }
    }


@router.get("/webhooks/endpoints")
async def list_webhook_endpoints(
    current_user: UserModel = Depends(get_current_user)
):
    """
    List all webhook endpoints for the current user.
    
    **Returns:**
    - List of user's webhook endpoints
    
    **Example curl:**
    ```bash
    curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
         "http://localhost:8000/api/v1/webhooks/endpoints"
    ```
    """
    user_webhooks = []
    
    for webhook_id, webhook in webhook_endpoints.items():
        if webhook.user_id == current_user.id:
            user_webhooks.append({
                "webhook_id": webhook.id,
                "url": webhook.url,
                "events": webhook.events,
                "active": webhook.active,
                "created_at": webhook.created_at.isoformat(),
                # Don't return the secret in list view
                "secret": f"whsec_***{webhook.secret[-8:]}" if webhook.secret else None
            })
    
    return {"webhooks": user_webhooks, "total": len(user_webhooks)}


@router.get("/webhooks/endpoints/{webhook_id}")
async def get_webhook_endpoint(
    webhook_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get details of a specific webhook endpoint.
    
    **Parameters:**
    - `webhook_id`: The webhook endpoint ID
    
    **Returns:**
    - Webhook endpoint details including full secret
    """
    webhook = webhook_endpoints.get(webhook_id)
    
    if not webhook or webhook.user_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Webhook endpoint not found"
        )
    
    return {
        "webhook_id": webhook.id,
        "url": webhook.url,
        "events": webhook.events,
        "secret": webhook.secret,
        "active": webhook.active,
        "created_at": webhook.created_at.isoformat()
    }


@router.put("/webhooks/endpoints/{webhook_id}")
async def update_webhook_endpoint(
    webhook_id: str,
    url: Optional[str] = Body(None),
    events: Optional[List[str]] = Body(None),
    active: Optional[bool] = Body(None),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Update a webhook endpoint.
    
    **Parameters:**
    - `webhook_id`: The webhook endpoint ID
    - `url`: New URL (optional)
    - `events`: New events list (optional)
    - `active`: Enable/disable webhook (optional)
    
    **Returns:**
    - Updated webhook endpoint details
    """
    webhook = webhook_endpoints.get(webhook_id)
    
    if not webhook or webhook.user_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Webhook endpoint not found"
        )
    
    # Update fields
    if url is not None:
        webhook.url = url
    if events is not None:
        # Validate events
        valid_events = [
            "processing.started", 
            "processing.completed", 
            "processing.failed",
            "bulk.processing.completed",
            "bulk.processing.failed"
        ]
        
        for event in events:
            if event not in valid_events:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid event: {event}. Valid events: {', '.join(valid_events)}"
                )
        webhook.events = events
    if active is not None:
        webhook.active = active
    
    return {
        "webhook_id": webhook.id,
        "url": webhook.url,
        "events": webhook.events,
        "active": webhook.active,
        "created_at": webhook.created_at.isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }


@router.delete("/webhooks/endpoints/{webhook_id}")
async def delete_webhook_endpoint(
    webhook_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Delete a webhook endpoint.
    
    **Parameters:**
    - `webhook_id`: The webhook endpoint ID
    
    **Returns:**
    - Confirmation of deletion
    """
    webhook = webhook_endpoints.get(webhook_id)
    
    if not webhook or webhook.user_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Webhook endpoint not found"
        )
    
    del webhook_endpoints[webhook_id]
    
    return {
        "webhook_id": webhook_id,
        "message": "Webhook endpoint deleted successfully"
    }


@router.post("/webhooks/endpoints/{webhook_id}/test")
async def test_webhook_endpoint(
    webhook_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Send a test webhook to verify the endpoint is working.
    
    **Parameters:**
    - `webhook_id`: The webhook endpoint ID
    
    **Returns:**
    - Test result
    
    **Example curl:**
    ```bash
    curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
         "http://localhost:8000/api/v1/webhooks/endpoints/webhook123/test"
    ```
    """
    webhook = webhook_endpoints.get(webhook_id)
    
    if not webhook or webhook.user_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Webhook endpoint not found"
        )
    
    # Send test webhook
    test_payload = {
        "event_type": "webhook.test",
        "job_id": "test_job_123",
        "timestamp": datetime.utcnow().isoformat(),
        "data": {
            "message": "This is a test webhook from Pandiver API",
            "webhook_id": webhook_id,
            "test_timestamp": datetime.utcnow().isoformat()
        }
    }
    
    try:
        import requests
        
        payload_str = json.dumps(test_payload)
        signature = sign_webhook_payload(payload_str, webhook.secret)
        
        response = requests.post(
            webhook.url,
            json=test_payload,
            headers={
                'Content-Type': 'application/json',
                'X-Pandiver-Signature': signature,
                'X-Pandiver-Event': 'webhook.test'
            },
            timeout=10
        )
        
        response.raise_for_status()
        
        return {
            "success": True,
            "status_code": response.status_code,
            "response_time_ms": response.elapsed.total_seconds() * 1000,
            "message": "Test webhook sent successfully"
        }
        
    except requests.RequestException as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Test webhook delivery failed"
        }


@router.get("/webhooks/deliveries")
async def list_webhook_deliveries(
    webhook_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: UserModel = Depends(get_current_user)
):
    """
    List webhook delivery attempts.
    
    **Parameters:**
    - `webhook_id`: Filter by specific webhook endpoint (optional)
    - `limit`: Maximum number of deliveries to return (default: 50, max: 200)
    - `offset`: Number of deliveries to skip (default: 0)
    
    **Returns:**
    - List of webhook delivery attempts
    """
    if limit > 200:
        limit = 200
    
    # This is a simplified implementation
    # In production, you'd query a database of webhook deliveries
    
    user_deliveries = []
    
    for delivery_id, delivery in webhook_deliveries.items():
        # Check if delivery belongs to user's webhook
        webhook = webhook_endpoints.get(delivery.get('webhook_id'))
        if webhook and webhook.user_id == current_user.id:
            if webhook_id is None or delivery.get('webhook_id') == webhook_id:
                user_deliveries.append(delivery)
    
    # Sort by timestamp (most recent first)
    user_deliveries.sort(key=lambda d: d.get('timestamp', ''), reverse=True)
    
    # Apply pagination
    paginated_deliveries = user_deliveries[offset:offset + limit]
    
    return {
        "deliveries": paginated_deliveries,
        "total": len(user_deliveries),
        "limit": limit,
        "offset": offset
    }


@router.post("/webhooks/regenerate-secret/{webhook_id}")
async def regenerate_webhook_secret(
    webhook_id: str,
    current_user: UserModel = Depends(get_current_user)
):
    """
    Regenerate the secret for a webhook endpoint.
    
    **Parameters:**
    - `webhook_id`: The webhook endpoint ID
    
    **Returns:**
    - New secret
    
    **Warning:** This will invalidate the old secret immediately. Update your 
    webhook handler before regenerating the secret.
    """
    webhook = webhook_endpoints.get(webhook_id)
    
    if not webhook or webhook.user_id != current_user.id:
        raise HTTPException(
            status_code=404,
            detail="Webhook endpoint not found"
        )
    
    # Generate new secret
    old_secret = webhook.secret
    webhook.secret = generate_webhook_secret()
    
    return {
        "webhook_id": webhook_id,
        "new_secret": webhook.secret,
        "message": "Webhook secret regenerated successfully",
        "warning": "Old secret is now invalid. Update your webhook handler immediately."
    }