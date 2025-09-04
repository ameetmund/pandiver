import os
import uuid
import json
import asyncio
import aiohttp
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class AzureDocumentTranslationService:
    """Service for Azure Document Translation with Blob Storage integration"""
    
    def __init__(self):
        # Azure Document Translation configuration
        self.doc_translator_key = os.getenv('AZURE_DOC_TRANSLATOR_KEY')
        self.doc_translator_region = os.getenv('AZURE_DOC_TRANSLATOR_REGION')
        self.doc_translator_endpoint = os.getenv('AZURE_DOC_TRANSLATOR_ENDPOINT')
        
        # Azure Blob Storage configuration
        self.blob_src_url = os.getenv('AZURE_BLOB_SRC_URL', 'https://pandiver.blob.core.windows.net/src')
        self.blob_out_url = os.getenv('AZURE_BLOB_OUT_URL', 'https://pandiver.blob.core.windows.net/out')
        self.blob_config_url = os.getenv('AZURE_BLOB_CONFIG_URL', 'https://pandiver.blob.core.windows.net/config')
        
        # SAS tokens from environment variables
        self.src_sas_token = os.getenv('AZURE_BLOB_SRC_SAS_TOKEN')
        self.out_sas_token = os.getenv('AZURE_BLOB_OUT_SAS_TOKEN')
        self.config_sas_token = os.getenv('AZURE_BLOB_CONFIG_SAS_TOKEN')
        
        if not all([self.doc_translator_key, self.doc_translator_region, self.doc_translator_endpoint]):
            logger.warning("Azure Document Translator credentials not fully configured")
    
    async def upload_pdf_to_blob(self, pdf_bytes: bytes, filename: str) -> str:
        """Upload PDF to Azure Blob Storage and return the URL with SAS token"""
        try:
            # Generate unique filename to avoid conflicts
            unique_filename = f"{uuid.uuid4()}_{filename}"
            blob_url = f"{self.blob_src_url}/{unique_filename}?{self.src_sas_token}"
            
            # Upload using direct HTTP request
            async with aiohttp.ClientSession() as session:
                headers = {
                    'x-ms-blob-type': 'BlockBlob',
                    'Content-Type': 'application/pdf'
                }
                
                async with session.put(blob_url, data=pdf_bytes, headers=headers) as response:
                    if response.status not in [200, 201]:
                        error_text = await response.text()
                        raise HTTPException(
                            status_code=500, 
                            detail=f"Failed to upload PDF to blob storage: {error_text}"
                        )
            
            # Return URL without SAS for the translation job (we'll add it later)
            return f"{self.blob_src_url}/{unique_filename}"
            
        except Exception as e:
            logger.error(f"Error uploading PDF to blob: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to upload PDF: {str(e)}")
    
    async def start_document_translation(self, source_url: str, target_language: str, 
                                       source_language: str = "auto") -> str:
        """Start Azure Document Translation job and return job ID"""
        try:
            print(f"DEBUG: start_document_translation called with source_language='{source_language}'")
            # Construct URLs with SAS tokens
            # For Azure Document Translation, source URL should point to container, not specific file
            source_url_with_sas = f"{self.blob_src_url}?{self.src_sas_token}"
            target_url_with_sas = f"{self.blob_out_url}?{self.out_sas_token}"
            glossary_url_with_sas = f"{self.blob_config_url}?{self.config_sas_token}"
            
            print(f"DEBUG: Source URL: {source_url_with_sas}")
            print(f"DEBUG: Target URL: {target_url_with_sas}")
            print(f"DEBUG: Glossary URL: {glossary_url_with_sas}")
            
            # Test if we can access the source URL
            async with aiohttp.ClientSession() as test_session:
                try:
                    async with test_session.head(source_url_with_sas) as test_response:
                        print(f"DEBUG: Source URL access test - Status: {test_response.status}")
                        if test_response.status != 200:
                            print(f"DEBUG: Source URL not accessible - Headers: {dict(test_response.headers)}")
                except Exception as e:
                    print(f"DEBUG: Failed to test source URL access: {str(e)}")
            
            # Prepare the translation request
            translation_request = {
                "inputs": [
                    {
                        "source": {
                            "sourceUrl": source_url_with_sas
                        },
                        "targets": [
                            {
                                "targetUrl": target_url_with_sas,
                                "language": target_language,
                                "glossaries": [
                                    {
                                        "glossaryUrl": glossary_url_with_sas,
                                        "format": "tsv"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
            
            # Add source language if not auto-detect
            if source_language != "auto":
                translation_request["inputs"][0]["source"]["language"] = source_language
            
            print(f"DEBUG: Translation request payload: {json.dumps(translation_request, indent=2)}")
            
            # Submit translation job
            api_url = f"{self.doc_translator_endpoint}/translator/document/batches?api-version=2024-05-01"
            headers = {
                'Ocp-Apim-Subscription-Key': self.doc_translator_key,
                'Ocp-Apim-Subscription-Region': self.doc_translator_region,
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=translation_request, headers=headers) as response:
                    if response.status not in [200, 201, 202]:
                        error_text = await response.text()
                        logger.error(f"Azure Document Translation API error: {error_text}")
                        raise HTTPException(
                            status_code=500, 
                            detail=f"Failed to start translation: {error_text}"
                        )
                    
                    # Extract job ID from response
                    response_data = await response.json()
                    job_id = response_data.get("id")
                    
                    if not job_id:
                        raise HTTPException(
                            status_code=500, 
                            detail="No job ID returned from translation service"
                        )
                    
                    return job_id
            
        except Exception as e:
            logger.error(f"Error starting document translation: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to start translation: {str(e)}")
    
    async def get_translation_status(self, job_id: str) -> Dict[str, Any]:
        """Get the status of a document translation job"""
        try:
            api_url = f"{self.doc_translator_endpoint}/translator/document/batches/{job_id}?api-version=2024-05-01"
            headers = {
                'Ocp-Apim-Subscription-Key': self.doc_translator_key,
                'Ocp-Apim-Subscription-Region': self.doc_translator_region
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, headers=headers) as response:
                    if response.status == 404:
                        return {"status": "NotFound", "error": "Translation job not found"}
                    
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Error getting translation status: {error_text}")
                        return {"status": "Error", "error": error_text}
                    
                    data = await response.json()
                    return {
                        "status": data.get("status", "Unknown"),
                        "createdDateTimeUtc": data.get("createdDateTimeUtc"),
                        "lastActionDateTimeUtc": data.get("lastActionDateTimeUtc"),
                        "summary": data.get("summary", {}),
                        "error": data.get("error")
                    }
            
        except Exception as e:
            logger.error(f"Error getting translation status: {str(e)}")
            return {"status": "Error", "error": str(e)}
    
    async def get_translated_document_url(self, job_id: str, original_filename: str) -> Optional[str]:
        """Get the URL of the translated document from the job details"""
        try:
            # Get documents list for the job
            api_url = f"{self.doc_translator_endpoint}/translator/document/batches/{job_id}/documents?api-version=2024-05-01"
            headers = {
                'Ocp-Apim-Subscription-Key': self.doc_translator_key,
                'Ocp-Apim-Subscription-Region': self.doc_translator_region
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, headers=headers) as response:
                    if response.status != 200:
                        return None
                    
                    data = await response.json()
                    documents = data.get("value", [])
                    
                    # Find the translated document
                    for doc in documents:
                        if doc.get("status") == "Succeeded":
                            target_url = doc.get("path")
                            if target_url:
                                # Add SAS token for download
                                return f"{target_url}?{self.out_sas_token}"
                    
                    return None
            
        except Exception as e:
            logger.error(f"Error getting translated document URL: {str(e)}")
            return None
    
    async def download_translated_pdf(self, document_url: str) -> bytes:
        """Download the translated PDF from blob storage"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(document_url) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise HTTPException(
                            status_code=500, 
                            detail=f"Failed to download translated PDF: {error_text}"
                        )
                    
                    return await response.read()
            
        except Exception as e:
            logger.error(f"Error downloading translated PDF: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to download PDF: {str(e)}")
    
    def generate_translated_filename(self, original_filename: str, source_lang: str, target_lang: str) -> str:
        """Generate filename for translated PDF"""
        base_name = os.path.splitext(original_filename)[0]
        
        if source_lang == 'auto':
            return f"{base_name}_translated_to_{target_lang}.pdf"
        else:
            return f"{base_name}_{source_lang}_to_{target_lang}.pdf"
    
    async def get_supported_languages(self) -> Dict[str, Any]:
        """Get supported languages for document translation"""
        try:
            api_url = f"{self.doc_translator_endpoint}/translator/document/languages?api-version=2024-05-01"
            headers = {
                'Ocp-Apim-Subscription-Key': self.doc_translator_key,
                'Ocp-Apim-Subscription-Region': self.doc_translator_region
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, headers=headers) as response:
                    if response.status != 200:
                        # Fallback to common languages
                        return {
                            "languages": {
                                "en": {"name": "English", "native_name": "English", "dir": "ltr"},
                                "es": {"name": "Spanish", "native_name": "Español", "dir": "ltr"},
                                "fr": {"name": "French", "native_name": "Français", "dir": "ltr"},
                                "de": {"name": "German", "native_name": "Deutsch", "dir": "ltr"},
                                "hi": {"name": "Hindi", "native_name": "हिन्दी", "dir": "ltr"},
                                "zh": {"name": "Chinese", "native_name": "中文", "dir": "ltr"},
                                "ar": {"name": "Arabic", "native_name": "العربية", "dir": "rtl"},
                                "ja": {"name": "Japanese", "native_name": "日本語", "dir": "ltr"},
                                "ko": {"name": "Korean", "native_name": "한국어", "dir": "ltr"},
                                "pt": {"name": "Portuguese", "native_name": "Português", "dir": "ltr"}
                            },
                            "auto_detect_supported": True
                        }
                    
                    data = await response.json()
                    
                    # Process the response to match our expected format
                    languages = {}
                    document_translation = data.get("documentTranslation", {})
                    
                    for lang_code, lang_info in document_translation.items():
                        languages[lang_code] = {
                            "name": lang_info.get("name", lang_code.upper()),
                            "native_name": lang_info.get("nativeName", lang_code.upper()),
                            "dir": lang_info.get("dir", "ltr")
                        }
                    
                    return {
                        "languages": languages,
                        "auto_detect_supported": True
                    }
            
        except Exception as e:
            logger.error(f"Error getting supported languages: {str(e)}")
            # Return fallback languages
            return {
                "languages": {
                    "en": {"name": "English", "native_name": "English", "dir": "ltr"},
                    "es": {"name": "Spanish", "native_name": "Español", "dir": "ltr"},
                    "fr": {"name": "French", "native_name": "Français", "dir": "ltr"},
                    "de": {"name": "German", "native_name": "Deutsch", "dir": "ltr"},
                    "hi": {"name": "Hindi", "native_name": "हिन्दी", "dir": "ltr"}
                },
                "auto_detect_supported": True
            }