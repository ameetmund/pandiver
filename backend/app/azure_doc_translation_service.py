import os
import uuid
import json
import asyncio
import aiohttp
import urllib.parse
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
        
        print(f"DEBUG: Config URL loaded from env: {self.blob_config_url}")
        print(f"DEBUG: Config SAS token loaded: {self.config_sas_token[:50]}..." if self.config_sas_token else "None")
        
        if not all([self.doc_translator_key, self.doc_translator_region, self.doc_translator_endpoint]):
            logger.warning("Azure Document Translator credentials not fully configured")
    
    async def upload_pdf_to_blob(self, pdf_bytes: bytes, filename: str) -> str:
        """Upload PDF to Azure Blob Storage and return the URL with SAS token"""
        try:
            # Generate unique filename with timestamp to avoid conflicts
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            job_uuid = str(uuid.uuid4())[:8]  # Short UUID
            unique_filename = f"{timestamp}_{job_uuid}_{filename}"
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
            return f"{self.blob_src_url}/{unique_filename}", unique_filename
            
        except Exception as e:
            logger.error(f"Error uploading PDF to blob: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to upload PDF: {str(e)}")
    
    async def start_document_translation(self, source_url: str, target_language: str, 
                                       source_language: str = "auto", job_id: str = None) -> tuple[str, str]:
        """Start Azure Document Translation job and return job ID"""
        try:
            print(f"DEBUG: start_document_translation called with source_language='{source_language}'")
            print(f"DEBUG: source_url parameter received: {source_url}")
            
            # Construct URLs with SAS tokens
            # Use container URL for source but specify the exact file in the translation request
            source_container_url_with_sas = f"{self.blob_src_url}?{self.src_sas_token}"
            # Create unique subfolder for each job to prevent conflicts
            # Use the actual job_id if provided, otherwise generate UUID
            if job_id:
                folder_name = job_id
                print(f"DEBUG: Using job_id as folder_name: {folder_name}")
            else:
                folder_name = str(uuid.uuid4())[:8]
                print(f"DEBUG: Generated random folder_name: {folder_name}")
            target_url_with_sas = f"{self.blob_out_url}/{folder_name}?{self.out_sas_token}"
            # The config URL already includes the specific file path, so just append SAS token
            glossary_url_with_sas = f"{self.blob_config_url}?{self.config_sas_token}"
            
            print(f"DEBUG: Source Container URL: {source_container_url_with_sas}")
            print(f"DEBUG: Target URL: {target_url_with_sas}")
            print(f"DEBUG: Glossary URL: {glossary_url_with_sas}")
            
            # Extract filename from source_url for filtering
            specific_filename = source_url.split('/')[-1]
            print(f"DEBUG: Specific filename to process: {specific_filename}")
            
            # Test if we can access the source container URL
            async with aiohttp.ClientSession() as test_session:
                try:
                    async with test_session.head(source_container_url_with_sas) as test_response:
                        print(f"DEBUG: Source container access test - Status: {test_response.status}")
                        if test_response.status != 200:
                            print(f"DEBUG: Source container not accessible - Headers: {dict(test_response.headers)}")
                except Exception as e:
                    print(f"DEBUG: Failed to test source container access: {str(e)}")
            
            # Test glossary accessibility first
            glossary_accessible = False
            try:
                async with aiohttp.ClientSession() as test_session:
                    async with test_session.head(glossary_url_with_sas, timeout=5) as glossary_test:
                        print(f"DEBUG: Glossary access test - Status: {glossary_test.status}")
                        if glossary_test.status == 200:
                            glossary_accessible = True
                            print("DEBUG: Glossary is accessible, including in translation request")
                        else:
                            print(f"DEBUG: Glossary not accessible (status {glossary_test.status}), proceeding without glossary")
            except Exception as e:
                print(f"DEBUG: Failed to test glossary access: {str(e)}, proceeding without glossary")

            # Prepare the translation request with file filtering
            if glossary_accessible:
                # Include glossary if accessible
                translation_request = {
                    "inputs": [
                        {
                            "source": {
                                "sourceUrl": source_container_url_with_sas,
                                "filter": {
                                    "prefix": specific_filename
                                }
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
            else:
                # Proceed without glossary
                translation_request = {
                    "inputs": [
                        {
                            "source": {
                                "sourceUrl": source_container_url_with_sas,
                                "filter": {
                                    "prefix": specific_filename
                                }
                            },
                            "targets": [
                                {
                                    "targetUrl": target_url_with_sas,
                                    "language": target_language
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
                            detail=f"Azure translation failed: {error_text}"
                        )
                    
                    # Extract job ID from response
                    response_data = await response.json()
                    job_id = response_data.get("id")
                    
                    if not job_id:
                        raise HTTPException(
                            status_code=500, 
                            detail="No job ID returned from translation service"
                        )
                    
                    return job_id, folder_name
            
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
    
    async def get_translated_document_url(self, job_id: str, original_filename: str, output_folder: str = None) -> Optional[str]:
        """Get the URL of the translated document from the job details"""
        try:
            # Get documents list for the specific job
            api_url = f"{self.doc_translator_endpoint}/translator/document/batches/{job_id}/documents?api-version=2024-05-01"
            headers = {
                'Ocp-Apim-Subscription-Key': self.doc_translator_key,
                'Ocp-Apim-Subscription-Region': self.doc_translator_region
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, headers=headers) as response:
                    if response.status != 200:
                        logger.error(f"Failed to get documents for job {job_id}: {response.status}")
                        return None
                    
                    data = await response.json()
                    documents = data.get("value", [])
                    
                    print(f"DEBUG: Found {len(documents)} documents for job {job_id}")
                    
                    # Find the successfully translated document for this specific job
                    # Azure returns both source and target documents, we want the target
                    # First try to match by exact unique filename
                    for doc in documents:
                        doc_path = doc.get("path", "")
                        doc_status = doc.get("status", "")
                        source_path = doc.get("sourcePath", "")
                        
                        print(f"DEBUG: Document - Path: {doc_path}, Status: {doc_status}, SourcePath: {source_path}")
                        
                        # Look for the target document with exact unique filename match
                        # If output_folder is provided, look specifically in that folder
                        folder_match = True
                        if output_folder:
                            folder_match = f"/out/{output_folder}" in doc_path
                        else:
                            folder_match = "/out/" in doc_path
                        
                        # Handle URL encoding in paths (e.g., %20 for spaces)
                        decoded_path = urllib.parse.unquote(doc_path)
                            
                        if (doc_status == "Succeeded" and 
                            doc_path and 
                            folder_match and 
                            original_filename in decoded_path):
                            
                            print(f"DEBUG: Found matching translated document: {doc_path}")
                            # Add SAS token for download
                            return f"{doc_path}?{self.out_sas_token}"
                    
                    # If exact filename match not found, try to find by base filename (fallback)
                    base_filename = original_filename.split("_", 2)[-1] if "_" in original_filename else original_filename
                    for doc in documents:
                        doc_path = doc.get("path", "")
                        doc_status = doc.get("status", "")
                        
                        # Apply same folder logic for fallback
                        folder_match = True
                        if output_folder:
                            folder_match = f"/out/{output_folder}" in doc_path
                        else:
                            folder_match = "/out/" in doc_path
                        
                        # Handle URL encoding in paths
                        decoded_path = urllib.parse.unquote(doc_path)
                        
                        if (doc_status == "Succeeded" and 
                            doc_path and 
                            folder_match and
                            base_filename.lower() in decoded_path.lower()):
                            
                            print(f"DEBUG: Using fallback translated document: {doc_path}")
                            return f"{doc_path}?{self.out_sas_token}"
                    
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
                        # Fallback to supported languages
                        return {
                            "languages": {
                                "af": {"name": "Afrikaans", "native_name": "Afrikaans", "dir": "ltr"},
                                "sq": {"name": "Albanian", "native_name": "Shqip", "dir": "ltr"},
                                "ar": {"name": "Arabic", "native_name": "العربية", "dir": "rtl"},
                                "az": {"name": "Azerbaijani (Latin)", "native_name": "Azərbaycanca", "dir": "ltr"},
                                "ba": {"name": "Bashkir", "native_name": "Башҡортса", "dir": "ltr"},
                                "eu": {"name": "Basque", "native_name": "Euskera", "dir": "ltr"},
                                "bs": {"name": "Bosnian (Latin)", "native_name": "Bosanski", "dir": "ltr"},
                                "bg": {"name": "Bulgarian", "native_name": "Български", "dir": "ltr"},
                                "yue": {"name": "Cantonese (Traditional)", "native_name": "粵語", "dir": "ltr"},
                                "ca": {"name": "Catalan", "native_name": "Català", "dir": "ltr"},
                                "lzh": {"name": "Chinese (Literary)", "native_name": "文言文", "dir": "ltr"},
                                "zh-Hans": {"name": "Chinese Simplified", "native_name": "中文(简体)", "dir": "ltr"},
                                "zh-Hant": {"name": "Chinese Traditional", "native_name": "中文(繁體)", "dir": "ltr"},
                                "hr": {"name": "Croatian", "native_name": "Hrvatski", "dir": "ltr"},
                                "cs": {"name": "Czech", "native_name": "Čeština", "dir": "ltr"},
                                "da": {"name": "Danish", "native_name": "Dansk", "dir": "ltr"},
                                "nl": {"name": "Dutch", "native_name": "Nederlands", "dir": "ltr"},
                                "en": {"name": "English", "native_name": "English", "dir": "ltr"},
                                "et": {"name": "Estonian", "native_name": "Eesti", "dir": "ltr"},
                                "fo": {"name": "Faroese", "native_name": "Føroyskt", "dir": "ltr"},
                                "fj": {"name": "Fijian", "native_name": "Na Vosa Vakaviti", "dir": "ltr"},
                                "fil": {"name": "Filipino", "native_name": "Filipino", "dir": "ltr"},
                                "fi": {"name": "Finnish", "native_name": "Suomi", "dir": "ltr"},
                                "fr": {"name": "French", "native_name": "Français", "dir": "ltr"},
                                "fr-ca": {"name": "French (Canada)", "native_name": "Français (Canada)", "dir": "ltr"},
                                "gl": {"name": "Galician", "native_name": "Galego", "dir": "ltr"},
                                "de": {"name": "German", "native_name": "Deutsch", "dir": "ltr"},
                                "ht": {"name": "Haitian Creole", "native_name": "Kreyòl Ayisyen", "dir": "ltr"},
                                "hi": {"name": "Hindi", "native_name": "हिन्दी", "dir": "ltr"},
                                "mww": {"name": "Hmong Daw (Latin)", "native_name": "Hmong Daw", "dir": "ltr"},
                                "hu": {"name": "Hungarian", "native_name": "Magyar", "dir": "ltr"},
                                "is": {"name": "Icelandic", "native_name": "Íslenska", "dir": "ltr"},
                                "id": {"name": "Indonesian", "native_name": "Bahasa Indonesia", "dir": "ltr"},
                                "ia": {"name": "Interlingua", "native_name": "Interlingua", "dir": "ltr"},
                                "ikt": {"name": "Inuinnaqtun", "native_name": "Inuinnaqtun", "dir": "ltr"},
                                "iu": {"name": "Inuktitut (Latin)", "native_name": "ᐃᓄᒃᑎᑐᑦ", "dir": "ltr"},
                                "ga": {"name": "Irish", "native_name": "Gaeilge", "dir": "ltr"},
                                "it": {"name": "Italian", "native_name": "Italiano", "dir": "ltr"},
                                "ja": {"name": "Japanese", "native_name": "日本語", "dir": "ltr"},
                                "kn": {"name": "Kannada", "native_name": "ಕನ್ನಡ", "dir": "ltr"},
                                "kk": {"name": "Kazakh (Cyrillic)", "native_name": "Қазақша", "dir": "ltr"},
                                "kk-Latn": {"name": "Kazakh (Latin)", "native_name": "Qazaqsha", "dir": "ltr"},
                                "ko": {"name": "Korean", "native_name": "한국어", "dir": "ltr"},
                                "kmr": {"name": "Kurdish (Latin) (Northern)", "native_name": "Kurdî", "dir": "ltr"},
                                "ky": {"name": "Kyrgyz (Cyrillic)", "native_name": "Кыргызча", "dir": "ltr"},
                                "lv": {"name": "Latvian", "native_name": "Latviešu", "dir": "ltr"},
                                "lt": {"name": "Lithuanian", "native_name": "Lietuvių", "dir": "ltr"},
                                "mk": {"name": "Macedonian", "native_name": "Македонски", "dir": "ltr"},
                                "mg": {"name": "Malagasy", "native_name": "Malagasy", "dir": "ltr"},
                                "ms": {"name": "Malay (Latin)", "native_name": "Bahasa Melayu", "dir": "ltr"},
                                "ml": {"name": "Malayalam", "native_name": "മലയാളം", "dir": "ltr"},
                                "mt": {"name": "Maltese", "native_name": "Malti", "dir": "ltr"},
                                "mi": {"name": "Maori", "native_name": "Te Reo Māori", "dir": "ltr"},
                                "mr": {"name": "Marathi", "native_name": "मराठी", "dir": "ltr"},
                                "mn-Cyrl": {"name": "Mongolian (Cyrillic)", "native_name": "Монгол хэл", "dir": "ltr"},
                                "ne": {"name": "Nepali", "native_name": "नेपाली", "dir": "ltr"},
                                "nb": {"name": "Norwegian Bokmål", "native_name": "Norsk Bokmål", "dir": "ltr"},
                                "pl": {"name": "Polish", "native_name": "Polski", "dir": "ltr"},
                                "pt": {"name": "Portuguese (Brazil)", "native_name": "Português (Brasil)", "dir": "ltr"},
                                "pt-pt": {"name": "Portuguese (Portugal)", "native_name": "Português (Portugal)", "dir": "ltr"},
                                "pa": {"name": "Punjabi", "native_name": "ਪੰਜਾਬੀ", "dir": "ltr"},
                                "otq": {"name": "Queretaro Otomi", "native_name": "Hñähñu", "dir": "ltr"},
                                "ro": {"name": "Romanian", "native_name": "Română", "dir": "ltr"},
                                "ru": {"name": "Russian", "native_name": "Русский", "dir": "ltr"},
                                "sm": {"name": "Samoan (Latin)", "native_name": "Gagana Samoa", "dir": "ltr"},
                                "sr-Cyrl": {"name": "Serbian (Cyrillic)", "native_name": "Српски", "dir": "ltr"},
                                "sr-Latn": {"name": "Serbian (Latin)", "native_name": "Srpski", "dir": "ltr"},
                                "sk": {"name": "Slovak", "native_name": "Slovenčina", "dir": "ltr"},
                                "sl": {"name": "Slovenian", "native_name": "Slovenščina", "dir": "ltr"},
                                "so": {"name": "Somali", "native_name": "Soomaali", "dir": "ltr"},
                                "es": {"name": "Spanish", "native_name": "Español", "dir": "ltr"},
                                "sw": {"name": "Swahili (Latin)", "native_name": "Kiswahili", "dir": "ltr"},
                                "sv": {"name": "Swedish", "native_name": "Svenska", "dir": "ltr"},
                                "ty": {"name": "Tahitian", "native_name": "Reo Tahiti", "dir": "ltr"},
                                "ta": {"name": "Tamil", "native_name": "தமிழ்", "dir": "ltr"},
                                "tt": {"name": "Tatar (Latin)", "native_name": "Tatarça", "dir": "ltr"},
                                "te": {"name": "Telugu", "native_name": "తెలుగు", "dir": "ltr"},
                                "to": {"name": "Tongan", "native_name": "Lea Faka-Tonga", "dir": "ltr"},
                                "tr": {"name": "Turkish", "native_name": "Türkçe", "dir": "ltr"},
                                "tk": {"name": "Turkmen (Latin)", "native_name": "Türkmen Dili", "dir": "ltr"},
                                "uk": {"name": "Ukrainian", "native_name": "Українська", "dir": "ltr"},
                                "hsb": {"name": "Upper Sorbian", "native_name": "Hornjoserbšćina", "dir": "ltr"},
                                "uz": {"name": "Uzbek (Latin)", "native_name": "O'zbek", "dir": "ltr"},
                                "vi": {"name": "Vietnamese", "native_name": "Tiếng Việt", "dir": "ltr"},
                                "cy": {"name": "Welsh", "native_name": "Cymraeg", "dir": "ltr"},
                                "yua": {"name": "Yucatec Maya", "native_name": "Màaya T'àan", "dir": "ltr"},
                                "zu": {"name": "Zulu", "native_name": "isiZulu", "dir": "ltr"}
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
                    "af": {"name": "Afrikaans", "native_name": "Afrikaans", "dir": "ltr"},
                    "sq": {"name": "Albanian", "native_name": "Shqip", "dir": "ltr"},
                    "ar": {"name": "Arabic", "native_name": "العربية", "dir": "rtl"},
                    "az": {"name": "Azerbaijani (Latin)", "native_name": "Azərbaycanca", "dir": "ltr"},
                    "ba": {"name": "Bashkir", "native_name": "Башҡортса", "dir": "ltr"},
                    "eu": {"name": "Basque", "native_name": "Euskera", "dir": "ltr"},
                    "bs": {"name": "Bosnian (Latin)", "native_name": "Bosanski", "dir": "ltr"},
                    "bg": {"name": "Bulgarian", "native_name": "Български", "dir": "ltr"},
                    "yue": {"name": "Cantonese (Traditional)", "native_name": "粵語", "dir": "ltr"},
                    "ca": {"name": "Catalan", "native_name": "Català", "dir": "ltr"},
                    "lzh": {"name": "Chinese (Literary)", "native_name": "文言文", "dir": "ltr"},
                    "zh-Hans": {"name": "Chinese Simplified", "native_name": "中文(简体)", "dir": "ltr"},
                    "zh-Hant": {"name": "Chinese Traditional", "native_name": "中文(繁體)", "dir": "ltr"},
                    "hr": {"name": "Croatian", "native_name": "Hrvatski", "dir": "ltr"},
                    "cs": {"name": "Czech", "native_name": "Čeština", "dir": "ltr"},
                    "da": {"name": "Danish", "native_name": "Dansk", "dir": "ltr"},
                    "nl": {"name": "Dutch", "native_name": "Nederlands", "dir": "ltr"},
                    "en": {"name": "English", "native_name": "English", "dir": "ltr"},
                    "et": {"name": "Estonian", "native_name": "Eesti", "dir": "ltr"},
                    "fo": {"name": "Faroese", "native_name": "Føroyskt", "dir": "ltr"},
                    "fj": {"name": "Fijian", "native_name": "Na Vosa Vakaviti", "dir": "ltr"},
                    "fil": {"name": "Filipino", "native_name": "Filipino", "dir": "ltr"},
                    "fi": {"name": "Finnish", "native_name": "Suomi", "dir": "ltr"},
                    "fr": {"name": "French", "native_name": "Français", "dir": "ltr"},
                    "fr-ca": {"name": "French (Canada)", "native_name": "Français (Canada)", "dir": "ltr"},
                    "gl": {"name": "Galician", "native_name": "Galego", "dir": "ltr"},
                    "de": {"name": "German", "native_name": "Deutsch", "dir": "ltr"},
                    "ht": {"name": "Haitian Creole", "native_name": "Kreyòl Ayisyen", "dir": "ltr"},
                    "hi": {"name": "Hindi", "native_name": "हिन्दी", "dir": "ltr"},
                    "mww": {"name": "Hmong Daw (Latin)", "native_name": "Hmong Daw", "dir": "ltr"},
                    "hu": {"name": "Hungarian", "native_name": "Magyar", "dir": "ltr"},
                    "is": {"name": "Icelandic", "native_name": "Íslenska", "dir": "ltr"},
                    "id": {"name": "Indonesian", "native_name": "Bahasa Indonesia", "dir": "ltr"},
                    "ia": {"name": "Interlingua", "native_name": "Interlingua", "dir": "ltr"},
                    "ikt": {"name": "Inuinnaqtun", "native_name": "Inuinnaqtun", "dir": "ltr"},
                    "iu": {"name": "Inuktitut (Latin)", "native_name": "ᐃᓄᒃᑎᑐᑦ", "dir": "ltr"},
                    "ga": {"name": "Irish", "native_name": "Gaeilge", "dir": "ltr"},
                    "it": {"name": "Italian", "native_name": "Italiano", "dir": "ltr"},
                    "ja": {"name": "Japanese", "native_name": "日本語", "dir": "ltr"},
                    "kn": {"name": "Kannada", "native_name": "ಕನ್ನಡ", "dir": "ltr"},
                    "kk": {"name": "Kazakh (Cyrillic)", "native_name": "Қазақша", "dir": "ltr"},
                    "kk-Latn": {"name": "Kazakh (Latin)", "native_name": "Qazaqsha", "dir": "ltr"},
                    "ko": {"name": "Korean", "native_name": "한국어", "dir": "ltr"},
                    "kmr": {"name": "Kurdish (Latin) (Northern)", "native_name": "Kurdî", "dir": "ltr"},
                    "ky": {"name": "Kyrgyz (Cyrillic)", "native_name": "Кыргызча", "dir": "ltr"},
                    "lv": {"name": "Latvian", "native_name": "Latviešu", "dir": "ltr"},
                    "lt": {"name": "Lithuanian", "native_name": "Lietuvių", "dir": "ltr"},
                    "mk": {"name": "Macedonian", "native_name": "Македонски", "dir": "ltr"},
                    "mg": {"name": "Malagasy", "native_name": "Malagasy", "dir": "ltr"},
                    "ms": {"name": "Malay (Latin)", "native_name": "Bahasa Melayu", "dir": "ltr"},
                    "ml": {"name": "Malayalam", "native_name": "മലയാളം", "dir": "ltr"},
                    "mt": {"name": "Maltese", "native_name": "Malti", "dir": "ltr"},
                    "mi": {"name": "Maori", "native_name": "Te Reo Māori", "dir": "ltr"},
                    "mr": {"name": "Marathi", "native_name": "मराठी", "dir": "ltr"},
                    "mn-Cyrl": {"name": "Mongolian (Cyrillic)", "native_name": "Монгол хэл", "dir": "ltr"},
                    "ne": {"name": "Nepali", "native_name": "नेपाली", "dir": "ltr"},
                    "nb": {"name": "Norwegian Bokmål", "native_name": "Norsk Bokmål", "dir": "ltr"},
                    "pl": {"name": "Polish", "native_name": "Polski", "dir": "ltr"},
                    "pt": {"name": "Portuguese (Brazil)", "native_name": "Português (Brasil)", "dir": "ltr"},
                    "pt-pt": {"name": "Portuguese (Portugal)", "native_name": "Português (Portugal)", "dir": "ltr"},
                    "pa": {"name": "Punjabi", "native_name": "ਪੰਜਾਬੀ", "dir": "ltr"},
                    "otq": {"name": "Queretaro Otomi", "native_name": "Hñähñu", "dir": "ltr"},
                    "ro": {"name": "Romanian", "native_name": "Română", "dir": "ltr"},
                    "ru": {"name": "Russian", "native_name": "Русский", "dir": "ltr"},
                    "sm": {"name": "Samoan (Latin)", "native_name": "Gagana Samoa", "dir": "ltr"},
                    "sr-Cyrl": {"name": "Serbian (Cyrillic)", "native_name": "Српски", "dir": "ltr"},
                    "sr-Latn": {"name": "Serbian (Latin)", "native_name": "Srpski", "dir": "ltr"},
                    "sk": {"name": "Slovak", "native_name": "Slovenčina", "dir": "ltr"},
                    "sl": {"name": "Slovenian", "native_name": "Slovenščina", "dir": "ltr"},
                    "so": {"name": "Somali", "native_name": "Soomaali", "dir": "ltr"},
                    "es": {"name": "Spanish", "native_name": "Español", "dir": "ltr"},
                    "sw": {"name": "Swahili (Latin)", "native_name": "Kiswahili", "dir": "ltr"},
                    "sv": {"name": "Swedish", "native_name": "Svenska", "dir": "ltr"},
                    "ty": {"name": "Tahitian", "native_name": "Reo Tahiti", "dir": "ltr"},
                    "ta": {"name": "Tamil", "native_name": "தமிழ்", "dir": "ltr"},
                    "tt": {"name": "Tatar (Latin)", "native_name": "Tatarça", "dir": "ltr"},
                    "te": {"name": "Telugu", "native_name": "తెలుగు", "dir": "ltr"},
                    "to": {"name": "Tongan", "native_name": "Lea Faka-Tonga", "dir": "ltr"},
                    "tr": {"name": "Turkish", "native_name": "Türkçe", "dir": "ltr"},
                    "tk": {"name": "Turkmen (Latin)", "native_name": "Türkmen Dili", "dir": "ltr"},
                    "uk": {"name": "Ukrainian", "native_name": "Українська", "dir": "ltr"},
                    "hsb": {"name": "Upper Sorbian", "native_name": "Hornjoserbšćina", "dir": "ltr"},
                    "uz": {"name": "Uzbek (Latin)", "native_name": "O'zbek", "dir": "ltr"},
                    "vi": {"name": "Vietnamese", "native_name": "Tiếng Việt", "dir": "ltr"},
                    "cy": {"name": "Welsh", "native_name": "Cymraeg", "dir": "ltr"},
                    "yua": {"name": "Yucatec Maya", "native_name": "Màaya T'àan", "dir": "ltr"},
                    "zu": {"name": "Zulu", "native_name": "isiZulu", "dir": "ltr"}
                },
                "auto_detect_supported": True
            }