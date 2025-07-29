"""
Intelligent Column Detection Module
Implements advanced column separation within user-selected rectangles using:
- Word positioning and clustering algorithms
- Smart gap detection based on word spacing
- Header keyword validation
- Dynamic column boundary detection
"""

import re
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from sklearn.cluster import DBSCAN
import json
from pathlib import Path


@dataclass
class ColumnBoundary:
    """Represents a detected column boundary"""
    x_start: float
    x_end: float
    column_index: int
    confidence: float
    words_in_column: List[Dict[str, Any]]
    header_keyword: Optional[str] = None


@dataclass
class ColumnDetectionResult:
    """Result of column detection process"""
    success: bool
    columns: List[ColumnBoundary]
    total_columns: int
    confidence_score: float
    method_used: str
    errors: List[str]


class HeaderKeywordDatabase:
    """Database of common bank statement header keywords"""
    
    def __init__(self):
        self.keyword_database = {
            'date': {
                'keywords': ['date', 'txn date', 'value date', 'transaction date', 'dated', 'dt'],
                'patterns': [r'\bdate\b', r'\btxn\s*date\b', r'\bvalue\s*date\b'],
                'priority': 1
            },
            'description': {
                'keywords': ['description', 'particulars', 'narration', 'details', 'transaction details', 'desc'],
                'patterns': [r'\bdescription\b', r'\bparticulars\b', r'\bnarration\b', r'\bdetails\b'],
                'priority': 2
            },
            'amount': {
                'keywords': ['amount', 'transaction amount', 'txn amount', 'amt'],
                'patterns': [r'\bamount\b', r'\btxn\s*amount\b', r'\bamt\b'],
                'priority': 3
            },
            'debit': {
                'keywords': ['debit', 'debit amount', 'withdrawals', 'withdrawal', 'dr'],
                'patterns': [r'\bdebit\b', r'\bwithdrawal\b', r'\bdr\b'],
                'priority': 4
            },
            'credit': {
                'keywords': ['credit', 'credit amount', 'deposits', 'deposit', 'cr'],
                'patterns': [r'\bcredit\b', r'\bdeposit\b', r'\bcr\b'],
                'priority': 5
            },
            'balance': {
                'keywords': ['balance', 'running balance', 'account balance', 'bal'],
                'patterns': [r'\bbalance\b', r'\bbal\b'],
                'priority': 6
            },
            'reference': {
                'keywords': ['ref no', 'reference', 'ref', 'cheque no', 'check no', 'instrument'],
                'patterns': [r'\bref\b', r'\breference\b', r'\bcheque\s*no\b', r'\binstrument\b'],
                'priority': 7
            }
        }
    
    def identify_header_type(self, text: str) -> Tuple[Optional[str], float]:
        """Identify the type of header based on text content"""
        text_lower = text.lower().strip()
        
        best_match = None
        best_score = 0.0
        
        for header_type, data in self.keyword_database.items():
            score = 0.0
            
            # Check exact keyword matches
            for keyword in data['keywords']:
                if keyword in text_lower:
                    score += 1.0
            
            # Check pattern matches
            for pattern in data['patterns']:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    score += 0.8
            
            # Normalize by number of checks
            if score > 0:
                normalized_score = score / (len(data['keywords']) + len(data['patterns']))
                if normalized_score > best_score:
                    best_score = normalized_score
                    best_match = header_type
        
        return best_match, best_score
    
    def save_custom_keyword(self, header_type: str, custom_text: str):
        """Save a custom header keyword for future recognition"""
        if header_type not in self.keyword_database:
            self.keyword_database[header_type] = {
                'keywords': [],
                'patterns': [],
                'priority': len(self.keyword_database) + 1
            }
        
        # Add to keywords if not already present
        custom_lower = custom_text.lower().strip()
        if custom_lower not in self.keyword_database[header_type]['keywords']:
            self.keyword_database[header_type]['keywords'].append(custom_lower)


class IntelligentColumnDetector:
    """Advanced column detection using word positioning and clustering"""
    
    def __init__(self):
        self.keyword_db = HeaderKeywordDatabase()
        self.min_column_width = 20.0  # Minimum width for a valid column
        self.max_columns = 10  # Maximum reasonable columns for bank statements
    
    def detect_columns_in_rectangle(self, 
                                  words: List[Dict[str, Any]], 
                                  rect_bounds: Dict[str, float],
                                  is_header: bool = False) -> ColumnDetectionResult:
        """
        Implements the exact user-specified 7-step process:
        1. User selects header row (rectangle)
        2. Extract words within selected box, sort by x0
        3. Treat each word as column label
        4. Derive column X-ranges (boundaries)
        5. Group all words into data rows 
        6. Assign words to columns based on X position
        7. Handle multiline descriptions and return structured data
        """
        
        if not words:
            return ColumnDetectionResult(
                success=False,
                columns=[],
                total_columns=0,
                confidence_score=0.0,
                method_used="no_words",
                errors=["No words found in the selected rectangle"]
            )
        
        try:
            # Step 1 & 2: Extract words within selected box and sort by x0 
            rect_words = self._extract_words_in_rectangle_exact(words, rect_bounds)
            
            if not rect_words:
                return ColumnDetectionResult(
                    success=False,
                    columns=[],
                    total_columns=0,
                    confidence_score=0.0,
                    method_used="no_words_in_rect",
                    errors=["No words found within the specified rectangle bounds"]
                )
            
            # Step 3: Treat each word as a column label (for headers)
            if is_header:
                column_boundaries = self._create_word_based_columns(rect_words, rect_bounds)
            else:
                # For data rows, use the existing clustering approach
                word_clusters = self._cluster_words_by_position(rect_words)
                refined_clusters = self._merge_and_refine_clusters(word_clusters, rect_bounds)
                column_boundaries = self._create_column_boundaries(refined_clusters, rect_bounds)
            
            # Calculate confidence
            confidence = self._calculate_confidence(column_boundaries, is_header)
            
            return ColumnDetectionResult(
                success=len(column_boundaries) > 0,
                columns=column_boundaries,
                total_columns=len(column_boundaries),
                confidence_score=confidence,
                method_used="user_specified_process",
                errors=[]
            )
            
        except Exception as e:
            return ColumnDetectionResult(
                success=False,
                columns=[],
                total_columns=0,
                confidence_score=0.0,
                method_used="error",
                errors=[f"Error during column detection: {str(e)}"]
            )
    
    def _extract_words_in_rectangle(self, 
                                  words: List[Dict[str, Any]], 
                                  rect_bounds: Dict[str, float]) -> List[Dict[str, Any]]:
        """Step 1: Extract words that fall within the rectangle bounds"""
        rect_words = []
        
        x_min = rect_bounds.get('x', 0)
        y_min = rect_bounds.get('y', 0)
        x_max = x_min + rect_bounds.get('width', 0)
        y_max = y_min + rect_bounds.get('height', 0)
        
        for word in words:
            word_x_center = (word['x0'] + word['x1']) / 2
            word_y_center = (word['top'] + word['bottom']) / 2
            
            # Check if word center is within rectangle
            if (x_min <= word_x_center <= x_max and 
                y_min <= word_y_center <= y_max):
                rect_words.append(word)
        
        # Sort by X position for consistent ordering
        return sorted(rect_words, key=lambda w: w['x0'])
    
    def _extract_words_in_rectangle_exact(self, 
                                        words: List[Dict[str, Any]], 
                                        rect_bounds: Dict[str, float]) -> List[Dict[str, Any]]:
        """Step 2: Extract words within selected box and sort by x0 (exact process)"""
        rect_words = []
        
        x_min = rect_bounds.get('x', 0)
        y_min = rect_bounds.get('y', 0)
        x_max = x_min + rect_bounds.get('width', 0)
        y_max = y_min + rect_bounds.get('height', 0)
        
        # Use tighter Y bounds for header detection to avoid mixing transaction data
        is_header = rect_bounds.get('is_header', False)
        if is_header:
            # For headers, use stricter Y coordinate matching
            # Only include words whose vertical center falls within the rectangle
            for word in words:
                word_y_center = (word['top'] + word['bottom']) / 2
                word_x_center = (word['x0'] + word['x1']) / 2
                
                # Check if word center is within rectangle bounds
                if (x_min <= word_x_center <= x_max and 
                    y_min <= word_y_center <= y_max):
                    rect_words.append(word)
        else:
            # For data rows, use overlap detection
            for word in words:
                word_left = word['x0']
                word_right = word['x1']
                word_top = word['top']
                word_bottom = word['bottom']
                
                # Check for overlap
                if (word_left < x_max and word_right > x_min and 
                    word_top < y_max and word_bottom > y_min):
                    rect_words.append(word)
        
        # Sort by x0 position as specified
        return sorted(rect_words, key=lambda w: w['x0'])
    
    def _create_word_based_columns(self, 
                                 rect_words: List[Dict[str, Any]], 
                                 rect_bounds: Dict[str, float]) -> List[ColumnBoundary]:
        """Step 3 & 4: Group words into columns using dynamic spacing threshold"""
        column_boundaries = []
        
        if not rect_words:
            return column_boundaries
        
        # Filter to only actual header words (not transaction data mixed in)
        header_words = self._filter_to_header_words_only(rect_words)
        
        # Debug: Check if important words are being filtered out
        original_texts = [w['text'] for w in rect_words]
        filtered_texts = [w['text'] for w in header_words]
        # Note: Small words like "of" and symbols like "£" should be preserved
        
        if not header_words:
            return column_boundaries
        
        # Step 1: Group words into columns using dynamic spacing threshold
        column_groups = self._group_words_by_spacing_threshold(header_words)
        
        # Step 2: Create column boundaries from grouped words
        for i, word_group in enumerate(column_groups):
            if not word_group:
                continue
                
            # Calculate column boundaries from the word group
            min_x = min(word['x0'] for word in word_group)
            max_x = max(word['x1'] for word in word_group)
            
            # Determine column range with padding
            if i == 0:
                # First column: from rectangle start to midpoint with next group
                if len(column_groups) > 1:
                    next_group_start = min(word['x0'] for word in column_groups[i + 1])
                    col_end = (max_x + next_group_start) / 2
                else:
                    col_end = rect_bounds.get('x', 0) + rect_bounds.get('width', 0)
                col_start = rect_bounds.get('x', 0)
            elif i == len(column_groups) - 1:
                # Last column: from midpoint with previous group to rectangle end
                prev_group_end = max(word['x1'] for word in column_groups[i - 1])
                col_start = (prev_group_end + min_x) / 2
                col_end = rect_bounds.get('x', 0) + rect_bounds.get('width', 0)
            else:
                # Middle column: midpoint between adjacent groups
                prev_group_end = max(word['x1'] for word in column_groups[i - 1])
                next_group_start = min(word['x0'] for word in column_groups[i + 1])
                col_start = (prev_group_end + min_x) / 2
                col_end = (max_x + next_group_start) / 2
            
            # Combine text from all words in the group
            column_text = ' '.join(word['text'] for word in word_group)
            
            boundary = ColumnBoundary(
                x_start=col_start,
                x_end=col_end,
                column_index=i,
                confidence=1.0,
                words_in_column=word_group,
                header_keyword=None
            )
            # Store the combined text for API response
            boundary.combined_text = column_text
            
            column_boundaries.append(boundary)
        
        return column_boundaries
    
    def _group_words_by_spacing_threshold(self, words: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Group words into columns using dynamic spacing threshold with refined logic"""
        if not words:
            return []
        
        # Sort words by X position
        sorted_words = sorted(words, key=lambda w: w['x0'])
        
        # Calculate all gaps first to understand the distribution
        gaps = []
        for i in range(1, len(sorted_words)):
            gap = sorted_words[i]['x0'] - sorted_words[i-1]['x1']
            gaps.append(gap)
        
        if not gaps:
            return [sorted_words]
        
        # Determine thresholds based on gap distribution
        gaps_sorted = sorted(gaps)
        
        # Apply user's instruction: merge words < 20px apart, separate larger gaps
        MERGE_THRESHOLD = 20.0  # User specified: merge if < 20px apart
        
        # For column separation, look for gaps significantly larger than merge threshold
        if len(gaps) >= 3:
            # Find gaps that are much larger than the merge threshold
            large_gaps = [g for g in gaps if g > MERGE_THRESHOLD * 1.5]  # 30px+
            if large_gaps:
                COLUMN_GAP_THRESHOLD = min(large_gaps) * 0.9  # Just below smallest large gap
            else:
                COLUMN_GAP_THRESHOLD = MERGE_THRESHOLD * 1.5  # 30px default
        else:
            COLUMN_GAP_THRESHOLD = MERGE_THRESHOLD * 1.5  # 30px default
        
        column_groups = []
        current_group = [sorted_words[0]]
        
        for i in range(1, len(sorted_words)):
            current_word = sorted_words[i]
            prev_word = sorted_words[i - 1]
            
            # Calculate gap between words
            gap = current_word['x0'] - prev_word['x1']
            
            if gap < MERGE_THRESHOLD:
                # Small gap (< 20px) - merge words into same column per user instruction
                current_group.append(current_word)
            else:
                # Large gap (>= 20px) - start new column
                column_groups.append(current_group)
                current_group = [current_word]
        
        # Don't forget the last group
        if current_group:
            column_groups.append(current_group)
        
        return column_groups
    
    def _is_known_multi_word_header(self, text: str) -> bool:
        """Check if text matches known multi-word header patterns"""
        text_lower = text.lower().strip()
        
        # Common multi-word bank statement headers (exact matches first)
        exact_patterns = [
            'date of transaction', 'date entered', 'date posted', 'value date',
            'transaction date', 'txn date', 'transaction description',
            'transaction amount', 'debit amount', 'credit amount',
            'running balance', 'account balance', 'closing balance',
            'reference number', 'ref no', 'transaction ref', 'cheque no',
            'transaction type', 'payment type', 'mode of payment',
            'amount £', 'amount $', 'amount €', 'amount ₹'
        ]
        
        # Check for exact matches first
        if text_lower in exact_patterns:
            return True
        
        # Check for partial matches with proper context
        partial_patterns = [
            ('date', 'of'),       # "Date of" -> should continue with "transaction"
            ('date', 'transaction'),  # "Date transaction" -> alternative form
            ('amount', '£'),      # "Amount £"
            ('amount', '$'),      # "Amount $"
            ('amount', '€'),      # "Amount €"
            ('running', 'balance'), # "Running balance"
            ('account', 'balance')  # "Account balance"
        ]
        
        words = text_lower.split()
        if len(words) >= 2:
            for word1, word2 in partial_patterns:
                if word1 in words and word2 in words:
                    return True
        
        return False
    
    def _is_complete_header(self, text: str) -> bool:
        """Check if text is already a complete header that shouldn't be extended"""
        text_lower = text.lower().strip()
        
        # Single word headers that are complete
        complete_headers = [
            'date', 'description', 'particulars', 'amount', 'balance',
            'debit', 'credit', 'withdrawal', 'deposit', 'narration',
            'reference', 'ref', 'cheque', 'chq', 'mode', 'type'
        ]
        
        # Check if it's a complete single word header
        if text_lower in complete_headers:
            return True
            
        # Check if it's already a complete multi-word header
        complete_multi_word = [
            'transaction date', 'date entered', 'date posted', 'value date',
            'transaction description', 'debit amount', 'credit amount',
            'running balance', 'account balance', 'closing balance'
        ]
        
        return text_lower in complete_multi_word
    
    def _should_extend_header(self, current_text: str, next_word: str) -> bool:
        """Check if current header should be extended with the next word"""
        current_lower = current_text.lower().strip()
        next_lower = next_word.lower().strip()
        
        # Specific known progression patterns
        progression_patterns = [
            ('date', 'of'),                    # "Date" -> "of"
            ('date of', 'transaction'),        # "Date of" -> "transaction"
            ('amount', '£'),                   # "Amount" -> "£"
            ('amount', '$'),                   # "Amount" -> "$"
            ('running', 'balance'),            # "Running" -> "balance"
            ('account', 'balance'),            # "Account" -> "balance"
            ('transaction', 'date'),           # "Transaction" -> "date"
            ('transaction', 'description'),    # "Transaction" -> "description"
            ('transaction', 'amount'),         # "Transaction" -> "amount"
        ]
        
        # Check if current text + next word matches a known progression
        for pattern_start, pattern_next in progression_patterns:
            if current_lower == pattern_start and next_lower == pattern_next:
                return True
            elif current_lower.endswith(pattern_start) and next_lower == pattern_next:
                return True
                
        return False
    
    def _filter_to_header_words_only(self, words: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter words to only include likely header terms"""
        header_words = []
        
        # Common bank statement header keywords
        header_keywords = [
            'date', 'withdrawal', 'deposit', 'balance', 'alpha', 'chq', 'no', 
            'narration', 'description', 'particulars', 'amount', 'debit', 'credit',
            'reference', 'ref', 'mode', 'type', 'cheque', 'transaction'
        ]
        
        for word in words:
            text_lower = word['text'].lower().strip()
            
            # Check if this word is likely a header
            is_header = False
            
            # Exact match with common headers
            if text_lower in header_keywords:
                is_header = True
            
            # Partial match (contains header keyword)
            elif any(keyword in text_lower for keyword in header_keywords):
                is_header = True
            
            # Single word that's alphabetic and reasonable length
            elif (text_lower.isalpha() and 2 <= len(text_lower) <= 15 and 
                  not self._is_likely_transaction_data(text_lower)):
                is_header = True
            
            # Special case: currency symbols and connecting words
            elif text_lower in ['£', '$', '€', '₹', 'of', 'and', '&']:
                is_header = True
            
            if is_header:
                header_words.append(word)
        
        return header_words
    
    def _filter_header_words_only(self, words: List[Dict[str, Any]], is_header: bool) -> List[Dict[str, Any]]:
        """Filter words to focus on headers only, removing transaction data"""
        if not is_header:
            return words
        
        # For header selection, filter out obvious transaction data
        filtered_words = []
        
        for word in words:
            text = word['text'].lower().strip()
            
            # Skip obvious transaction data patterns
            if self._is_likely_transaction_data(text):
                continue
                
            # Keep words that look like headers
            if self._is_likely_header_word(text):
                filtered_words.append(word)
        
        return filtered_words
    
    def _is_likely_transaction_data(self, text: str) -> bool:
        """Check if text looks like transaction data rather than headers"""
        # Date patterns
        if re.match(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', text):
            return True
        if re.match(r'\d{2,4}[-/]\d{1,2}[-/]\d{1,2}', text):
            return True
        
        # Amount patterns
        if re.match(r'\d+[.,]\d{2}', text):
            return True
        
        # Account numbers or reference numbers
        if re.match(r'\d{6,}', text):
            return True
            
        # Common transaction indicators
        transaction_terms = ['opening', 'closing', 'transfer', 'neft', 'rtgs', 'upi', 
                           'atm', 'pos', 'cheque', 'chq', 'ach', 'ecs']
        if any(term in text for term in transaction_terms):
            return True
            
        return False
    
    def _is_likely_header_word(self, text: str) -> bool:
        """Check if text looks like a header word"""
        # Common header terms
        header_terms = ['date', 'description', 'particulars', 'amount', 'balance', 
                       'debit', 'credit', 'withdrawal', 'deposit', 'narration',
                       'ref', 'reference', 'chq', 'cheque', 'mode', 'type']
        
        if any(term in text for term in header_terms):
            return True
            
        # Single meaningful words (not numbers or codes)
        if len(text) >= 3 and text.isalpha():
            return True
            
        return False
    
    def _cluster_words_by_position(self, words: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Step 2: Precise header column separation using statistical gap analysis"""
        if len(words) <= 1:
            return [words] if words else []
        
        # Sort words by X position
        sorted_words = sorted(words, key=lambda w: w['x0'])
        
        # Calculate gaps between consecutive words
        gaps = []
        for i in range(len(sorted_words) - 1):
            current_word_end = sorted_words[i]['x1']
            next_word_start = sorted_words[i + 1]['x0']
            gap = next_word_start - current_word_end
            gaps.append({
                'gap': gap,
                'index': i,
                'left_word': sorted_words[i]['text'],
                'right_word': sorted_words[i + 1]['text']
            })
        
        if not gaps:
            return [sorted_words]
        
        # Use statistical approach to identify significant column separations
        gap_values = [g['gap'] for g in gaps]
        
        if len(gap_values) >= 3:
            # For multiple gaps, use quartile analysis to find true column breaks
            sorted_gaps = sorted(gap_values)
            q75_idx = int(len(sorted_gaps) * 0.75)
            q50_idx = int(len(sorted_gaps) * 0.5)
            
            q75 = sorted_gaps[q75_idx] if q75_idx < len(sorted_gaps) else sorted_gaps[-1]
            median = sorted_gaps[q50_idx]
            
            # Significant gaps are those in the upper quartile
            threshold = max(q75 * 0.8, median * 1.5, 25.0)
            
        elif len(gap_values) == 2:
            # For two gaps, use the larger one as reference
            max_gap = max(gap_values)
            min_gap = min(gap_values)
            
            # If gaps are very different, use smaller threshold
            if max_gap > min_gap * 2:
                threshold = max(min_gap * 1.2, 20.0)
            else:
                threshold = max((max_gap + min_gap) / 2, 25.0)
                
        else:
            # Single gap case
            threshold = max(gap_values[0] * 0.7, 30.0)
        
        # Create clusters based on significant gaps
        clusters = []
        current_cluster = [sorted_words[0]]
        
        for gap_info in gaps:
            if gap_info['gap'] > threshold:
                # Significant gap - start new column
                clusters.append(current_cluster)
                current_cluster = [sorted_words[gap_info['index'] + 1]]
            else:
                # Small gap - continue current column
                current_cluster.append(sorted_words[gap_info['index'] + 1])
        
        # Add the last cluster
        if current_cluster:
            clusters.append(current_cluster)
        
        return clusters
    
    def _merge_and_refine_clusters(self, 
                                 clusters: List[List[Dict[str, Any]]], 
                                 rect_bounds: Dict[str, float]) -> List[List[Dict[str, Any]]]:
        """Step 3: Merge very small clusters and refine boundaries"""
        if not clusters:
            return []
        
        # Calculate cluster widths
        cluster_info = []
        for cluster in clusters:
            if cluster:
                min_x = min(word['x0'] for word in cluster)
                max_x = max(word['x1'] for word in cluster)
                width = max_x - min_x
                text_length = sum(len(word['text']) for word in cluster)
                
                cluster_info.append({
                    'cluster': cluster,
                    'width': width,
                    'text_length': text_length,
                    'min_x': min_x,
                    'max_x': max_x
                })
        
        # Merge clusters that are too narrow (likely fragments)
        refined_clusters = []
        i = 0
        
        while i < len(cluster_info):
            current = cluster_info[i]
            
            # Check if this cluster is too small and should be merged
            if (current['width'] < self.min_column_width and 
                current['text_length'] < 3 and 
                i + 1 < len(cluster_info)):
                
                # Merge with next cluster
                next_cluster = cluster_info[i + 1]
                merged_words = current['cluster'] + next_cluster['cluster']
                merged_words.sort(key=lambda w: w['x0'])
                refined_clusters.append(merged_words)
                i += 2  # Skip the next cluster since we merged it
            else:
                refined_clusters.append(current['cluster'])
                i += 1
        
        return refined_clusters
    
    def _validate_with_keywords(self, clusters: List[List[Dict[str, Any]]]) -> List[List[Dict[str, Any]]]:
        """Step 4: Validate clusters using header keyword database"""
        validated_clusters = []
        
        for cluster in clusters:
            if not cluster:
                continue
            
            # Combine all text in the cluster
            cluster_text = ' '.join(word['text'] for word in cluster)
            
            # Check if this looks like a valid header
            header_type, confidence = self.keyword_db.identify_header_type(cluster_text)
            
            # Keep cluster if it has some confidence or if we don't have many clusters
            if confidence > 0.3 or len(clusters) <= 3:
                # Add header type information to the cluster
                for word in cluster:
                    word['detected_header_type'] = header_type
                    word['header_confidence'] = confidence
                
                validated_clusters.append(cluster)
        
        # If validation removed too many clusters, fall back to original
        if len(validated_clusters) < len(clusters) * 0.5:
            return clusters
        
        return validated_clusters
    
    def _create_column_boundaries(self, 
                                clusters: List[List[Dict[str, Any]]], 
                                rect_bounds: Dict[str, float]) -> List[ColumnBoundary]:
        """Step 5: Create final column boundary objects"""
        boundaries = []
        
        for i, cluster in enumerate(clusters):
            if not cluster:
                continue
            
            # Calculate column boundaries
            min_x = min(word['x0'] for word in cluster)
            max_x = max(word['x1'] for word in cluster)
            
            # Expand boundaries slightly to avoid word clipping
            padding = 2.0
            x_start = max(rect_bounds.get('x', 0), min_x - padding)
            x_end = min(rect_bounds.get('x', 0) + rect_bounds.get('width', 0), max_x + padding)
            
            # Calculate confidence based on various factors
            text_length = sum(len(word['text']) for word in cluster)
            header_confidence = cluster[0].get('header_confidence', 0.0) if cluster else 0.0
            width_factor = min(1.0, (x_end - x_start) / self.min_column_width)
            
            confidence = (0.4 * width_factor + 
                         0.4 * min(1.0, text_length / 10.0) + 
                         0.2 * header_confidence)
            
            # Get header keyword if detected
            header_keyword = cluster[0].get('detected_header_type') if cluster else None
            
            boundary = ColumnBoundary(
                x_start=x_start,
                x_end=x_end,
                column_index=i,
                confidence=confidence,
                words_in_column=cluster,
                header_keyword=header_keyword
            )
            
            boundaries.append(boundary)
        
        return boundaries
    
    def _calculate_confidence(self, boundaries: List[ColumnBoundary], is_header: bool) -> float:
        """Calculate overall confidence score for the column detection"""
        if not boundaries:
            return 0.0
        
        # Base confidence from individual columns
        avg_column_confidence = sum(b.confidence for b in boundaries) / len(boundaries)
        
        # Bonus for reasonable number of columns
        column_count_factor = 1.0
        if 2 <= len(boundaries) <= 6:  # Optimal range for bank statements
            column_count_factor = 1.2
        elif len(boundaries) > 8:  # Too many columns is suspicious
            column_count_factor = 0.8
        
        # Bonus for header keyword detection
        keyword_factor = 1.0
        if is_header:
            detected_keywords = sum(1 for b in boundaries if b.header_keyword)
            if detected_keywords > 0:
                keyword_factor = 1.0 + (detected_keywords / len(boundaries)) * 0.3
        
        # Bonus for consistent column widths
        if len(boundaries) > 1:
            widths = [b.x_end - b.x_start for b in boundaries]
            width_std = np.std(widths)
            width_mean = np.mean(widths)
            width_cv = width_std / width_mean if width_mean > 0 else 1.0
            consistency_factor = max(0.7, 1.0 - width_cv)
        else:
            consistency_factor = 1.0
        
        final_confidence = min(1.0, avg_column_confidence * column_count_factor * keyword_factor * consistency_factor)
        return final_confidence
    
    def extract_text_from_columns(self, 
                                words: List[Dict[str, Any]], 
                                column_boundaries: List[ColumnBoundary]) -> List[str]:
        """Extract text from each detected column"""
        column_texts = []
        
        for boundary in column_boundaries:
            # Use pre-computed combined text if available (for header detection)
            if hasattr(boundary, 'combined_text'):
                column_texts.append(boundary.combined_text)
            else:
                # Fallback to extracting from all words (for data extraction)
                column_words = []
                
                for word in words:
                    word_center_x = (word['x0'] + word['x1']) / 2
                    if boundary.x_start <= word_center_x <= boundary.x_end:
                        column_words.append(word)
                
                # Sort words by position within column
                column_words.sort(key=lambda w: (w['x0'], w['top']))
                
                # Combine text
                text = ' '.join(word['text'] for word in column_words).strip()
                column_texts.append(text)
        
        return column_texts