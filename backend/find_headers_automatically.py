#!/usr/bin/env python3
"""
Automatically find header rows in bank statements
"""

import pdfplumber
import re
from pathlib import Path

def is_likely_header_row(text_line):
    """Check if a text line looks like a header row"""
    text_lower = text_line.lower()
    
    # Common header keywords
    header_indicators = [
        'date', 'description', 'amount', 'balance', 'credit', 'debit',
        'withdrawal', 'deposit', 'reference', 'particulars', 'narration',
        'transaction', 'value', 'posting', 'cheque', 'chq'
    ]
    
    # Count header keywords
    keyword_count = sum(1 for keyword in header_indicators if keyword in text_lower)
    
    # Additional criteria
    has_multiple_words = len(text_line.split()) >= 3
    not_too_long = len(text_line) < 200
    has_alpha = any(c.isalpha() for c in text_line)
    
    return keyword_count >= 2 and has_multiple_words and not_too_long and has_alpha

def analyze_pdf_for_headers(pdf_path, max_pages=3):
    """Analyze PDF to find potential header rows"""
    potential_headers = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num in range(min(max_pages, len(pdf.pages))):
            page = pdf.pages[page_num]
            
            # Extract text lines
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.split('\n')
            
            for line_num, line in enumerate(lines):
                if is_likely_header_row(line.strip()):
                    # Try to find the Y coordinate of this line
                    words = page.extract_words()
                    
                    # Find words that match this line
                    line_words = []
                    line_text_parts = line.strip().split()
                    
                    for word in words:
                        if any(part.lower() in word['text'].lower() for part in line_text_parts[:3]):
                            line_words.append(word)
                    
                    if line_words:
                        # Calculate bounding box
                        min_x = min(w['x0'] for w in line_words)
                        max_x = max(w['x1'] for w in line_words)
                        min_y = min(w['top'] for w in line_words)
                        max_y = max(w['bottom'] for w in line_words)
                        
                        potential_headers.append({
                            'page': page_num,
                            'text': line.strip(),
                            'x': min_x,
                            'y': min_y,
                            'width': max_x - min_x,
                            'height': max_y - min_y,
                            'confidence': len([w for w in line_text_parts if any(h in w.lower() for h in ['date', 'amount', 'balance', 'description'])])
                        })
    
    # Sort by confidence
    potential_headers.sort(key=lambda x: x['confidence'], reverse=True)
    return potential_headers

def main():
    """Find headers in all bank PDFs"""
    print("🔍 **FINDING HEADERS IN BANK STATEMENTS**")
    print("=" * 80)
    
    statements_dir = Path("../sample-statements")
    results = {}
    
    for pdf_file in sorted(statements_dir.glob("*.pdf"))[:10]:  # Test first 10
        bank_name = pdf_file.stem
        print(f"\n🏦 **Analyzing {bank_name}**")
        print("-" * 60)
        
        try:
            headers = analyze_pdf_for_headers(str(pdf_file))
            
            if headers:
                best_header = headers[0]
                print(f"   ✅ Found potential header:")
                print(f"      Text: '{best_header['text']}'")
                print(f"      Page: {best_header['page']}")
                print(f"      Coordinates: x={best_header['x']:.1f}, y={best_header['y']:.1f}")
                print(f"      Size: {best_header['width']:.1f}x{best_header['height']:.1f}")
                print(f"      Confidence: {best_header['confidence']}")
                
                results[pdf_file.name] = (
                    best_header['page'], 
                    best_header['x'], 
                    best_header['y'], 
                    best_header['width'], 
                    best_header['height']
                )
            else:
                print(f"   ❌ No clear headers found")
                results[pdf_file.name] = None
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
            results[pdf_file.name] = None
    
    # Generate coordinates dictionary
    print(f"\n📋 **GENERATED COORDINATES**")
    print("=" * 80)
    print("coordinates = {")
    for pdf_name, coords in results.items():
        if coords:
            page, x, y, width, height = coords
            print(f"    '{pdf_name}': ({page}, {x:.1f}, {y:.1f}, {width:.1f}, {height:.1f}),")
        else:
            print(f"    # '{pdf_name}': None,  # No header found")
    print("}")

if __name__ == "__main__":
    main()