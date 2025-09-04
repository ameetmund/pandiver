import os
import uuid
import tempfile
import json
import fitz  # PyMuPDF for PDF manipulation
from typing import List, Dict, Any, Optional
from io import BytesIO
from datetime import datetime
from fastapi import HTTPException
from azure.ai.translation.text import TextTranslationClient
from azure.ai.translation.text.models import InputTextItem
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError
import logging

logger = logging.getLogger(__name__)

class PDFTranslationService:
    """Service for PDF document translation using Azure AI Translator"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
        # Azure AI Translator configuration
        self.translator_key = os.getenv('AZURE_TRANSLATOR_KEY')
        self.translator_region = os.getenv('AZURE_TRANSLATOR_REGION')
        self.translator_endpoint = os.getenv('AZURE_TRANSLATOR_ENDPOINT')
        
        if not all([self.translator_key, self.translator_region, self.translator_endpoint]):
            logger.warning("Azure Translator credentials not fully configured")
        
        # Initialize Azure AI Translator client
        try:
            credential = AzureKeyCredential(self.translator_key)
            self.text_translator = TextTranslationClient(
                endpoint=self.translator_endpoint,
                credential=credential
            )
        except Exception as e:
            logger.error(f"Failed to initialize Azure AI Translator: {str(e)}")
            self.text_translator = None
    
    async def get_supported_languages(self) -> Dict[str, Any]:
        """Get supported languages for translation"""
        try:
            if not self.text_translator:
                raise HTTPException(status_code=500, detail="Azure Translator not configured")
            
            response = self.text_translator.get_supported_languages()
            
            # Extract languages with their display names
            languages = {}
            if hasattr(response, 'translation') and response.translation:
                for code, info in response.translation.items():
                    languages[code] = {
                        'name': info.name,
                        'native_name': info.native_name if hasattr(info, 'native_name') else info.name,
                        'dir': info.dir if hasattr(info, 'dir') else 'ltr'
                    }
            
            return {
                'languages': languages,
                'auto_detect_supported': True
            }
            
        except HttpResponseError as e:
            logger.error(f"Azure Translator API error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get supported languages: {str(e)}")
        except Exception as e:
            logger.error(f"Error getting supported languages: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get supported languages")
    
    async def detect_language(self, text: str) -> Dict[str, Any]:
        """Detect language of the given text"""
        try:
            if not self.text_translator:
                raise HTTPException(status_code=500, detail="Azure Translator not configured")
            
            # Use the first 1000 characters for detection to avoid API limits
            sample_text = text[:1000] if len(text) > 1000 else text
            
            if not sample_text.strip():
                return {'language': 'en', 'confidence': 0.0}
            
            input_text_elements = [InputTextItem(text=sample_text)]
            response = self.text_translator.translate(
                body=input_text_elements,
                to_language=['en']  # We just want to detect language, translation target doesn't matter
            )
            
            if response and len(response) > 0:
                detected = response[0].detected_language
                return {
                    'language': detected.language,
                    'confidence': detected.score
                }
            
            return {'language': 'en', 'confidence': 0.0}
            
        except Exception as e:
            logger.error(f"Error detecting language: {str(e)}")
            return {'language': 'en', 'confidence': 0.0}
    
    async def translate_text(self, text: str, target_language: str, source_language: str = 'auto') -> str:
        """Translate text using Azure AI Translator with chunking for long texts"""
        try:
            if not self.text_translator:
                raise HTTPException(status_code=500, detail="Azure Translator not configured")
            
            if not text.strip():
                return text
            
            # Clean and prepare text
            text = text.strip()
            
            # If text is too long, chunk it
            max_chunk_length = 5000  # Azure Translator limit is ~10K characters
            if len(text) <= max_chunk_length:
                # Single translation
                return await self._translate_chunk(text, target_language, source_language)
            else:
                # Split into chunks and translate each
                chunks = self._split_text_into_chunks(text, max_chunk_length)
                translated_chunks = []
                
                for chunk in chunks:
                    if chunk.strip():
                        translated_chunk = await self._translate_chunk(chunk, target_language, source_language)
                        translated_chunks.append(translated_chunk)
                
                return ' '.join(translated_chunks)
            
        except Exception as e:
            logger.error(f"Error translating text: {str(e)}")
            return text  # Return original text if translation fails
    
    async def _translate_chunk(self, text: str, target_language: str, source_language: str = 'auto') -> str:
        """Translate a single chunk of text"""
        try:
            input_text_elements = [InputTextItem(text=text)]
            
            # Prepare translation parameters
            translate_params = {
                'body': input_text_elements,
                'to_language': [target_language]
            }
            
            # Add source language if not auto-detect
            if source_language != 'auto':
                translate_params['from_language'] = source_language
            
            response = self.text_translator.translate(**translate_params)
            
            if response and len(response) > 0 and response[0].translations:
                return response[0].translations[0].text
            
            return text  # Return original if translation fails
            
        except HttpResponseError as e:
            logger.error(f"Azure Translator API error: {str(e)}")
            return text  # Return original text on error
        except Exception as e:
            logger.error(f"Error translating chunk: {str(e)}")
            return text  # Return original text on error
    
    def _split_text_into_chunks(self, text: str, max_length: int) -> List[str]:
        """Split text into chunks that respect sentence boundaries"""
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        current_chunk = ""
        
        # Split by sentences first
        sentences = text.replace('. ', '.\n').replace('! ', '!\n').replace('? ', '?\n').split('\n')
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # If adding this sentence would exceed the limit
            if len(current_chunk) + len(sentence) + 1 > max_length:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    # Single sentence is too long, split by words
                    words = sentence.split()
                    word_chunk = ""
                    for word in words:
                        if len(word_chunk) + len(word) + 1 > max_length:
                            if word_chunk:
                                chunks.append(word_chunk.strip())
                                word_chunk = word
                            else:
                                # Single word is too long, just add it
                                chunks.append(word[:max_length])
                        else:
                            word_chunk += (" " + word) if word_chunk else word
                    
                    if word_chunk:
                        current_chunk = word_chunk
            else:
                current_chunk += (" " + sentence) if current_chunk else sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    async def analyze_pdf_for_translation(self, pdf_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Analyze PDF and extract text for translation analysis
        
        Returns:
        {
            "total_pages": int,
            "filename": str,
            "detected_language": str,
            "language_confidence": float,
            "character_count": int,
            "sample_text": str,  # First 500 characters for preview
            "translatable": bool  # Whether the PDF contains translatable text
        }
        """
        try:
            doc = fitz.open("pdf", pdf_bytes)
            
            # Get page count before processing
            total_pages = doc.page_count
            
            # Extract all text from the document
            full_text = ""
            for page_num in range(total_pages):
                page = doc[page_num]
                page_text = page.get_text()
                full_text += page_text + "\n"
            
            doc.close()
            
            # Check if document has translatable text
            text_length = len(full_text.strip())
            translatable = text_length > 10  # Require at least 10 characters
            
            # Detect language if there's text
            detected_language = 'en'
            language_confidence = 0.0
            
            if translatable:
                detection_result = await self.detect_language(full_text)
                detected_language = detection_result['language']
                language_confidence = detection_result['confidence']
            
            return {
                "total_pages": total_pages,
                "filename": filename,
                "detected_language": detected_language,
                "language_confidence": language_confidence,
                "character_count": text_length,
                "sample_text": full_text[:500].strip(),
                "translatable": translatable
            }
            
        except Exception as e:
            logger.error(f"Error analyzing PDF: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to analyze PDF: {str(e)}")
    
    async def translate_pdf_content(self, pdf_bytes: bytes, target_language: str, 
                                  source_language: str = 'auto', filename: str = "") -> bytes:
        """
        Translate PDF content preserving basic structure and formatting
        
        Args:
            pdf_bytes: Original PDF bytes
            target_language: Target language code (e.g., 'es', 'fr', 'de')
            source_language: Source language code or 'auto' for auto-detect
            filename: Original filename for reference
            
        Returns:
            bytes: New PDF containing translated text
        """
        try:
            # Open source document
            source_doc = fitz.open("pdf", pdf_bytes)
            
            # Create new document for translated content
            new_doc = fitz.open()
            
            for page_num in range(source_doc.page_count):
                page = source_doc[page_num]
                
                # Get page dimensions
                page_rect = page.rect
                new_page = new_doc.new_page(width=page_rect.width, height=page_rect.height)
                
                # Get text blocks with positioning information
                text_blocks = page.get_text("dict")
                
                if not text_blocks or not text_blocks.get("blocks"):
                    # Empty page - just add blank page
                    continue
                
                # Process each text block
                for block in text_blocks["blocks"]:
                    if block.get("type") == 0:  # Text block
                        # Extract all text from the block
                        block_text = ""
                        font_info = None
                        block_bbox = block["bbox"]
                        
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                text = span.get("text", "").strip()
                                if text:
                                    block_text += text + " "
                                    # Get font information from first span
                                    if font_info is None:
                                        font_info = {
                                            "fontname": span.get("font", "helv"),
                                            "fontsize": span.get("size", 11),
                                            "flags": span.get("flags", 0),
                                            "color": span.get("color", 0)
                                        }
                        
                        # Translate the block text if it has content
                        if block_text.strip():
                            try:
                                # Translate the text
                                translated_text = await self.translate_text(
                                    block_text.strip(), 
                                    target_language, 
                                    source_language
                                )
                                
                                # Determine text formatting
                                fontsize = max(8, min(font_info["fontsize"], 16)) if font_info else 11
                                fontname = self._get_safe_font_name(font_info["fontname"]) if font_info else "helv"
                                
                                # Create text rectangle with some padding
                                text_rect = fitz.Rect(
                                    block_bbox[0] - 5,  # x0 with padding  
                                    block_bbox[1] - 5,  # y0 with padding
                                    block_bbox[2] + 5,  # x1 with padding
                                    block_bbox[3] + 50  # y1 with extra height for translated text
                                )
                                
                                # Ensure rectangle is within page bounds
                                text_rect = text_rect & page_rect
                                
                                # Insert translated text
                                if text_rect.is_valid and not text_rect.is_empty:
                                    # Try to insert text with word wrapping
                                    try:
                                        new_page.insert_textbox(
                                            text_rect,
                                            translated_text,
                                            fontsize=fontsize,
                                            fontname=fontname,
                                            color=(0, 0, 0),
                                            align=0  # Left align
                                        )
                                    except Exception as e:
                                        logger.warning(f"Failed to insert text block, trying simpler approach: {str(e)}")
                                        # Fallback: simpler text insertion
                                        try:
                                            new_page.insert_text(
                                                fitz.Point(block_bbox[0], block_bbox[1] + fontsize),
                                                translated_text[:200],  # Limit text length
                                                fontsize=fontsize,
                                                fontname="helv",
                                                color=(0, 0, 0)
                                            )
                                        except:
                                            continue  # Skip this block if it fails
                                            
                            except Exception as e:
                                logger.warning(f"Failed to translate text block: {str(e)}")
                                # Insert original text as fallback
                                try:
                                    new_page.insert_textbox(
                                        fitz.Rect(block_bbox[0], block_bbox[1], 
                                                block_bbox[2], block_bbox[3] + 20),
                                        block_text[:200],
                                        fontsize=10,
                                        fontname="helv",
                                        color=(0, 0, 0)
                                    )
                                except:
                                    continue
            
            # Save to bytes
            output_bytes = new_doc.tobytes()
            
            # Clean up
            source_doc.close()
            new_doc.close()
            
            return output_bytes
            
        except Exception as e:
            logger.error(f"Error translating PDF: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to translate PDF: {str(e)}")
    
    def _get_safe_font_name(self, font_name: str) -> str:
        """Get a safe font name that PyMuPDF can handle"""
        # Map common fonts to PyMuPDF-safe names
        font_mapping = {
            "Arial": "helv",
            "Helvetica": "helv", 
            "Times": "times",
            "Times-Roman": "times",
            "Courier": "cour",
            "Symbol": "symb",
            "ZapfDingbats": "zadb"
        }
        
        # Clean the font name
        clean_name = font_name.split("+")[-1] if "+" in font_name else font_name
        clean_name = clean_name.split("-")[0] if "-" in clean_name else clean_name
        
        # Return mapped font or default to helvetica
        return font_mapping.get(clean_name, "helv")
    
    def generate_translated_filename(self, original_filename: str, source_lang: str, target_lang: str) -> str:
        """Generate filename for translated PDF"""
        base_name = os.path.splitext(original_filename)[0]
        
        if source_lang == 'auto':
            return f"{base_name}_translated_to_{target_lang}.pdf"
        else:
            return f"{base_name}_{source_lang}_to_{target_lang}.pdf"
    
    def validate_language_codes(self, source_lang: str, target_lang: str) -> bool:
        """Validate language codes against Azure Translator supported languages"""
        try:
            # Get supported languages from the API
            if not self.text_translator:
                return True  # If translator not configured, skip validation
            
            # For now, do basic format validation - Azure supports many language codes
            # Source language validation
            if source_lang != 'auto':
                if not isinstance(source_lang, str) or len(source_lang) < 2 or len(source_lang) > 10:
                    return False
                # Allow common patterns like 'en', 'zh-Hans', 'pt-PT'
                if not all(c.isalpha() or c == '-' for c in source_lang):
                    return False
            
            # Target language validation  
            if not isinstance(target_lang, str) or len(target_lang) < 2 or len(target_lang) > 10:
                return False
            if not all(c.isalpha() or c == '-' for c in target_lang):
                return False
            
            return True
            
        except Exception as e:
            logger.warning(f"Error validating language codes: {str(e)}")
            return True  # Allow through if validation fails
    
    async def get_translation_estimate(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Get translation cost/time estimate"""
        try:
            doc = fitz.open("pdf", pdf_bytes)
            
            total_chars = 0
            for page_num in range(doc.page_count):
                page = doc[page_num]
                page_text = page.get_text()
                total_chars += len(page_text)
            
            doc.close()
            
            # Rough estimates (adjust based on your needs)
            estimated_time_seconds = max(30, total_chars // 100)  # ~100 chars per second
            
            return {
                "character_count": total_chars,
                "estimated_time_seconds": estimated_time_seconds,
                "estimated_time_minutes": round(estimated_time_seconds / 60, 1)
            }
            
        except Exception as e:
            logger.error(f"Error estimating translation: {str(e)}")
            raise HTTPException(status_code=400, detail="Failed to estimate translation")