import os
import tempfile
import requests
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from celery import current_task, group
from ..celery_app import celery_app
# Removed old PDF processing imports - using Textract directly now
from .models import ProcessingStatus, ExtractionMethod, WebhookEvent
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def process_single_file_api(
    self, 
    file_path: str, 
    extraction_method: str, 
    webhook_url: Optional[str] = None,
    webhook_events: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Enhanced single file processing task for API endpoints.
    
    Args:
        file_path: Path to the uploaded PDF file
        extraction_method: Method to use for extraction ('smart', 'intelligent', etc.)
        webhook_url: Optional webhook URL for notifications
        webhook_events: List of events to send webhooks for
        metadata: Additional metadata to include
        
    Returns:
        Dict containing processing results
    """
    job_id = self.request.id
    start_time = datetime.utcnow()
    
    try:
        # Send webhook for processing started
        if webhook_url and webhook_events and "processing.started" in webhook_events:
            send_webhook_notification.delay(
                webhook_url, 
                "processing.started", 
                job_id, 
                {"file_path": os.path.basename(file_path), "metadata": metadata or {}}
            )
        
        # Update task state
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Starting PDF processing...', 
                'progress': 10,
                'current_step': 'initialization'
            }
        )
        
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Starting extraction process...', 
                'progress': 30,
                'current_step': 'extraction_start'
            }
        )
        
        # Extract using the specified method
        logger.info(f"API Task: Processing with extraction_method='{extraction_method}' (type: {type(extraction_method)})")
        extraction_result = None
        
        if extraction_method == ExtractionMethod.AI_BANK_PARSER.value or extraction_method == "ai_bank_parser":
            logger.info("API Task: Using AI Bank Parser (Textract Tables)")
            # Use existing UI Textract Tables endpoint (same as UI "AI Bank Parser")
            try:
                extraction_result = extract_using_ui_textract_tables(file_path, job_id)
                logger.info(f"API Task: AI Bank Parser result keys: {list(extraction_result.keys()) if extraction_result else 'None'}")
            except Exception as e:
                logger.error(f"API Task: AI Bank Parser failed: {str(e)}")
                raise
        elif extraction_method == ExtractionMethod.FORM_DATA_PARSER.value or extraction_method == "form_data_parser":
            logger.info("API Task: Using Form Data Parser (Textract Forms)")
            # Use existing UI Textract Forms endpoint (same as UI "Form Data Parser")
            extraction_result = extract_using_ui_textract_forms(file_path, job_id)
        else:
            logger.warning(f"API Task: Unknown extraction method '{extraction_method}', defaulting to AI Bank Parser")
            # Default to AI Bank Parser (Textract Tables)
            extraction_result = extract_using_ui_textract_tables(file_path, job_id)
        
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Finalizing results...', 
                'progress': 90,
                'current_step': 'finalization'
            }
        )
        
        # Calculate processing time
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        # Prepare final result - preserve the structure from extraction
        final_result = {
            'job_id': job_id,
            'status': ProcessingStatus.COMPLETED,
            'file_name': os.path.basename(file_path),
            'extraction_method': extraction_method,
            'processing_time_seconds': processing_time,
            'created_at': start_time.isoformat(),
            'completed_at': end_time.isoformat(),
            'metadata': metadata or {}
        }
        
        # Add the extraction result data - keep UI structure intact
        if 'success' in extraction_result and 'tables' in extraction_result:
            # AI Bank Parser result - same structure as UI
            final_result.update({
                'tables': extraction_result.get('tables', []),
                'total_tables': extraction_result.get('total_tables', 0),
                'success': True
            })
        elif 'forms_data' in extraction_result:
            # Form Data Parser result  
            final_result.update({
                'forms_data': extraction_result.get('forms_data', []),
                'total_pages': len(extraction_result.get('forms_data', []))
            })
        elif 'tables' in extraction_result:
            # Fallback - older structure
            final_result.update({
                'tables': extraction_result.get('tables', []),
                'total_tables': len(extraction_result.get('tables', []))
            })
        
        # Include any additional details
        if 'textract_details' in extraction_result:
            final_result['textract_details'] = extraction_result['textract_details']
        
        # Send webhook for completion
        if webhook_url and webhook_events and "processing.completed" in webhook_events:
            webhook_data = {
                'status': 'completed',
                'processing_time_seconds': processing_time,
                'file_name': final_result['file_name'],
                'extraction_method': extraction_method
            }
            
            # Add method-specific data to webhook
            if 'tables' in final_result:
                webhook_data['total_tables'] = final_result['total_tables']
            elif 'forms_data' in final_result:
                webhook_data['total_pages'] = final_result['total_pages']
                
            send_webhook_notification.delay(webhook_url, "processing.completed", job_id, webhook_data)
        
        # Clean up temp file
        if os.path.exists(file_path):
            os.unlink(file_path)
        
        return final_result
        
    except Exception as e:
        logger.error(f"Error processing file {file_path}: {str(e)}")
        
        # Send webhook for failure
        if webhook_url and webhook_events and "processing.failed" in webhook_events:
            webhook_data = {
                'status': 'failed',
                'error_message': str(e),
                'file_name': os.path.basename(file_path)
            }
            send_webhook_notification.delay(webhook_url, "processing.failed", job_id, webhook_data)
        
        # Clean up temp file
        if os.path.exists(file_path):
            os.unlink(file_path)
        
        # Update task state to failure
        current_task.update_state(
            state=ProcessingStatus.FAILED,
            meta={
                'message': f'Error processing PDF: {str(e)}', 
                'progress': 0,
                'error': str(e)
            }
        )
        
        raise e


def extract_using_ui_textract_tables(file_path: str, job_id: str) -> Dict[str, Any]:
    """Extract using EXACT same logic as UI Textract Tables endpoint"""
    from ..textract_endpoints import get_textract_client, get_s3_client, extract_tables_from_blocks
    
    current_task.update_state(
        state=ProcessingStatus.IN_PROGRESS,
        meta={
            'message': 'Using AWS Textract Tables (AI Bank Parser)...', 
            'progress': 30,
            'current_step': 'textract_tables_upload'
        }
    )
    
    try:
        logger.info("API Task: Starting Textract Tables extraction using UI logic")
        
        # EXACT same logic as UI textract endpoints
        textract_client = get_textract_client()
        s3_client = get_s3_client()
        
        s3_bucket = os.getenv('AWS_S3_BUCKET', 'pandiver-textract-documents')
        s3_key = f"api-tables/{job_id}/{os.path.basename(file_path)}"
        
        # Upload to S3 (same as UI)
        try:
            s3_client.head_bucket(Bucket=s3_bucket)
        except:
            s3_client.create_bucket(
                Bucket=s3_bucket,
                CreateBucketConfiguration={'LocationConstraint': os.getenv('AWS_REGION', 'ap-south-1')}
            )
        
        with open(file_path, 'rb') as f:
            s3_client.put_object(
                Bucket=s3_bucket,
                Key=s3_key,
                Body=f.read(),
                ContentType='application/pdf'
            )
        
        # Start Textract analysis (same as UI)
        response = textract_client.start_document_analysis(
            DocumentLocation={
                'S3Object': {
                    'Bucket': s3_bucket,
                    'Name': s3_key
                }
            },
            FeatureTypes=['TABLES'],
            JobTag=f"pandiver-api-{job_id}"
        )
        
        textract_job_id = response['JobId']
        
        # Wait for completion (same as UI)
        import time
        max_wait_time = 300
        wait_interval = 10
        elapsed_time = 0
        
        while elapsed_time < max_wait_time:
            status_response = textract_client.get_document_analysis(JobId=textract_job_id)
            status = status_response['JobStatus']
            
            if status == 'SUCCEEDED':
                break
            elif status == 'FAILED':
                error_msg = status_response.get('StatusMessage', 'Textract analysis failed')
                raise Exception(f"Textract analysis failed: {error_msg}")
            
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        if elapsed_time >= max_wait_time:
            raise Exception("Textract analysis timed out")
        
        # Get all results (same as UI)
        all_blocks = []
        next_token = None
        
        while True:
            if next_token:
                result_response = textract_client.get_document_analysis(
                    JobId=textract_job_id,
                    NextToken=next_token
                )
            else:
                result_response = textract_client.get_document_analysis(
                    JobId=textract_job_id
                )
            
            all_blocks.extend(result_response['Blocks'])
            next_token = result_response.get('NextToken')
            if not next_token:
                break
        
        # Extract tables (same as UI)
        tables = extract_tables_from_blocks(all_blocks)
        
        logger.info(f"API Task: Extracted {len(tables)} tables using UI logic")
        
        # Clean up S3
        try:
            s3_client.delete_object(Bucket=s3_bucket, Key=s3_key)
        except:
            pass
        
        # Return EXACT same structure as UI endpoint
        return {
            'success': True,
            'tables': tables,
            'total_tables': len(tables)
        }
        
    except Exception as e:
        # Clean up S3 on error
        try:
            if 's3_client' in locals() and 's3_key' in locals():
                s3_client.delete_object(Bucket=s3_bucket, Key=s3_key)
        except:
            pass
        
        logger.error(f"API Task: Textract Tables extraction failed: {str(e)}")
        raise Exception(f"Textract Tables extraction failed: {str(e)}")


def extract_using_ui_textract_forms(file_path: str, job_id: str) -> Dict[str, Any]:
    """Extract using the UI Textract Forms endpoint (same as Form Data Parser)"""
    import tempfile
    from ..textract_endpoints import get_textract_client, get_s3_client, extract_key_value_pairs_from_blocks
    
    current_task.update_state(
        state=ProcessingStatus.IN_PROGRESS,
        meta={
            'message': 'Using AWS Textract Forms (Form Data Parser)...', 
            'progress': 30,
            'current_step': 'textract_forms_upload'
        }
    )
    
    try:
        # Use the same logic as the UI textract endpoints
        textract_client = get_textract_client()
        s3_client = get_s3_client()
        
        s3_bucket = os.getenv('AWS_S3_BUCKET', 'pandiver-textract-documents')
        s3_key = f"api-forms/{job_id}/{os.path.basename(file_path)}"
        
        # Ensure bucket exists
        try:
            s3_client.head_bucket(Bucket=s3_bucket)
        except:
            s3_client.create_bucket(
                Bucket=s3_bucket,
                CreateBucketConfiguration={'LocationConstraint': os.getenv('AWS_REGION', 'ap-south-1')}
            )
        
        # Upload to S3
        with open(file_path, 'rb') as f:
            s3_client.put_object(
                Bucket=s3_bucket,
                Key=s3_key,
                Body=f.read(),
                ContentType='application/pdf'
            )
        
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Starting Textract Forms analysis...', 
                'progress': 50,
                'current_step': 'textract_forms_start'
            }
        )
        
        # Start analysis
        response = textract_client.start_document_analysis(
            DocumentLocation={
                'S3Object': {
                    'Bucket': s3_bucket,
                    'Name': s3_key
                }
            },
            FeatureTypes=['FORMS'],
            JobTag=f"pandiver-api-forms-{job_id}"
        )
        
        textract_job_id = response['JobId']
        
        # Wait for completion
        import time
        max_wait_time = 300  # 5 minutes
        wait_interval = 10
        elapsed_time = 0
        
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Waiting for Textract Forms to complete...', 
                'progress': 60,
                'current_step': 'textract_forms_wait'
            }
        )
        
        while elapsed_time < max_wait_time:
            status_response = textract_client.get_document_analysis(JobId=textract_job_id)
            status = status_response['JobStatus']
            
            if status == 'SUCCEEDED':
                break
            elif status == 'FAILED':
                error_msg = status_response.get('StatusMessage', 'Textract analysis failed')
                raise Exception(f"Textract analysis failed: {error_msg}")
            
            progress = min(70 + (elapsed_time / max_wait_time) * 20, 85)
            current_task.update_state(
                state=ProcessingStatus.IN_PROGRESS,
                meta={
                    'message': f'Textract processing... ({elapsed_time}s)', 
                    'progress': int(progress),
                    'current_step': 'textract_forms_processing'
                }
            )
            
            time.sleep(wait_interval)
            elapsed_time += wait_interval
        
        if elapsed_time >= max_wait_time:
            raise Exception("Textract analysis timed out")
        
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Extracting forms results...', 
                'progress': 90,
                'current_step': 'textract_forms_extract'
            }
        )
        
        # Get results (same logic as UI endpoint)
        all_blocks = []
        next_token = None
        
        while True:
            if next_token:
                result_response = textract_client.get_document_analysis(
                    JobId=textract_job_id,
                    NextToken=next_token
                )
            else:
                result_response = textract_client.get_document_analysis(
                    JobId=textract_job_id
                )
            
            all_blocks.extend(result_response['Blocks'])
            next_token = result_response.get('NextToken')
            if not next_token:
                break
        
        # Extract forms using UI logic
        forms_data = extract_key_value_pairs_from_blocks(all_blocks)
        
        # Return the same structure as UI - preserve forms data structure
        
        # Clean up S3
        try:
            s3_client.delete_object(Bucket=s3_bucket, Key=s3_key)
        except:
            pass
        
        # Generate summary from forms data
        summary = {
            'total_pages': len(forms_data),
            'total_blocks': len(all_blocks),
            'method_used': 'form_data_parser'
        }
        
        # Return UI-compatible structure for forms
        return {
            'forms_data': forms_data,  # This matches UI structure for forms export
            'summary': summary,
            'method_used': 'form_data_parser',
            'textract_details': {
                'total_blocks': len(all_blocks),
                'forms_pages': len(forms_data)
            }
        }
        
    except Exception as e:
        # Clean up S3 on error
        try:
            if 's3_client' in locals() and 's3_key' in locals():
                s3_client.delete_object(Bucket=s3_bucket, Key=s3_key)
        except:
            pass
        
        raise Exception(f"Textract Forms extraction failed: {str(e)}")




def generate_transaction_summary(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate summary statistics from transactions"""
    if not transactions:
        return {
            'total_transactions': 0,
            'total_credits': 0,
            'total_debits': 0,
            'date_range': None,
            'final_balance': None
        }
    
    total_credits = 0
    total_debits = 0
    dates = []
    final_balance = None
    
    for txn in transactions:
        # Handle different field names
        credit = txn.get('Credit') or txn.get('Deposits') or txn.get('Deposit_Amount') or 0
        debit = txn.get('Debit') or txn.get('Withdrawals') or txn.get('Withdrawal_Amount') or 0
        balance = txn.get('Balance') or txn.get('Closing_Balance')
        date = txn.get('Date')
        
        if isinstance(credit, (int, float)):
            total_credits += credit
        if isinstance(debit, (int, float)):
            total_debits += debit
        if balance is not None:
            final_balance = balance
        if date:
            dates.append(date)
    
    return {
        'total_transactions': len(transactions),
        'total_credits': total_credits,
        'total_debits': total_debits,
        'date_range': {
            'start': dates[0] if dates else None,
            'end': dates[-1] if dates else None
        },
        'final_balance': final_balance
    }


@celery_app.task(bind=True)
def process_bulk_files_api(
    self, 
    file_paths: List[str], 
    extraction_method: str, 
    webhook_url: Optional[str] = None,
    webhook_events: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    max_concurrent_jobs: int = 3
) -> Dict[str, Any]:
    """
    Process multiple files concurrently.
    
    Args:
        file_paths: List of paths to PDF files
        extraction_method: Method to use for extraction
        webhook_url: Optional webhook URL for notifications
        webhook_events: List of events to send webhooks for
        metadata: Additional metadata
        max_concurrent_jobs: Maximum number of concurrent processing jobs
        
    Returns:
        Dict containing bulk processing results
    """
    bulk_job_id = self.request.id
    start_time = datetime.utcnow()
    
    try:
        # Update progress
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': f'Starting bulk processing of {len(file_paths)} files...', 
                'progress': 10,
                'current_step': 'initialization',
                'files_total': len(file_paths),
                'files_completed': 0
            }
        )
        
        # Create individual job tasks
        individual_tasks = []
        for file_path in file_paths:
            task = process_single_file_api.delay(
                file_path, 
                extraction_method, 
                None,  # Individual jobs don't send webhooks
                None,
                metadata
            )
            individual_tasks.append({
                'task_id': task.id,
                'file_path': file_path,
                'task': task
            })
        
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': f'Processing {len(file_paths)} files concurrently...', 
                'progress': 20,
                'current_step': 'processing',
                'files_total': len(file_paths),
                'files_completed': 0,
                'individual_job_ids': [t['task_id'] for t in individual_tasks]
            }
        )
        
        # Poll for completion without using .get()
        results = []
        completed_count = 0
        failed_count = 0
        max_wait_time = 1800  # 30 minutes for bulk
        check_interval = 5  # Check every 5 seconds
        elapsed_time = 0
        
        while completed_count + failed_count < len(individual_tasks) and elapsed_time < max_wait_time:
            for task_info in individual_tasks:
                if 'result' not in task_info:  # Not processed yet
                    task = task_info['task']
                    if task.ready():
                        try:
                            if task.successful():
                                result = task.result
                                task_info['result'] = result
                                results.append(result)
                                completed_count += 1
                            else:
                                # Task failed
                                task_info['result'] = {
                                    'job_id': task.id,
                                    'status': ProcessingStatus.FAILED,
                                    'file_name': os.path.basename(task_info['file_path']),
                                    'error_message': str(task.info) if task.info else 'Task failed'
                                }
                                results.append(task_info['result'])
                                failed_count += 1
                        except Exception as e:
                            # Handle task errors
                            task_info['result'] = {
                                'job_id': task.id,
                                'status': ProcessingStatus.FAILED,
                                'file_name': os.path.basename(task_info['file_path']),
                                'error_message': str(e)
                            }
                            results.append(task_info['result'])
                            failed_count += 1
            
            # Update progress
            progress = 20 + int((completed_count + failed_count) / len(individual_tasks) * 70)
            current_task.update_state(
                state=ProcessingStatus.IN_PROGRESS,
                meta={
                    'message': f'Progress: {completed_count + failed_count}/{len(file_paths)} files processed', 
                    'progress': progress,
                    'current_step': 'processing',
                    'files_total': len(file_paths),
                    'files_completed': completed_count,
                    'files_failed': failed_count
                }
            )
            
            import time
            time.sleep(check_interval)
            elapsed_time += check_interval
        
        # Check for timeout
        if elapsed_time >= max_wait_time:
            raise Exception(f"Bulk processing timed out after {max_wait_time/60} minutes")
        
        # Final processing
        current_task.update_state(
            state=ProcessingStatus.IN_PROGRESS,
            meta={
                'message': 'Finalizing bulk processing results...', 
                'progress': 95,
                'current_step': 'finalization',
                'files_total': len(file_paths),
                'files_completed': completed_count,
                'files_failed': failed_count
            }
        )
        
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        bulk_result = {
            'bulk_job_id': bulk_job_id,
            'status': ProcessingStatus.COMPLETED,
            'total_files': len(file_paths),
            'completed_files': completed_count,
            'failed_files': failed_count,
            'individual_results': results,
            'individual_job_ids': [t['task_id'] for t in individual_tasks],
            'processing_time_seconds': processing_time,
            'created_at': start_time.isoformat(),
            'completed_at': end_time.isoformat()
        }
        
        # Send webhook for bulk completion
        if webhook_url and webhook_events and "processing.completed" in webhook_events:
            webhook_data = {
                'bulk_status': 'completed',
                'total_files': len(file_paths),
                'completed_files': completed_count,
                'failed_files': failed_count,
                'processing_time_seconds': processing_time
            }
            send_webhook_notification.delay(webhook_url, "bulk.processing.completed", bulk_job_id, webhook_data)
        
        return bulk_result
        
    except Exception as e:
        logger.error(f"Error processing bulk files: {str(e)}")
        
        # Send webhook for failure
        if webhook_url and webhook_events and "processing.failed" in webhook_events:
            webhook_data = {
                'bulk_status': 'failed',
                'error_message': str(e),
                'total_files': len(file_paths)
            }
            send_webhook_notification.delay(webhook_url, "bulk.processing.failed", bulk_job_id, webhook_data)
        
        raise e


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_webhook_notification(
    self, 
    webhook_url: str, 
    event_type: str, 
    job_id: str, 
    data: Dict[str, Any]
):
    """
    Send webhook notification with retry logic.
    
    Args:
        webhook_url: URL to send webhook to
        event_type: Type of event (e.g., 'processing.completed')
        job_id: Job ID
        data: Event data to send
    """
    try:
        webhook_payload = {
            'event_type': event_type,
            'job_id': job_id,
            'timestamp': datetime.utcnow().isoformat(),
            'data': data
        }
        
        response = requests.post(
            webhook_url,
            json=webhook_payload,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        
        response.raise_for_status()
        
        logger.info(f"Webhook sent successfully to {webhook_url} for job {job_id}")
        return {
            'success': True,
            'status_code': response.status_code,
            'response': response.text[:500]  # Truncate response
        }
        
    except requests.RequestException as e:
        logger.error(f"Webhook delivery failed to {webhook_url}: {str(e)}")
        
        # Retry the task
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying webhook delivery, attempt {self.request.retries + 1}")
            raise self.retry(countdown=60 * (2 ** self.request.retries))  # Exponential backoff
        else:
            logger.error(f"Max retries exceeded for webhook to {webhook_url}")
            return {
                'success': False,
                'error': str(e),
                'max_retries_exceeded': True
            }