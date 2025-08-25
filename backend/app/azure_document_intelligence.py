"""
Azure Document Intelligence client and utility functions
Replicates AWS Textract functionality using Azure Document Intelligence Layout model
"""

from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError
from fastapi import HTTPException
import os
import tempfile
import uuid
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import json


def get_azure_di_client():
    """Initialize Azure Document Intelligence client with credentials from environment variables"""
    try:
        endpoint = os.getenv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')
        key = os.getenv('AZURE_DOCUMENT_INTELLIGENCE_KEY')
        
        if not endpoint or not key:
            raise HTTPException(
                status_code=500, 
                detail="Azure Document Intelligence credentials not configured"
            )
        
        client = DocumentIntelligenceClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(key)
        )
        return client
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to initialize Azure Document Intelligence client: {str(e)}"
        )


def start_layout_analysis(file_content: bytes, filename: str) -> str:
    """Start layout analysis using Azure Document Intelligence"""
    try:
        client = get_azure_di_client()
        
        # Start analyze document operation using Layout model with key-value pairs feature
        poller = client.begin_analyze_document(
            "prebuilt-layout",  # Use Layout model as recommended by Microsoft
            file_content,
            content_type="application/pdf",
            features=["keyValuePairs"]  # Enable key-value pairs extraction feature
        )
        
        # Generate unique operation ID for tracking
        operation_id = str(uuid.uuid4())
        
        # Store operation info (in production, use Redis or database)
        azure_di_jobs[operation_id] = {
            'poller': poller,
            'status': 'IN_PROGRESS',
            'original_filename': filename,
            'started_at': datetime.now().isoformat(),
            'result': None,
            'error': None
        }
        
        return operation_id
        
    except AzureError as e:
        raise HTTPException(status_code=500, detail=f"Azure DI analysis failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")


def get_analysis_status(operation_id: str) -> Dict[str, Any]:
    """Get status of Azure DI analysis operation"""
    if operation_id not in azure_di_jobs:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    job_info = azure_di_jobs[operation_id]
    poller = job_info['poller']
    
    try:
        if poller.done():
            if not job_info['result']:  # Only process once
                result = poller.result()
                job_info['result'] = result
                job_info['status'] = 'SUCCEEDED'
            
            return {
                'operation_id': operation_id,
                'status': 'SUCCEEDED',
                'result_available': True
            }
        else:
            return {
                'operation_id': operation_id,
                'status': 'IN_PROGRESS',
                'result_available': False
            }
            
    except Exception as e:
        job_info['status'] = 'FAILED'
        job_info['error'] = str(e)
        return {
            'operation_id': operation_id,
            'status': 'FAILED',
            'error': str(e)
        }


def extract_tables_from_azure_result(operation_id: str) -> List[Dict[str, Any]]:
    """Extract tables from Azure Document Intelligence Layout model result"""
    if operation_id not in azure_di_jobs:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    job_info = azure_di_jobs[operation_id]
    
    if job_info['status'] != 'SUCCEEDED' or not job_info['result']:
        raise HTTPException(status_code=400, detail="Analysis not completed or failed")
    
    try:
        result = job_info['result']
        extracted_tables = []
        
        # Extract tables from Layout model result
        if hasattr(result, 'tables') and result.tables:
            for table_idx, table in enumerate(result.tables):
                # Initialize table grid with proper dimensions
                table_grid = {}
                max_row = 0
                max_col = 0
                
                # Process all cells to determine table structure
                for cell in table.cells:
                    row_idx = cell.row_index
                    col_idx = cell.column_index
                    max_row = max(max_row, row_idx)
                    max_col = max(max_col, col_idx)
                    
                    # Store cell content with position
                    if row_idx not in table_grid:
                        table_grid[row_idx] = {}
                    table_grid[row_idx][col_idx] = cell.content or ''
                
                # Convert grid to structured table data
                table_data = []
                for row_idx in range(max_row + 1):
                    row_data = []
                    for col_idx in range(max_col + 1):
                        cell_content = table_grid.get(row_idx, {}).get(col_idx, '')
                        row_data.append(cell_content)
                    table_data.append(row_data)
                
                # Determine page number from table spans
                page_number = 1
                if hasattr(table, 'bounding_regions') and table.bounding_regions:
                    page_number = table.bounding_regions[0].page_number
                
                # Format according to AWS Textract structure
                if table_data and any(any(cell.strip() for cell in row) for row in table_data):
                    headers = table_data[0] if table_data else []
                    rows = table_data[1:] if len(table_data) > 1 else []
                    
                    extracted_tables.append({
                        'table_id': table_idx + 1,
                        'headers': headers,
                        'rows': rows,
                        'page_number': page_number - 1,  # Convert to 0-based
                        'row_count': len(table_data),
                        'column_count': max_col + 1
                    })
        
        return extracted_tables
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract tables: {str(e)}")


def extract_key_value_pairs_from_azure_result(operation_id: str) -> List[Dict[str, Any]]:
    """Extract key-value pairs from Azure Document Intelligence Layout model result with intelligent filtering"""
    if operation_id not in azure_di_jobs:
        raise HTTPException(status_code=404, detail="Operation not found")
    
    job_info = azure_di_jobs[operation_id]
    
    if job_info['status'] != 'SUCCEEDED' or not job_info['result']:
        raise HTTPException(status_code=400, detail="Analysis not completed or failed")
    
    try:
        result = job_info['result']
        pages_data = []
        
        def is_valid_key_value_pair(key: str, value: str) -> bool:
            """Filter out invalid or unwanted key-value pairs"""
            key = key.strip()
            value = value.strip()
            
            # Skip if key or value is empty
            if not key or not value:
                return False
            
            # Skip very long keys (likely not real labels)
            if len(key) > 50:
                return False
                
            # Skip keys that are just numbers or single characters
            if key.isdigit() or len(key) == 1:
                return False
                
            # Skip keys that are common text fragments (not form labels)
            invalid_patterns = [
                'the', 'and', 'or', 'but', 'for', 'at', 'by', 'from', 'to', 'in', 'on', 'with',
                'this', 'that', 'these', 'those', 'a', 'an', 'as', 'is', 'was', 'are', 'were',
                'page', 'document', 'file', 'text', 'content', 'paragraph', 'section'
            ]
            
            if key.lower() in invalid_patterns:
                return False
                
            # Skip if key contains common sentence starters
            sentence_starters = ['if', 'when', 'where', 'how', 'why', 'what', 'which', 'who']
            if any(key.lower().startswith(starter) for starter in sentence_starters):
                return False
                
            # Skip if key looks like a sentence (contains multiple words and ends with punctuation)
            if len(key.split()) > 5 and key.endswith(('.', '?', '!')):
                return False
                
            return True
        
        # Extract key-value pairs from Layout model result with keyValuePairs feature enabled
        if hasattr(result, 'key_value_pairs') and result.key_value_pairs:
            # Group by page
            pages_kvp = {}
            
            for kvp in result.key_value_pairs:
                # Get page number from bounding regions or spans
                page_number = 1  # Default to page 1
                
                # Try to get page number from key bounding regions first
                if hasattr(kvp, 'key') and kvp.key and hasattr(kvp.key, 'bounding_regions') and kvp.key.bounding_regions:
                    page_number = kvp.key.bounding_regions[0].page_number
                # Fallback to key spans
                elif hasattr(kvp, 'key') and kvp.key and hasattr(kvp.key, 'spans') and kvp.key.spans:
                    page_number = kvp.key.spans[0].page_number
                # Try value bounding regions
                elif hasattr(kvp, 'value') and kvp.value and hasattr(kvp.value, 'bounding_regions') and kvp.value.bounding_regions:
                    page_number = kvp.value.bounding_regions[0].page_number
                # Fallback to value spans
                elif hasattr(kvp, 'value') and kvp.value and hasattr(kvp.value, 'spans') and kvp.value.spans:
                    page_number = kvp.value.spans[0].page_number
                
                if page_number not in pages_kvp:
                    pages_kvp[page_number] = []
                
                # Extract key and value content safely
                key_text = ''
                value_text = ''
                
                if hasattr(kvp, 'key') and kvp.key:
                    key_text = kvp.key.content if hasattr(kvp.key, 'content') and kvp.key.content else ''
                
                if hasattr(kvp, 'value') and kvp.value:
                    value_text = kvp.value.content if hasattr(kvp.value, 'content') and kvp.value.content else ''
                
                # Extract confidence score from Azure API
                confidence_score = 0.0
                if hasattr(kvp, 'confidence') and kvp.confidence is not None:
                    confidence_score = round(kvp.confidence, 2)
                
                # Apply intelligent filtering
                if is_valid_key_value_pair(key_text, value_text):
                    pages_kvp[page_number].append({
                        'key': key_text.strip(),
                        'value': value_text.strip(),
                        'confidence': confidence_score
                    })
            
            # Convert to format matching AWS Textract
            for page_num in sorted(pages_kvp.keys()):
                key_value_pairs = pages_kvp[page_num]
                
                if key_value_pairs:  # Only create page data if we have pairs
                    headers = [pair['key'] for pair in key_value_pairs]
                    values = [pair['value'] for pair in key_value_pairs]
                    
                    pages_data.append({
                        'page_number': page_num - 1,  # Convert to 0-based
                        'headers': headers,
                        'data': [values] if values else [],  # Single row of data
                        'key_value_pairs': key_value_pairs
                    })
        
        # Enhanced fallback: extract from paragraphs with better pattern recognition
        if not pages_data and hasattr(result, 'paragraphs') and result.paragraphs:
            page_kvp_fallback = {}
            
            for paragraph in result.paragraphs:
                page_number = 1
                if hasattr(paragraph, 'bounding_regions') and paragraph.bounding_regions:
                    page_number = paragraph.bounding_regions[0].page_number
                
                content = paragraph.content if hasattr(paragraph, 'content') else ''
                
                # Look for various key-value patterns
                patterns_to_try = [
                    # Colon separated: "Label: Value"
                    r'([^:\n]+):\s*([^\n]+)',
                    # Form field pattern: "Label ___Value___" or "Label _____Value"
                    r'([A-Za-z][^_\n]{2,30})\s*_{3,}\s*([^\n_]+)',
                    # Equals separated: "Label = Value"
                    r'([^=\n]+)=\s*([^\n]+)',
                    # Tab or multiple spaces separated: "Label    Value"
                    r'([A-Za-z][^\t\n]{2,30})\s{4,}([^\s\n][^\n]*)'
                ]
                
                import re
                for pattern in patterns_to_try:
                    matches = re.finditer(pattern, content, re.MULTILINE)
                    for match in matches:
                        key = match.group(1).strip()
                        value = match.group(2).strip()
                        
                        if is_valid_key_value_pair(key, value):
                            if page_number not in page_kvp_fallback:
                                page_kvp_fallback[page_number] = []
                            page_kvp_fallback[page_number].append({
                                'key': key,
                                'value': value,
                                'confidence': 0.5  # Default confidence for fallback extraction
                            })
            
            # Convert fallback data
            for page_num in sorted(page_kvp_fallback.keys()):
                key_value_pairs = page_kvp_fallback[page_num]
                headers = [pair['key'] for pair in key_value_pairs]
                values = [pair['value'] for pair in key_value_pairs]
                
                pages_data.append({
                    'page_number': page_num - 1,
                    'headers': headers,
                    'data': [values] if values else [],
                    'key_value_pairs': key_value_pairs
                })
        
        # If still no key-value pairs found, create empty page data
        if not pages_data:
            pages_data.append({
                'page_number': 0,
                'headers': [],
                'data': [],
                'key_value_pairs': []
            })
        
        return pages_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract key-value pairs: {str(e)}")


def cleanup_operation(operation_id: str):
    """Clean up operation data"""
    if operation_id in azure_di_jobs:
        del azure_di_jobs[operation_id]


# In-memory job storage (in production, use Redis or database)
azure_di_jobs = {}