import os
import tempfile
from typing import Dict, Any
from celery import current_task
from .celery_app import celery_app
from .pdf_processor import get_pdf_info, is_digital, extract_all_words, get_all_page_rows, analyze_row_structure

@celery_app.task(bind=True)
def parse_statement(self, file_path: str) -> Dict[str, Any]:
    """
    Background task to parse PDF bank statement.
    
    Args:
        file_path: Path to the uploaded PDF file
        
    Returns:
        Dict containing parsing results and status
    """
    try:
        # Update task status
        current_task.update_state(
            state='PROGRESS',
            meta={'message': 'Starting PDF analysis...', 'progress': 10}
        )
        
        # Analyze PDF structure (digital vs scanned)
        current_task.update_state(
            state='PROGRESS', 
            meta={'message': 'Analyzing document structure...', 'progress': 30}
        )
        
        pdf_info = get_pdf_info(file_path)
        
        current_task.update_state(
            state='PROGRESS',
            meta={'message': f'Found {pdf_info["total_pages"]} pages ({pdf_info["digital_pages"]} digital, {pdf_info["scanned_pages"]} scanned)', 'progress': 50}
        )
        
        # Extract words from all pages
        current_task.update_state(
            state='PROGRESS',
            meta={'message': 'Extracting words from pages...', 'progress': 70}
        )
        
        all_words = extract_all_words(file_path)
        
        current_task.update_state(
            state='PROGRESS',
            meta={'message': f'Extracted {len(all_words)} words. Clustering into rows...', 'progress': 80}
        )
        
        # Cluster words into rows
        all_page_rows = get_all_page_rows(all_words, tolerance=2.0)
        
        # Analyze row structure for debugging
        total_rows = sum(len(rows) for rows in all_page_rows.values())
        
        current_task.update_state(
            state='PROGRESS',
            meta={'message': f'Clustered into {total_rows} rows. Ready for column parsing...', 'progress': 90}
        )
        
        # Generate row analysis for the first page as sample
        first_page_rows = all_page_rows.get(1, [])
        row_analysis = analyze_row_structure(first_page_rows) if first_page_rows else {}
        
        # Result with PDF analysis, word extraction, and row clustering
        result = {
            'status': 'completed',
            'file_path': file_path,
            'pdf_info': pdf_info,
            'words_extracted': len(all_words),
            'total_rows': total_rows,
            'rows_by_page': {str(k): len(v) for k, v in all_page_rows.items()},
            'row_analysis_sample': row_analysis,
            'all_words': all_words,  # Include all extracted words
            'all_page_rows': all_page_rows,  # Include clustered rows
            'transactions_count': 0,  # Will be filled in later tasks
            'message': f'Row clustering completed. Found {len(all_words)} words in {total_rows} rows from {pdf_info["total_pages"]} pages.',
            'progress': 100
        }
        
        return result
        
    except Exception as e:
        # Update task state to FAILURE
        current_task.update_state(
            state='FAILURE',
            meta={'message': f'Error processing PDF: {str(e)}', 'progress': 0}
        )
        raise e 