"""
Enhanced Extraction Tasks
Integrates the new enhanced table and key-value extractors
"""

import os
import logging
import tempfile
from typing import Dict, Any, List
from datetime import datetime
import concurrent.futures
import traceback

from ..celery_app import celery_app
from ..utils.enhanced_table_extractor import EnhancedTableExtractor
from ..utils.enhanced_kv_extractor import EnhancedKVExtractor
from ..utils.performance_cache import get_cache

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=2)
def enhanced_table_extraction(
    self,
    file_path: str,
    prefer_native: bool = True,
    ocr_fallback: bool = True,
    confidence_threshold: float = 0.5,
    merge_nearby: bool = False,
    use_pp_structure: bool = True,
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Enhanced table extraction using multiple methods
    Handles ugly tables, multi-page tables, and scanned PDFs
    """
    
    def safe_update_state(state, meta):
        """Safe state update wrapper"""
        try:
            self.update_state(state=state, meta=meta)
        except Exception as e:
            logger.warning(f"Failed to update task state: {e}")
    
    try:
        # Initialize
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 10, 'current_step': 'Initializing enhanced extraction...'}
        )
        
        cache = get_cache()
        job_id = self.request.id
        
        # Check cache first
        if use_cache:
            cached_result = cache.get_cached_extraction_result(file_path, "enhanced_table")
            if cached_result:
                logger.info(f"Using cached result for enhanced table extraction")
                return cached_result
        
        # Initialize extractor
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 20, 'current_step': 'Loading enhanced table extractor...'}
        )
        
        extractor = EnhancedTableExtractor()
        
        # Extract tables
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 30, 'current_step': 'Analyzing document structure...'}
        )
        
        extraction_params = {
            'force_enhanced': not prefer_native,
            'use_pp_structure': use_pp_structure and ocr_fallback,
            'confidence_threshold': confidence_threshold,
            'merge_nearby': merge_nearby
        }
        
        extracted_tables = extractor.extract_tables(file_path, **extraction_params)
        
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 70, 'current_step': f'Found {len(extracted_tables)} tables, processing...'}
        )
        
        # Convert to API format
        api_tables = []
        for table in extracted_tables:
            # Create data matrix with headers as first row
            data_matrix = [table.headers] + table.rows if table.headers else table.rows
            
            api_table = {
                'table_id': table.table_id,
                'method': table.method,
                'confidence': table.confidence,
                'page': table.page_start + 1,  # Convert to 1-based
                'rows': len(table.rows),
                'columns': len(table.headers) if table.headers else (len(table.rows[0]) if table.rows else 0),
                'bbox': table.bbox,
                'data': data_matrix,
                'metadata': table.metadata
            }
            
            # Add multi-page info if applicable
            if table.page_end != table.page_start:
                api_table['page_end'] = table.page_end + 1
                api_table['is_multipage'] = True
            
            api_tables.append(api_table)
        
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 90, 'current_step': 'Finalizing results...'}
        )
        
        # Prepare result
        result = {
            'job_id': job_id,
            'status': 'completed',
            'file_name': os.path.basename(file_path),
            'extraction_method': 'enhanced_table_extractor',
            'processing_time_seconds': 0,  # Will be calculated by caller
            'created_at': datetime.utcnow().isoformat(),
            'completed_at': datetime.utcnow().isoformat(),
            'tables': api_tables,
            'total_tables': len(api_tables),
            'extraction_summary': {
                'extraction_methods_used': list(set(t['method'] for t in api_tables)),
                'total_raw_tables': len(extracted_tables),
                'total_processed_tables': len(api_tables),
                'multipage_tables': len([t for t in api_tables if t.get('is_multipage', False)]),
                'errors': [],
                'settings': {
                    'prefer_native': prefer_native,
                    'ocr_fallback': ocr_fallback,
                    'confidence_threshold': confidence_threshold,
                    'merge_nearby': merge_nearby,
                    'use_pp_structure': use_pp_structure
                }
            }
        }
        
        # Cache result
        if use_cache:
            cache.cache_extraction_result(file_path, "enhanced_table", result)
        
        # Update vendor template if vendor detected
        try:
            # Get OCR tokens for vendor detection
            import fitz
            doc = fitz.open(file_path)
            if doc:
                page_tokens = extractor._extract_page_tokens(doc[0], 0)
                doc.close()
                
                # Convert tokens to cache format
                token_dicts = [
                    {
                        'text': t.text,
                        'bbox': t.bbox,
                        'confidence': t.confidence,
                        'page': t.page
                    } for t in page_tokens
                ]
                
                vendor_id = cache.detect_vendor(token_dicts)
                if vendor_id and api_tables:
                    # Extract column bounds from first table
                    first_table = extracted_tables[0]
                    if hasattr(first_table, 'metadata') and 'column_bounds' in first_table.metadata:
                        column_bounds = first_table.metadata['column_bounds']
                        cache.update_vendor_template(vendor_id, column_bounds, {})
        except Exception as e:
            logger.warning(f"Failed to update vendor template: {e}")
        
        safe_update_state(
            state='SUCCESS',
            meta={'progress': 100, 'current_step': 'Completed'}
        )
        
        return result
        
    except Exception as e:
        error_msg = f"Enhanced table extraction failed: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        
        safe_update_state(
            state='FAILURE',
            meta={'error': error_msg, 'progress': 0}
        )
        
        # Clean up temp file
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except:
                pass
        
        raise Exception(error_msg)

@celery_app.task(bind=True, max_retries=2)
def enhanced_kv_extraction(
    self,
    file_path: str,
    use_heuristic: bool = True,
    use_ml_fallback: bool = True,
    min_confidence: float = 0.3,
    key_patterns: str = "",
    custom_keywords: str = "",
    merge_multiline: bool = True,
    use_cache: bool = True
) -> Dict[str, Any]:
    """
    Enhanced key-value extraction with heuristic + ML fallback
    Fast, reliable extraction on varied forms
    """
    
    def safe_update_state(state, meta):
        """Safe state update wrapper"""
        try:
            self.update_state(state=state, meta=meta)
        except Exception as e:
            logger.warning(f"Failed to update task state: {e}")
    
    try:
        # Initialize
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 10, 'current_step': 'Initializing enhanced KV extraction...'}
        )
        
        cache = get_cache()
        job_id = self.request.id
        
        # Check cache first
        if use_cache:
            cached_result = cache.get_cached_extraction_result(file_path, "enhanced_kv")
            if cached_result:
                logger.info(f"Using cached result for enhanced KV extraction")
                return cached_result
        
        # Initialize extractor
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 20, 'current_step': 'Loading enhanced KV extractor...'}
        )
        
        extractor = EnhancedKVExtractor()
        
        # Add custom patterns if provided
        if key_patterns:
            custom_patterns = [p.strip() for p in key_patterns.split(',') if p.strip()]
            extractor.key_patterns.extend(custom_patterns)
        
        if custom_keywords:
            keywords = [k.strip().lower() for k in custom_keywords.split(',') if k.strip()]
            extractor.header_keywords.extend(keywords)
        
        # Extract key-values
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 30, 'current_step': 'Stage 1: Heuristic extraction...'}
        )
        
        extraction_params = {
            'use_ml_fallback': use_ml_fallback,
            'min_confidence': min_confidence,
            'merge_multiline': merge_multiline
        }
        
        extracted_kvs = extractor.extract_key_values(file_path, **extraction_params)
        
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 70, 'current_step': f'Found {len(extracted_kvs)} key-value pairs, processing...'}
        )
        
        # Convert to API format
        api_kvs = []
        for kv in extracted_kvs:
            api_kv = {
                'key': kv.key,
                'value': kv.value,
                'confidence': kv.confidence,
                'bbox': kv.bbox,
                'key_bbox': kv.key_bbox,
                'value_bbox': kv.value_bbox,
                'page': kv.page + 1,  # Convert to 1-based
                'extraction_method': kv.extraction_method,
                'normalized_key': kv.normalized_key,
                'normalized_value': kv.normalized_value
            }
            api_kvs.append(api_kv)
        
        # Group by normalized keys for better organization
        grouped_kvs = {}
        for kv in api_kvs:
            norm_key = kv['normalized_key'] or kv['key'].lower()
            if norm_key not in grouped_kvs:
                grouped_kvs[norm_key] = []
            grouped_kvs[norm_key].append(kv)
        
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 90, 'current_step': 'Finalizing results...'}
        )
        
        # Calculate method statistics
        heuristic_count = sum(1 for kv in api_kvs if kv['extraction_method'] == 'heuristic')
        ml_count = sum(1 for kv in api_kvs if kv['extraction_method'] == 'ml_fallback')
        
        # Prepare result
        result = {
            'job_id': job_id,
            'status': 'completed',
            'file_name': os.path.basename(file_path),
            'extraction_method': 'enhanced_kv_extractor',
            'processing_time_seconds': 0,  # Will be calculated by caller
            'created_at': datetime.utcnow().isoformat(),
            'completed_at': datetime.utcnow().isoformat(),
            'key_values': api_kvs,
            'grouped_key_values': grouped_kvs,
            'total_pairs': len(api_kvs),
            'extraction_summary': {
                'heuristic_extractions': heuristic_count,
                'ml_fallback_extractions': ml_count,
                'unique_keys': len(grouped_kvs),
                'average_confidence': sum(kv['confidence'] for kv in api_kvs) / len(api_kvs) if api_kvs else 0,
                'high_confidence_pairs': len([kv for kv in api_kvs if kv['confidence'] > 0.7]),
                'errors': [],
                'settings': {
                    'use_heuristic': use_heuristic,
                    'use_ml_fallback': use_ml_fallback,
                    'min_confidence': min_confidence,
                    'merge_multiline': merge_multiline,
                    'custom_patterns': key_patterns.split(',') if key_patterns else [],
                    'custom_keywords': custom_keywords.split(',') if custom_keywords else []
                }
            }
        }
        
        # Cache result
        if use_cache:
            cache.cache_extraction_result(file_path, "enhanced_kv", result)
        
        # Update vendor template with key anchors
        try:
            # Get OCR tokens for vendor detection
            import fitz
            doc = fitz.open(file_path)
            if doc:
                page_tokens = extractor._extract_page_tokens(doc[0], 0)
                doc.close()
                
                # Convert tokens to cache format
                token_dicts = [
                    {
                        'text': t.text,
                        'bbox': t.bbox,
                        'confidence': t.confidence,
                        'page': t.page
                    } for t in page_tokens
                ]
                
                vendor_id = cache.detect_vendor(token_dicts)
                if vendor_id and api_kvs:
                    # Extract key anchors
                    key_anchors = {}
                    for kv in api_kvs:
                        if kv['confidence'] > 0.7:  # Only high-confidence keys
                            key_anchors[kv['normalized_key']] = kv['key_bbox']
                    
                    cache.update_vendor_template(vendor_id, [], key_anchors)
        except Exception as e:
            logger.warning(f"Failed to update vendor template: {e}")
        
        safe_update_state(
            state='SUCCESS',
            meta={'progress': 100, 'current_step': 'Completed'}
        )
        
        return result
        
    except Exception as e:
        error_msg = f"Enhanced KV extraction failed: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        
        safe_update_state(
            state='FAILURE',
            meta={'error': error_msg, 'progress': 0}
        )
        
        # Clean up temp file
        if os.path.exists(file_path):
            try:
                os.unlink(file_path)
            except:
                pass
        
        raise Exception(error_msg)

@celery_app.task(bind=True)
def parallel_extraction(
    self,
    file_path: str,
    extract_tables: bool = True,
    extract_kv: bool = True,
    table_params: Dict[str, Any] = None,
    kv_params: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Run table and KV extraction in parallel for maximum performance
    """
    
    def safe_update_state(state, meta):
        """Safe state update wrapper"""
        try:
            self.update_state(state=state, meta=meta)
        except Exception as e:
            logger.warning(f"Failed to update task state: {e}")
    
    try:
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 10, 'current_step': 'Starting parallel extraction...'}
        )
        
        job_id = self.request.id
        results = {
            'job_id': job_id,
            'status': 'completed',
            'file_name': os.path.basename(file_path),
            'extraction_method': 'parallel_enhanced',
            'created_at': datetime.utcnow().isoformat(),
        }
        
        # Prepare parameters
        table_params = table_params or {}
        kv_params = kv_params or {}
        
        futures = []
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            # Submit table extraction
            if extract_tables:
                safe_update_state(
                    state='PROGRESS',
                    meta={'progress': 20, 'current_step': 'Starting table extraction...'}
                )
                
                table_future = executor.submit(
                    enhanced_table_extraction.apply_async,
                    args=[file_path],
                    kwargs=table_params
                )
                futures.append(('tables', table_future))
            
            # Submit KV extraction
            if extract_kv:
                safe_update_state(
                    state='PROGRESS',
                    meta={'progress': 30, 'current_step': 'Starting KV extraction...'}
                )
                
                kv_future = executor.submit(
                    enhanced_kv_extraction.apply_async,
                    args=[file_path],
                    kwargs=kv_params
                )
                futures.append(('kv', kv_future))
            
            # Wait for results
            safe_update_state(
                state='PROGRESS',
                meta={'progress': 50, 'current_step': 'Processing in parallel...'}
            )
            
            for extraction_type, future in futures:
                try:
                    # Get the AsyncResult
                    async_result = future.result()
                    
                    # Wait for completion
                    result = async_result.get(timeout=300)  # 5 minute timeout
                    
                    if extraction_type == 'tables':
                        results['tables'] = result.get('tables', [])
                        results['total_tables'] = result.get('total_tables', 0)
                        results['table_extraction_summary'] = result.get('extraction_summary', {})
                    elif extraction_type == 'kv':
                        results['key_values'] = result.get('key_values', [])
                        results['grouped_key_values'] = result.get('grouped_key_values', {})
                        results['total_pairs'] = result.get('total_pairs', 0)
                        results['kv_extraction_summary'] = result.get('extraction_summary', {})
                
                except Exception as e:
                    logger.error(f"Error in {extraction_type} extraction: {e}")
                    results[f'{extraction_type}_error'] = str(e)
        
        safe_update_state(
            state='PROGRESS',
            meta={'progress': 90, 'current_step': 'Finalizing parallel results...'}
        )
        
        results['completed_at'] = datetime.utcnow().isoformat()
        results['parallel_processing'] = True
        
        safe_update_state(
            state='SUCCESS',
            meta={'progress': 100, 'current_step': 'Parallel extraction completed'}
        )
        
        return results
        
    except Exception as e:
        error_msg = f"Parallel extraction failed: {str(e)}"
        logger.error(f"{error_msg}\n{traceback.format_exc()}")
        
        safe_update_state(
            state='FAILURE',
            meta={'error': error_msg, 'progress': 0}
        )
        
        raise Exception(error_msg)