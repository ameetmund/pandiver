"""
Bank-Specific Pattern Manager
Enhanced pattern management with bank-specific templates and auto-detection
"""

import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, asdict
import logging

from enhanced_bank_parser_v2 import PatternRule, EnhancedPatternRuleManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class BankTemplate:
    """Bank-specific template with predefined patterns"""
    name: str
    country: str
    format_type: str
    common_headers: List[str]
    date_patterns: List[str]
    amount_patterns: List[str]
    detection_keywords: List[str]
    sample_pattern_rule: Optional[Dict[str, Any]] = None
    confidence_threshold: float = 0.4
    description: str = ""

class BankPatternManager(EnhancedPatternRuleManager):
    """Enhanced pattern manager with bank-specific features"""
    
    def __init__(self, storage_path: str = "bank_patterns.json"):
        super().__init__(storage_path)
        self.bank_templates = self._load_bank_templates()
        self.auto_detection_enabled = True
    
    def _load_bank_templates(self) -> Dict[str, BankTemplate]:
        """Load predefined bank templates"""
        templates = {}
        
        # Indian Banks
        templates["HDFC"] = BankTemplate(
            name="HDFC Bank",
            country="India",
            format_type="tabular",
            common_headers=["Date", "Narration", "Chq/Ref No.", "Value Date", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'\d+,?\d*\.\d{2}'],
            detection_keywords=["hdfc", "hdfc bank", "hdfc bank limited"],
            confidence_threshold=0.5,
            description="HDFC Bank statement with standard tabular format"
        )
        
        templates["ICICI"] = BankTemplate(
            name="ICICI Bank",
            country="India",
            format_type="tabular",
            common_headers=["Date", "Mode", "Particulars", "Deposits", "Withdrawals", "Balance"],
            date_patterns=[r'\d{2}-\d{2}-\d{4}'],
            amount_patterns=[r'\d+,?\d*\.\d{2}'],
            detection_keywords=["icici", "icici bank"],
            confidence_threshold=0.5,
            description="ICICI Bank statement with mode-based transactions"
        )
        
        templates["IDFC"] = BankTemplate(
            name="IDFC First Bank",
            country="India",
            format_type="tabular",
            common_headers=["Date and Time", "Transaction Details", "Withdrawals (INR)", "Deposits (INR)", "Balance (INR)"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'\d+,?\d*\.\d{2}'],
            detection_keywords=["idfc", "idfc first bank"],
            confidence_threshold=0.5,
            description="IDFC First Bank with timestamp-based transactions"
        )
        
        # US Banks
        templates["BANK_OF_AMERICA"] = BankTemplate(
            name="Bank of America",
            country="USA",
            format_type="sectioned",
            common_headers=["Date", "Description", "Amount", "Running Balance"],
            date_patterns=[r'\d{2}/\d{2}', r'\d{1,2}/\d{1,2}/\d{4}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["bank of america", "deposits and other credits", "withdrawals and debits"],
            confidence_threshold=0.4,
            description="Bank of America sectioned statement format"
        )
        
        templates["WELLS_FARGO"] = BankTemplate(
            name="Wells Fargo",
            country="USA",
            format_type="sectioned",
            common_headers=["Date", "Description", "Deposits/Credits", "Withdrawals/Debits", "Daily Balance"],
            date_patterns=[r'\d{2}/\d{2}', r'\d{1,2}/\d{1,2}/\d{4}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["wells fargo", "beginning balance", "ending balance"],
            confidence_threshold=0.4,
            description="Wells Fargo with daily balance tracking"
        )
        
        templates["CHASE"] = BankTemplate(
            name="Chase Bank",
            country="USA",
            format_type="tabular",
            common_headers=["Date", "Description", "Amount", "Balance"],
            date_patterns=[r'\d{2}/\d{2}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["chase", "jpmorgan chase"],
            confidence_threshold=0.5,
            description="Chase Bank tabular statement format"
        )
        
        # UK Banks
        templates["NATWEST"] = BankTemplate(
            name="NatWest",
            country="UK",
            format_type="tabular",
            common_headers=["Date", "Transaction Type", "Transaction Description", "Value", "Balance"],
            date_patterns=[r'\d{2} \w{3} \d{4}', r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'£\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["natwest", "national westminster bank"],
            confidence_threshold=0.5,
            description="NatWest UK standard statement format"
        )
        
        templates["BARCLAYS"] = BankTemplate(
            name="Barclays",
            country="UK",
            format_type="tabular",
            common_headers=["Date", "Reference", "Description", "Amount", "Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}', r'\d{2} \w{3} \d{4}'],
            amount_patterns=[r'£\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["barclays", "barclays bank"],
            confidence_threshold=0.5,
            description="Barclays UK statement with reference numbers"
        )
        
        templates["LLOYDS"] = BankTemplate(
            name="Lloyds Bank",
            country="UK",
            format_type="tabular",
            common_headers=["Date", "Transaction", "Money Out", "Money In", "Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'£\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["lloyds", "lloyds bank"],
            confidence_threshold=0.5,
            description="Lloyds Bank with money in/out format"
        )
        
        # Australian Banks
        templates["COMMONWEALTH"] = BankTemplate(
            name="Commonwealth Bank",
            country="Australia",
            format_type="list_format",
            common_headers=["Date", "Description", "Debit", "Credit", "Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["commonwealth bank", "commbank"],
            confidence_threshold=0.4,
            description="Commonwealth Bank Australia list format"
        )
        
        templates["ANZ"] = BankTemplate(
            name="ANZ Bank",
            country="Australia",
            format_type="tabular",
            common_headers=["Date", "Description", "Debit", "Credit", "Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["anz", "anz bank"],
            confidence_threshold=0.5,
            description="ANZ Bank Australia tabular format"
        )
        
        templates["NAB"] = BankTemplate(
            name="National Australia Bank",
            country="Australia",
            format_type="tabular",
            common_headers=["Date", "Description", "Debit", "Credit", "Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["nab", "national australia bank"],
            confidence_threshold=0.5,
            description="NAB Australia standard format"
        )
        
        templates["WESTPAC"] = BankTemplate(
            name="Westpac",
            country="Australia",
            format_type="tabular",
            common_headers=["Date", "Narrative", "Debit", "Credit", "Balance"],
            date_patterns=[r'\d{2}/\d{2}/\d{4}'],
            amount_patterns=[r'\$\d+\.\d{2}', r'\d+\.\d{2}'],
            detection_keywords=["westpac", "westpac banking corporation"],
            confidence_threshold=0.5,
            description="Westpac Australia with narrative field"
        )
        
        return templates
    
    def detect_bank_from_text(self, pdf_text: str) -> Optional[BankTemplate]:
        """Detect bank from PDF text content"""
        if not pdf_text:
            return None
        
        text_lower = pdf_text.lower()
        
        # Score each bank template
        bank_scores = {}
        
        for bank_id, template in self.bank_templates.items():
            score = 0
            
            # Check detection keywords
            for keyword in template.detection_keywords:
                if keyword.lower() in text_lower:
                    score += 10
            
            # Check header keywords
            for header in template.common_headers:
                header_words = header.lower().split()
                for word in header_words:
                    if len(word) > 3 and word in text_lower:  # Skip short words
                        score += 2
            
            # Check date patterns
            import re
            for pattern in template.date_patterns:
                matches = len(re.findall(pattern, pdf_text))
                score += min(matches, 5)  # Cap at 5 points
            
            if score > 0:
                bank_scores[bank_id] = score
        
        if not bank_scores:
            return None
        
        # Return the bank with highest score
        best_bank_id = max(bank_scores.items(), key=lambda x: x[1])[0]
        best_score = bank_scores[best_bank_id]
        
        logger.info(f"Bank detection: {best_bank_id} (score: {best_score})")
        
        # Require minimum score for confidence
        if best_score >= 10:
            return self.bank_templates[best_bank_id]
        
        return None
    
    def create_pattern_from_template(self, bank_template: BankTemplate, custom_headers: Optional[List[str]] = None) -> PatternRule:
        """Create a pattern rule from bank template"""
        headers = custom_headers or bank_template.common_headers
        
        # Choose appropriate date pattern
        date_pattern = bank_template.date_patterns[0] if bank_template.date_patterns else r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
        
        # Determine layout mode based on format type
        layout_mode_map = {
            "tabular": "table",
            "sectioned": "sectioned",
            "text_based": "text-aligned",
            "list_format": "text-aligned"
        }
        
        layout_mode = layout_mode_map.get(bank_template.format_type, "text-aligned")
        
        pattern_rule = PatternRule(
            column_count=len(headers),
            header_keywords=headers,
            row_gap_tolerance=8.0 if bank_template.format_type == "tabular" else 12.0,
            font_size_range=(8.0, 14.0),
            first_column_pattern=date_pattern,
            layout_mode=layout_mode,
            header_positions=[(i * 120, (i + 1) * 120) for i in range(len(headers))],
            row_height=15.0 if bank_template.format_type == "tabular" else 18.0,
            format_type=bank_template.format_type
        )
        
        return pattern_rule
    
    def save_bank_pattern(self, bank_name: str, pattern_rule: PatternRule, pdf_text: str = "", custom_name: str = "") -> bool:
        """Save a pattern rule with bank-specific metadata"""
        
        # Auto-detect bank if not provided
        detected_bank = None
        if pdf_text and self.auto_detection_enabled:
            detected_bank = self.detect_bank_from_text(pdf_text)
        
        # Generate pattern name
        if custom_name:
            pattern_name = custom_name
        elif detected_bank:
            pattern_name = f"{detected_bank.name}_custom_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        else:
            pattern_name = f"{bank_name}_pattern_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Enhanced metadata
        bank_info = bank_name
        if detected_bank:
            bank_info = f"{detected_bank.name} ({detected_bank.country})"
        
        success = self.save_pattern(pattern_name, pattern_rule, bank_info)
        
        if success:
            logger.info(f"✅ Saved bank pattern: {pattern_name} for {bank_info}")
        
        return success
    
    def get_patterns_by_bank(self, bank_name: str) -> List[Dict[str, Any]]:
        """Get all patterns for a specific bank"""
        all_patterns = self.list_patterns()
        
        bank_patterns = []
        for pattern in all_patterns:
            if pattern.get('bank_name') and bank_name.lower() in pattern['bank_name'].lower():
                bank_patterns.append(pattern)
        
        return bank_patterns
    
    def get_bank_templates(self) -> Dict[str, Dict[str, Any]]:
        """Get all available bank templates"""
        return {
            bank_id: {
                "name": template.name,
                "country": template.country,
                "format_type": template.format_type,
                "headers": template.common_headers,
                "description": template.description,
                "confidence_threshold": template.confidence_threshold
            }
            for bank_id, template in self.bank_templates.items()
        }
    
    def suggest_pattern_for_bank(self, bank_text: str) -> Optional[PatternRule]:
        """Suggest a pattern rule based on detected bank"""
        detected_bank = self.detect_bank_from_text(bank_text)
        
        if detected_bank:
            return self.create_pattern_from_template(detected_bank)
        
        return None
    
    def export_bank_patterns(self, output_file: str = "bank_patterns_export.json") -> bool:
        """Export all bank patterns to a file"""
        try:
            export_data = {
                "exported_at": datetime.now().isoformat(),
                "version": "2.0",
                "templates": self.get_bank_templates(),
                "saved_patterns": self.list_patterns()
            }
            
            with open(output_file, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"✅ Exported bank patterns to {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error exporting bank patterns: {str(e)}")
            return False
    
    def import_bank_patterns(self, input_file: str) -> bool:
        """Import bank patterns from a file"""
        try:
            if not os.path.exists(input_file):
                logger.error(f"Import file not found: {input_file}")
                return False
            
            with open(input_file, 'r') as f:
                import_data = json.load(f)
            
            imported_patterns = import_data.get('saved_patterns', [])
            
            # Import each pattern
            imported_count = 0
            for pattern_data in imported_patterns:
                try:
                    # Create PatternRule from data
                    pattern_rule = PatternRule(
                        column_count=pattern_data['column_count'],
                        header_keywords=pattern_data['header_keywords'],
                        row_gap_tolerance=pattern_data['row_gap_tolerance'],
                        font_size_range=tuple(pattern_data['font_size_range']),
                        first_column_pattern=pattern_data['first_column_pattern'],
                        layout_mode=pattern_data['layout_mode'],
                        header_positions=[(pos[0], pos[1]) for pos in pattern_data['header_positions']],
                        row_height=pattern_data['row_height'],
                        format_type=pattern_data.get('format_type', 'tabular')
                    )
                    
                    # Save imported pattern
                    pattern_name = f"imported_{pattern_data['name']}"
                    bank_name = pattern_data.get('bank_name', 'Unknown')
                    
                    if self.save_pattern(pattern_name, pattern_rule, bank_name):
                        imported_count += 1
                        
                except Exception as e:
                    logger.error(f"Error importing pattern {pattern_data.get('name', 'unknown')}: {str(e)}")
                    continue
            
            logger.info(f"✅ Imported {imported_count} bank patterns from {input_file}")
            return imported_count > 0
            
        except Exception as e:
            logger.error(f"❌ Error importing bank patterns: {str(e)}")
            return False
    
    def get_pattern_statistics(self) -> Dict[str, Any]:
        """Get statistics about saved patterns"""
        all_patterns = self.list_patterns()
        
        stats = {
            "total_patterns": len(all_patterns),
            "patterns_by_bank": {},
            "patterns_by_country": {},
            "patterns_by_format": {},
            "templates_available": len(self.bank_templates)
        }
        
        for pattern in all_patterns:
            bank_name = pattern.get('bank_name', 'Unknown')
            format_type = pattern.get('format_type', 'unknown')
            
            # Count by bank
            stats["patterns_by_bank"][bank_name] = stats["patterns_by_bank"].get(bank_name, 0) + 1
            
            # Count by format
            stats["patterns_by_format"][format_type] = stats["patterns_by_format"].get(format_type, 0) + 1
            
            # Count by country (from templates)
            for template in self.bank_templates.values():
                if template.name.lower() in bank_name.lower():
                    country = template.country
                    stats["patterns_by_country"][country] = stats["patterns_by_country"].get(country, 0) + 1
                    break
        
        return stats