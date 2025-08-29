"""
OCR utilities with multiple engine support and fallback chain
"""
import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class OCRToken:
    """Represents a single OCR token/word"""
    text: str
    bbox: Tuple[float, float, float, float]  # (xmin, ymin, xmax, ymax)
    confidence: float
    page: int


class OCRRunner:
    """
    Unified OCR engine with multiple backends and fallback support
    """
    
    def __init__(self):
        self.engines = {}
        self._initialize_engines()
    
    def _initialize_engines(self):
        """Initialize available OCR engines"""
        
        # Try to initialize PaddleOCR
        try:
            from paddleocr import PaddleOCR
            self.engines['paddleocr'] = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                use_gpu=False,  # CPU only
                show_log=False
            )
            logger.info("PaddleOCR initialized successfully")
        except Exception as e:
            logger.warning(f"PaddleOCR not available: {e}")
        
        # Try to initialize docTR
        try:
            from doctr.io import DocumentFile
            from doctr.models import ocr_predictor
            
            self.engines['doctr'] = ocr_predictor(
                pretrained=True,
                assume_straight_pages=True
            )
            logger.info("docTR initialized successfully")
        except Exception as e:
            logger.warning(f"docTR not available: {e}")
        
        # Try to initialize Tesseract
        try:
            import pytesseract
            # Test if tesseract is available
            pytesseract.get_tesseract_version()
            self.engines['tesseract'] = pytesseract
            logger.info("Tesseract initialized successfully")
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
        
        if not self.engines:
            raise RuntimeError("No OCR engines available")
    
    def extract_text_paddleocr(self, image_path: str, page_num: int = 1) -> List[OCRToken]:
        """Extract text using PaddleOCR"""
        try:
            paddleocr = self.engines['paddleocr']
            result = paddleocr.ocr(image_path, cls=True)
            
            tokens = []
            if result and result[0]:
                for line in result[0]:
                    if len(line) >= 2:
                        bbox_coords = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                        text_info = line[1]    # (text, confidence)
                        
                        if len(text_info) >= 2 and bbox_coords:
                            text = text_info[0].strip()
                            confidence = float(text_info[1])
                            
                            if text and confidence > 0.1:  # Filter low confidence
                                # Convert quad to bbox
                                bbox = self._quad_to_bbox(bbox_coords)
                                
                                tokens.append(OCRToken(
                                    text=text,
                                    bbox=bbox,
                                    confidence=confidence,
                                    page=page_num
                                ))
            
            logger.info(f"PaddleOCR extracted {len(tokens)} tokens from page {page_num}")
            return tokens
            
        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            return []
    
    def extract_text_doctr(self, image_path: str, page_num: int = 1) -> List[OCRToken]:
        """Extract text using docTR"""
        try:
            from doctr.io import DocumentFile
            
            model = self.engines['doctr']
            doc = DocumentFile.from_images(image_path)
            result = model(doc)
            
            tokens = []
            if result.pages:
                page = result.pages[0]  # First page
                
                for block in page.blocks:
                    for line in block.lines:
                        for word in line.words:
                            if word.value and word.confidence > 0.1:
                                # docTR gives relative coordinates (0-1)
                                bbox = (
                                    word.geometry[0][0],  # xmin
                                    word.geometry[0][1],  # ymin  
                                    word.geometry[1][0],  # xmax
                                    word.geometry[1][1]   # ymax
                                )
                                
                                tokens.append(OCRToken(
                                    text=word.value,
                                    bbox=bbox,
                                    confidence=word.confidence,
                                    page=page_num
                                ))
            
            logger.info(f"docTR extracted {len(tokens)} tokens from page {page_num}")
            return tokens
            
        except Exception as e:
            logger.error(f"docTR extraction failed: {e}")
            return []
    
    def extract_text_tesseract(self, image_path: str, page_num: int = 1) -> List[OCRToken]:
        """Extract text using Tesseract"""
        try:
            import pytesseract
            from PIL import Image
            
            image = Image.open(image_path)
            
            # Get detailed OCR data
            data = pytesseract.image_to_data(
                image, 
                output_type=pytesseract.Output.DICT,
                config='--psm 6'  # Uniform block of text
            )
            
            tokens = []
            width, height = image.size
            
            for i in range(len(data['text'])):
                text = data['text'][i].strip()
                confidence = float(data['conf'][i])
                
                if text and confidence > 30:  # Tesseract confidence is 0-100
                    # Convert to relative coordinates
                    x = data['left'][i] / width
                    y = data['top'][i] / height
                    w = data['width'][i] / width
                    h = data['height'][i] / height
                    
                    bbox = (x, y, x + w, y + h)
                    
                    tokens.append(OCRToken(
                        text=text,
                        bbox=bbox,
                        confidence=confidence / 100.0,  # Normalize to 0-1
                        page=page_num
                    ))
            
            logger.info(f"Tesseract extracted {len(tokens)} tokens from page {page_num}")
            return tokens
            
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return []
    
    def extract_text_with_fallback(self, image_path: str, page_num: int = 1, 
                                  preferred_engine: str = 'paddleocr') -> Tuple[List[OCRToken], str]:
        """
        Extract text with fallback chain: PaddleOCR -> docTR -> Tesseract
        
        Returns:
            Tuple of (tokens, engine_used)
        """
        engines_to_try = []
        
        # Determine engine order based on preference
        if preferred_engine == 'paddleocr' and 'paddleocr' in self.engines:
            engines_to_try = ['paddleocr', 'doctr', 'tesseract']
        elif preferred_engine == 'doctr' and 'doctr' in self.engines:
            engines_to_try = ['doctr', 'paddleocr', 'tesseract']
        else:
            engines_to_try = ['paddleocr', 'doctr', 'tesseract']
        
        # Filter to only available engines
        engines_to_try = [e for e in engines_to_try if e in self.engines]
        
        if not engines_to_try:
            raise RuntimeError("No OCR engines available")
        
        last_error = None
        
        for engine in engines_to_try:
            try:
                logger.info(f"Trying OCR engine: {engine}")
                
                if engine == 'paddleocr':
                    tokens = self.extract_text_paddleocr(image_path, page_num)
                elif engine == 'doctr':
                    tokens = self.extract_text_doctr(image_path, page_num)
                elif engine == 'tesseract':
                    tokens = self.extract_text_tesseract(image_path, page_num)
                else:
                    continue
                
                # Check if we got reasonable results
                if tokens and len(tokens) > 0:
                    total_text = ' '.join([t.text for t in tokens])
                    if len(total_text.strip()) > 10:  # Minimum text threshold
                        logger.info(f"Successfully extracted text using {engine}")
                        return tokens, engine
                
                logger.warning(f"Engine {engine} returned insufficient text")
                
            except Exception as e:
                logger.warning(f"Engine {engine} failed: {e}")
                last_error = e
                continue
        
        # If all engines failed, raise the last error
        raise RuntimeError(f"All OCR engines failed. Last error: {last_error}")
    
    def _quad_to_bbox(self, quad_coords: List[List[float]]) -> Tuple[float, float, float, float]:
        """Convert quadrilateral coordinates to bounding box"""
        try:
            # quad_coords is [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            x_coords = [point[0] for point in quad_coords]
            y_coords = [point[1] for point in quad_coords]
            
            return (
                min(x_coords),  # xmin
                min(y_coords),  # ymin
                max(x_coords),  # xmax
                max(y_coords)   # ymax
            )
        except Exception:
            return (0, 0, 1, 1)  # Fallback bbox
    
    def get_available_engines(self) -> List[str]:
        """Get list of available OCR engines"""
        return list(self.engines.keys())
    
    def normalize_bbox_coordinates(self, bbox: Tuple[float, float, float, float], 
                                 image_width: int, image_height: int) -> Tuple[float, float, float, float]:
        """
        Normalize bounding box coordinates to 0-1 range
        
        Args:
            bbox: (xmin, ymin, xmax, ymax) in pixels
            image_width: Image width in pixels  
            image_height: Image height in pixels
            
        Returns:
            Normalized bbox (0-1 range)
        """
        xmin, ymin, xmax, ymax = bbox
        
        # If coordinates are already normalized (0-1), return as-is
        if max(xmin, ymin, xmax, ymax) <= 1.0:
            return bbox
        
        # Normalize to 0-1 range
        return (
            xmin / image_width,
            ymin / image_height,
            xmax / image_width,
            ymax / image_height
        )