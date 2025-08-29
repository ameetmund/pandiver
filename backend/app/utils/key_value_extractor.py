import os
import re
import logging
from typing import List, Dict, Any, Optional, Callable, Tuple
import uuid

logger = logging.getLogger(__name__)


class KeyValueExtractor:
    """
    Key-value extraction using heuristic analysis and OCR.
    
    Uses pattern matching and PaddleOCR for extracting key-value pairs from forms and documents.
    """
    
    def __init__(
        self,
        use_heuristic: bool = True,
        use_paddleocr: bool = False,
        min_confidence: float = 0.3,
        key_patterns: List[str] = None,
        custom_keywords: List[str] = None,
        merge_multiline: bool = True
    ):
        """
        Initialize key-value extractor.
        
        Args:
            use_heuristic: Use heuristic pattern-based extraction
            use_paddleocr: Use PaddleOCR KIE for extraction
            min_confidence: Minimum confidence for extraction
            key_patterns: List of key patterns to look for
            custom_keywords: Additional custom keywords
            merge_multiline: Merge text across multiple lines
        """
        self.use_heuristic = use_heuristic
        self.use_paddleocr = use_paddleocr
        self.min_confidence = min_confidence
        self.key_patterns = key_patterns or ['Name', 'Date', 'Amount', 'Address', 'Phone', 'Email', 'Total']
        self.custom_keywords = custom_keywords or []
        self.merge_multiline = merge_multiline
        
        # Combine all keywords
        self.all_keywords = self.key_patterns + self.custom_keywords
        
        # Check if dependencies are available
        self._check_dependencies()
        
        # Initialize extraction patterns
        self._init_patterns()
    
    def _check_dependencies(self):
        """Check if required dependencies are installed."""
        try:
            import paddleocr
            self.paddleocr_available = True
        except ImportError:
            self.paddleocr_available = False
            logger.warning("PaddleOCR not available. Install with: pip install paddleocr")
        
        try:
            import pdfplumber
            self.pdfplumber_available = True
        except ImportError:
            self.pdfplumber_available = False
            logger.warning("pdfplumber not available. Install with: pip install pdfplumber")
    
    def _init_patterns(self):
        """Initialize extraction patterns."""
        # Common key-value patterns
        self.kv_patterns = [
            # Pattern: "Key: Value"
            (r'([A-Za-z\s]+):\s*([^\n\r]+)', 'colon_separated'),
            # Pattern: "Key Value" (when key is in our keywords)
            (r'\b({})[\s:]+(.*?)(?=\n|\r|$|\b(?:{})\b)'.format(
                '|'.join(re.escape(k) for k in self.all_keywords),
                '|'.join(re.escape(k) for k in self.all_keywords)
            ), 'keyword_based'),
            # Pattern: Form fields with lines "Key ______ Value"
            (r'([A-Za-z\s]+)(?:_+|\.+)\s*([^\n\r]+)', 'form_line'),
            # Pattern: "Key = Value"
            (r'([A-Za-z\s]+)=\s*([^\n\r]+)', 'equals_separated'),
        ]
        
        # Date patterns
        self.date_patterns = [
            r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
            r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}',
            r'\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}',
        ]
        
        # Amount/currency patterns
        self.amount_patterns = [
            r'[\$₹€£¥]\s*\d+(?:,\d{3})*(?:\.\d{2})?',
            r'\d+(?:,\d{3})*(?:\.\d{2})?\s*[\$₹€£¥]',
            r'\d+(?:,\d{3})*(?:\.\d{2})?',
        ]
        
        # Phone patterns
        self.phone_patterns = [
            r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        ]
        
        # Email patterns
        self.email_patterns = [
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        ]
    
    def extract_key_values(
        self, 
        pdf_path: str,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Extract key-value pairs from PDF.
        
        Args:
            pdf_path: Path to PDF file
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dict containing extracted key-value pairs and metadata
        """
        if progress_callback:
            progress_callback(0, "Starting key-value extraction")
        
        key_values = []
        extraction_methods_used = []
        errors = []
        
        # Step 1: Heuristic extraction
        if self.use_heuristic:
            try:
                if progress_callback:
                    progress_callback(20, "Extracting text with heuristic analysis")
                
                heuristic_kvs = self._extract_with_heuristic(pdf_path)
                if heuristic_kvs:
                    key_values.extend(heuristic_kvs)
                    extraction_methods_used.append("heuristic")
                    
                    if progress_callback:
                        progress_callback(60, f"Found {len(heuristic_kvs)} key-value pairs with heuristic analysis")
                
            except Exception as e:
                error_msg = f"Heuristic extraction failed: {str(e)}"
                errors.append(error_msg)
                logger.warning(error_msg)
        
        # Step 2: PaddleOCR extraction
        if self.use_paddleocr and self.paddleocr_available:
            try:
                if progress_callback:
                    progress_callback(70, "Using PaddleOCR for key-value extraction")
                
                ocr_kvs = self._extract_with_paddleocr(pdf_path)
                if ocr_kvs:
                    # Merge with existing results (avoid duplicates)
                    merged_kvs = self._merge_key_values(key_values, ocr_kvs)
                    key_values = merged_kvs
                    extraction_methods_used.append("paddleocr")
                    
                    if progress_callback:
                        progress_callback(90, f"Total {len(key_values)} key-value pairs after OCR")
                
            except Exception as e:
                error_msg = f"PaddleOCR extraction failed: {str(e)}"
                errors.append(error_msg)
                logger.warning(error_msg)
        
        # Step 3: Post-process key-value pairs
        if progress_callback:
            progress_callback(95, "Post-processing key-value pairs")
        
        processed_kvs = self._post_process_key_values(key_values)
        
        if progress_callback:
            progress_callback(100, f"Extraction complete: {len(processed_kvs)} key-value pairs found")
        
        # Prepare result
        result = {
            'key_values': processed_kvs,
            'total_pairs': len(processed_kvs),
            'summary': {
                'extraction_methods_used': extraction_methods_used,
                'total_raw_pairs': len(key_values),
                'total_processed_pairs': len(processed_kvs),
                'errors': errors,
                'settings': {
                    'use_heuristic': self.use_heuristic,
                    'use_paddleocr': self.use_paddleocr,
                    'min_confidence': self.min_confidence,
                    'key_patterns': self.key_patterns,
                    'custom_keywords': self.custom_keywords,
                    'merge_multiline': self.merge_multiline
                }
            }
        }
        
        return result
    
    def _extract_with_heuristic(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract key-value pairs using heuristic pattern matching."""
        if not self.pdfplumber_available:
            raise ImportError("pdfplumber not available")
        
        import pdfplumber
        
        key_values = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    # Extract text
                    text = page.extract_text()
                    if not text:
                        continue
                    
                    # Try different extraction patterns
                    for pattern, method in self.kv_patterns:
                        matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)
                        
                        for match in matches:
                            key_text = match.group(1).strip()
                            value_text = match.group(2).strip() if len(match.groups()) > 1 else ""
                            
                            # Validate key-value pair
                            if self._is_valid_key_value_pair(key_text, value_text):
                                # Determine extraction type and confidence
                                extraction_type, confidence = self._classify_key_value_pair(key_text, value_text)
                                
                                if confidence >= self.min_confidence:
                                    kv_pair = {
                                        'key_text': key_text,
                                        'value_text': value_text,
                                        'key_bbox': [0, 0, 0, 0],  # Approximate - would need word-level extraction
                                        'value_bbox': [0, 0, 0, 0],
                                        'confidence': confidence,
                                        'page': page_num,
                                        'extraction_method': 'heuristic',
                                        'pattern_method': method,
                                        'value_type': extraction_type
                                    }
                                    key_values.append(kv_pair)
            
        except Exception as e:
            logger.error(f"Heuristic extraction error: {str(e)}")
            raise
        
        return key_values
    
    def _extract_with_paddleocr(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract key-value pairs using PaddleOCR."""
        try:
            from paddleocr import PaddleOCR
            import cv2
            import numpy as np
            from pdf2image import convert_from_path
        except ImportError as e:
            raise ImportError(f"Required dependencies not available: {str(e)}")
        
        key_values = []
        
        try:
            # Initialize PaddleOCR
            ocr = PaddleOCR(use_angle_cls=True, lang='en')
            
            # Convert PDF to images
            pages = convert_from_path(pdf_path, dpi=200)
            
            for page_num, page_image in enumerate(pages, 1):
                # Convert PIL image to numpy array
                img_array = np.array(page_image)
                
                # Use PaddleOCR to detect text
                result = ocr.ocr(img_array)
                
                if result and result[0]:
                    # Extract key-value pairs from OCR results
                    page_kvs = self._extract_kv_from_ocr_result(result[0], page_num, page_image.size)
                    key_values.extend(page_kvs)
        
        except Exception as e:
            logger.error(f"PaddleOCR extraction error: {str(e)}")
            raise
        
        return key_values
    
    def _extract_kv_from_ocr_result(self, ocr_result: List, page_num: int, page_size: Tuple[int, int]) -> List[Dict[str, Any]]:
        """Extract key-value pairs from OCR results."""
        key_values = []
        
        try:
            # Extract text blocks with positions
            text_blocks = []
            for line in ocr_result:
                if len(line) >= 2:
                    bbox, (text, confidence) = line
                    if confidence >= self.min_confidence:
                        text_blocks.append({
                            'text': text.strip(),
                            'bbox': bbox,
                            'confidence': confidence,
                            'x_center': (bbox[0][0] + bbox[2][0]) / 2,
                            'y_center': (bbox[0][1] + bbox[2][1]) / 2
                        })
            
            # Sort blocks by position (top to bottom, left to right)
            text_blocks.sort(key=lambda x: (x['y_center'], x['x_center']))
            
            # Find key-value pairs using spatial analysis
            for i, block in enumerate(text_blocks):
                text = block['text']
                
                # Check if this text could be a key
                if self._could_be_key(text):
                    # Look for nearby value candidates
                    value_candidates = self._find_value_candidates(block, text_blocks[i+1:], page_size)
                    
                    for value_candidate in value_candidates:
                        # Validate and create key-value pair
                        if self._is_valid_key_value_pair(text, value_candidate['text']):
                            extraction_type, pair_confidence = self._classify_key_value_pair(text, value_candidate['text'])
                            
                            # Combine OCR confidence with pair confidence
                            final_confidence = (block['confidence'] + value_candidate['confidence']) / 2 * pair_confidence
                            
                            if final_confidence >= self.min_confidence:
                                kv_pair = {
                                    'key_text': text,
                                    'value_text': value_candidate['text'],
                                    'key_bbox': self._normalize_bbox(block['bbox'], page_size),
                                    'value_bbox': self._normalize_bbox(value_candidate['bbox'], page_size),
                                    'confidence': final_confidence,
                                    'page': page_num,
                                    'extraction_method': 'paddleocr',
                                    'value_type': extraction_type
                                }
                                key_values.append(kv_pair)
                                break  # Use only the best value candidate
        
        except Exception as e:
            logger.warning(f"Error extracting KV from OCR result: {str(e)}")
        
        return key_values
    
    def _could_be_key(self, text: str) -> bool:
        """Check if text could be a key."""
        # Check against known keywords
        for keyword in self.all_keywords:
            if keyword.lower() in text.lower():
                return True
        
        # Check for key-like patterns
        key_patterns = [
            r'^[A-Za-z\s]+:$',  # Ends with colon
            r'^[A-Za-z\s]+\??$',  # Question format
            r'^\w+\s*\w*$',  # Simple word or two words
        ]
        
        for pattern in key_patterns:
            if re.match(pattern, text.strip()):
                return True
        
        return False
    
    def _find_value_candidates(self, key_block: Dict, remaining_blocks: List[Dict], page_size: Tuple[int, int]) -> List[Dict]:
        """Find potential value candidates for a key."""
        candidates = []
        
        # Look for blocks that are spatially related to the key
        for block in remaining_blocks[:5]:  # Limit search to next 5 blocks
            # Calculate spatial relationship
            distance = self._calculate_distance(key_block, block)
            
            # Check if block is in reasonable position (to the right or below)
            if (block['x_center'] > key_block['x_center'] or  # To the right
                (abs(block['x_center'] - key_block['x_center']) < 100 and  # Same column
                 block['y_center'] > key_block['y_center'])):  # Below
                
                # Score based on distance and position
                score = 1.0 / (1.0 + distance / 100.0)  # Closer is better
                
                candidate = block.copy()
                candidate['score'] = score
                candidates.append(candidate)
        
        # Sort candidates by score (best first)
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        return candidates[:3]  # Return top 3 candidates
    
    def _calculate_distance(self, block1: Dict, block2: Dict) -> float:
        """Calculate distance between two text blocks."""
        dx = block1['x_center'] - block2['x_center']
        dy = block1['y_center'] - block2['y_center']
        return (dx * dx + dy * dy) ** 0.5
    
    def _normalize_bbox(self, bbox: List, page_size: Tuple[int, int]) -> List[float]:
        """Normalize bounding box coordinates to 0-1 range."""
        width, height = page_size
        return [
            bbox[0][0] / width,
            bbox[0][1] / height,
            bbox[2][0] / width,
            bbox[2][1] / height
        ]
    
    def _is_valid_key_value_pair(self, key: str, value: str) -> bool:
        """Validate if key-value pair is reasonable."""
        # Basic validation
        if not key or not value:
            return False
        
        # Key should not be too long or too short
        if len(key) < 2 or len(key) > 100:
            return False
        
        # Value should not be empty or too long
        if len(value.strip()) == 0 or len(value) > 500:
            return False
        
        # Key should contain at least one letter
        if not re.search(r'[A-Za-z]', key):
            return False
        
        # Key should not be mostly numbers
        if len(re.findall(r'\d', key)) > len(key) * 0.8:
            return False
        
        return True
    
    def _classify_key_value_pair(self, key: str, value: str) -> Tuple[str, float]:
        """Classify the type of key-value pair and assign confidence."""
        key_lower = key.lower()
        value_lower = value.lower()
        
        # Date classification
        if any(date_word in key_lower for date_word in ['date', 'when', 'time', 'day']):
            for pattern in self.date_patterns:
                if re.search(pattern, value):
                    return 'date', 0.9
            return 'date', 0.6
        
        # Amount/money classification
        if any(money_word in key_lower for money_word in ['amount', 'price', 'cost', 'total', 'sum', 'fee', 'charge']):
            for pattern in self.amount_patterns:
                if re.search(pattern, value):
                    return 'amount', 0.9
            return 'amount', 0.6
        
        # Phone classification
        if any(phone_word in key_lower for phone_word in ['phone', 'tel', 'mobile', 'contact']):
            for pattern in self.phone_patterns:
                if re.search(pattern, value):
                    return 'phone', 0.9
            return 'phone', 0.6
        
        # Email classification
        if any(email_word in key_lower for email_word in ['email', 'mail', 'e-mail']):
            for pattern in self.email_patterns:
                if re.search(pattern, value):
                    return 'email', 0.9
            return 'email', 0.6
        
        # Name classification
        if any(name_word in key_lower for name_word in ['name', 'person', 'contact', 'customer']):
            return 'name', 0.8
        
        # Address classification
        if any(addr_word in key_lower for addr_word in ['address', 'location', 'street', 'city']):
            return 'address', 0.8
        
        # Check for exact keyword matches
        for keyword in self.all_keywords:
            if keyword.lower() in key_lower:
                return 'keyword_match', 0.8
        
        # Default classification
        return 'text', 0.5
    
    def _merge_key_values(self, existing_kvs: List[Dict], new_kvs: List[Dict]) -> List[Dict]:
        """Merge key-value lists, avoiding duplicates."""
        merged = existing_kvs.copy()
        
        for new_kv in new_kvs:
            # Check for duplicates
            is_duplicate = False
            for existing_kv in existing_kvs:
                if (self._similar_strings(new_kv['key_text'], existing_kv['key_text']) and
                    self._similar_strings(new_kv['value_text'], existing_kv['value_text'])):
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                merged.append(new_kv)
        
        return merged
    
    def _similar_strings(self, s1: str, s2: str, threshold: float = 0.8) -> bool:
        """Check if two strings are similar."""
        from difflib import SequenceMatcher
        return SequenceMatcher(None, s1.lower(), s2.lower()).ratio() > threshold
    
    def _post_process_key_values(self, key_values: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Post-process extracted key-value pairs."""
        processed_kvs = []
        
        for kv in key_values:
            # Clean up text
            cleaned_kv = kv.copy()
            cleaned_kv['key_text'] = self._clean_text(kv['key_text'])
            cleaned_kv['value_text'] = self._clean_text(kv['value_text'])
            
            # Skip if cleaned text is empty
            if not cleaned_kv['key_text'] or not cleaned_kv['value_text']:
                continue
            
            # Merge multiline values if requested
            if self.merge_multiline:
                cleaned_kv['value_text'] = self._merge_multiline_text(cleaned_kv['value_text'])
            
            processed_kvs.append(cleaned_kv)
        
        # Remove duplicates
        processed_kvs = self._remove_duplicates(processed_kvs)
        
        # Sort by confidence (highest first)
        processed_kvs.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        return processed_kvs
    
    def _clean_text(self, text: str) -> str:
        """Clean text by removing unwanted characters."""
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove common unwanted characters
        text = re.sub(r'[_\-\.]+$', '', text)  # Remove trailing underscores, dashes, dots
        text = re.sub(r'^[:\-\.\s]+', '', text)  # Remove leading colons, dashes, dots, spaces
        
        return text.strip()
    
    def _merge_multiline_text(self, text: str) -> str:
        """Merge multiline text into a single line."""
        # Replace line breaks with spaces
        text = re.sub(r'\r?\n', ' ', text)
        
        # Remove extra spaces
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def _remove_duplicates(self, key_values: List[Dict]) -> List[Dict]:
        """Remove duplicate key-value pairs."""
        seen = set()
        unique_kvs = []
        
        for kv in key_values:
            # Create a signature for the key-value pair
            signature = (kv['key_text'].lower(), kv['value_text'].lower())
            
            if signature not in seen:
                seen.add(signature)
                unique_kvs.append(kv)
        
        return unique_kvs