"""
Transaction Display and Adjustment Interface
Provides interactive interface for viewing and adjusting extracted transaction data
"""

import streamlit as st
import pandas as pd
import json
import os
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import plotly.express as px
import plotly.graph_objects as go
from dataclasses import asdict

from pattern_rule_applicator import PatternRuleApplicator, ExtractionResult
from enhanced_bank_parser_v2 import EnhancedTransactionDetector, PatternRule, EnhancedPatternRuleManager
from bank_pattern_manager import BankPatternManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TransactionDisplayInterface:
    """Interactive interface for displaying and adjusting transaction extraction results"""
    
    def __init__(self):
        self.applicator = PatternRuleApplicator()
        self.detector = EnhancedTransactionDetector()
        self.pattern_manager = BankPatternManager()  # Use enhanced bank pattern manager
        
        # Initialize session state
        if 'extraction_results' not in st.session_state:
            st.session_state.extraction_results = {}
        if 'current_pdf_path' not in st.session_state:
            st.session_state.current_pdf_path = None
        if 'current_pattern_rule' not in st.session_state:
            st.session_state.current_pattern_rule = None
        if 'adjusted_transactions' not in st.session_state:
            st.session_state.adjusted_transactions = []
    
    def run_interface(self):
        """Main interface runner"""
        st.set_page_config(
            page_title="Banking Statement Transaction Extractor",
            page_icon="💳",
            layout="wide"
        )
        
        st.title("💳 Banking Statement Transaction Extractor")
        st.markdown("---")
        
        # Sidebar for file selection and configuration
        self._render_sidebar()
        
        # Main content area
        if st.session_state.current_pdf_path:
            self._render_main_content()
        else:
            self._render_welcome_screen()
    
    def _render_sidebar(self):
        """Render the sidebar with file selection and options"""
        st.sidebar.header("📁 File Selection")
        
        # PDF file uploader
        uploaded_file = st.sidebar.file_uploader(
            "Upload Bank Statement PDF",
            type=['pdf'],
            help="Upload a PDF bank statement for transaction extraction"
        )
        
        if uploaded_file:
            # Save uploaded file temporarily
            temp_path = f"/tmp/{uploaded_file.name}"
            with open(temp_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
            st.session_state.current_pdf_path = temp_path
            st.sidebar.success(f"✅ Loaded: {uploaded_file.name}")
        
        # Sample statements directory browser
        st.sidebar.subheader("📋 Sample Statements")
        sample_dir = "/Users/ameetmund/Tech/Project/pandiver-new.git/pandiver-new/sample-statements"
        
        if os.path.exists(sample_dir):
            sample_files = [f for f in os.listdir(sample_dir) if f.endswith('.pdf')]
            
            if sample_files:
                selected_sample = st.sidebar.selectbox(
                    "Select Sample Statement",
                    ["None"] + sample_files,
                    help="Choose from pre-loaded sample bank statements"
                )
                
                if selected_sample != "None":
                    st.session_state.current_pdf_path = os.path.join(sample_dir, selected_sample)
                    st.sidebar.success(f"✅ Selected: {selected_sample}")
        
        # Extraction settings
        st.sidebar.subheader("⚙️ Extraction Settings")
        
        confidence_threshold = st.sidebar.slider(
            "Detection Confidence Threshold",
            min_value=0.1,
            max_value=1.0,
            value=0.4,
            step=0.05,
            help="Lower values detect more pages but may include false positives"
        )
        
        max_pages = st.sidebar.number_input(
            "Maximum Pages to Process",
            min_value=1,
            max_value=100,
            value=50,
            help="Limit processing to first N pages"
        )
        
        # Saved patterns
        st.sidebar.subheader("💾 Saved Patterns")
        saved_patterns = self.pattern_manager.list_patterns()
        
        if saved_patterns:
            pattern_names = [p['name'] for p in saved_patterns]
            selected_pattern = st.sidebar.selectbox(
                "Load Saved Pattern",
                ["None"] + pattern_names,
                help="Apply a previously saved extraction pattern"
            )
            
            if selected_pattern != "None":
                loaded_pattern = self.pattern_manager.get_pattern(selected_pattern)
                if loaded_pattern:
                    st.session_state.current_pattern_rule = loaded_pattern
                    st.sidebar.success(f"✅ Loaded pattern: {selected_pattern}")
        
        # Bank templates
        st.sidebar.subheader("🏦 Bank Templates")
        bank_templates = self.pattern_manager.get_bank_templates()
        
        if bank_templates:
            template_options = ["None"] + [f"{template['name']} ({template['country']})" for template in bank_templates.values()]
            selected_template = st.sidebar.selectbox(
                "Use Bank Template",
                template_options,
                help="Apply a predefined bank template"
            )
            
            if selected_template != "None":
                # Find the template by name
                for bank_id, template in bank_templates.items():
                    template_display = f"{template['name']} ({template['country']})"
                    if template_display == selected_template:
                        # Create pattern from template
                        bank_template_obj = self.pattern_manager.bank_templates[bank_id]
                        pattern_rule = self.pattern_manager.create_pattern_from_template(bank_template_obj)
                        st.session_state.current_pattern_rule = pattern_rule
                        st.sidebar.success(f"✅ Loaded template: {template['name']}")
                        st.sidebar.info(f"Format: {template['format_type']}")
                        break
    
    def _render_welcome_screen(self):
        """Render welcome screen when no PDF is selected"""
        col1, col2, col3 = st.columns([1, 2, 1])
        
        with col2:
            st.markdown("""
            ## Welcome to the Banking Statement Extractor! 👋
            
            ### Getting Started:
            1. **Upload a PDF** using the file uploader in the sidebar
            2. **Or select** a sample statement from the dropdown
            3. **Configure** extraction settings if needed
            4. **View and adjust** extracted transaction data
            
            ### Features:
            - 🔍 **Smart Detection**: Automatically detects transaction tables
            - 🌍 **International Support**: Works with banks worldwide
            - ⚙️ **Adjustable Patterns**: Fine-tune extraction rules
            - 📊 **Visual Analytics**: Charts and statistics
            - 💾 **Save Patterns**: Reuse successful extraction rules
            - 📤 **Export Data**: CSV, JSON, Excel formats
            
            ### Supported Bank Formats:
            - **Tabular**: Traditional table-based statements
            - **Text-based**: Text-aligned transaction lists
            - **Sectioned**: US-style categorized statements
            - **List format**: Australian-style simple lists
            """)
    
    def _render_main_content(self):
        """Render main content when PDF is selected"""
        pdf_name = os.path.basename(st.session_state.current_pdf_path)
        st.header(f"📄 Processing: {pdf_name}")
        
        # Main tabs
        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "🔍 Extract Data", "📊 View Results", "⚙️ Adjust Patterns", 
            "📈 Analytics", "💾 Export & Save"
        ])
        
        with tab1:
            self._render_extraction_tab()
        
        with tab2:
            self._render_results_tab()
        
        with tab3:
            self._render_adjustment_tab()
        
        with tab4:
            self._render_analytics_tab()
        
        with tab5:
            self._render_export_tab()
    
    def _render_extraction_tab(self):
        """Render the data extraction tab"""
        st.subheader("🔍 Extract Transaction Data")
        
        col1, col2 = st.columns([3, 1])
        
        with col1:
            st.info("Click 'Extract Transactions' to analyze the PDF and extract transaction data")
        
        with col2:
            if st.button("🚀 Extract Transactions", type="primary", use_container_width=True):
                self._run_extraction()
        
        # Show extraction progress and results
        if st.session_state.current_pdf_path in st.session_state.extraction_results:
            result = st.session_state.extraction_results[st.session_state.current_pdf_path]
            self._display_extraction_summary(result)
    
    def _run_extraction(self):
        """Run the transaction extraction process"""
        pdf_path = st.session_state.current_pdf_path
        
        with st.spinner("🔄 Analyzing PDF and extracting transactions..."):
            try:
                # Try to detect bank from PDF first
                with open(pdf_path, 'rb') as f:
                    import pdfplumber
                    with pdfplumber.open(f) as pdf:
                        first_page_text = pdf.pages[0].extract_text() if pdf.pages else ""
                
                detected_bank = self.pattern_manager.detect_bank_from_text(first_page_text)
                
                if detected_bank:
                    st.info(f"🏦 Detected bank: {detected_bank.name} ({detected_bank.country})")
                    
                    # Option to use detected bank template
                    use_template = st.checkbox(f"Use {detected_bank.name} template", value=True)
                    
                    if use_template:
                        # Create pattern from template
                        template_pattern = self.pattern_manager.create_pattern_from_template(detected_bank)
                        st.session_state.current_pattern_rule = template_pattern
                        st.success(f"✅ Using {detected_bank.name} template")
                
                # Run the complete extraction workflow
                result = self.applicator.generate_and_apply_pattern_rule(pdf_path)
                
                # Store results in session state
                st.session_state.extraction_results[pdf_path] = result
                st.session_state.current_pattern_rule = result.pattern_rule_used
                st.session_state.adjusted_transactions = result.transactions.copy()
                
                if result.success:
                    st.success(f"✅ Successfully extracted {result.total_transactions} transactions!")
                    
                    # Auto-save successful pattern with bank detection
                    if detected_bank and result.total_transactions > 0:
                        auto_save = st.checkbox(f"Save pattern for {detected_bank.name}", value=False)
                        if auto_save:
                            pattern_name = f"{detected_bank.name}_auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                            success = self.pattern_manager.save_bank_pattern(
                                detected_bank.name, 
                                result.pattern_rule_used, 
                                first_page_text,
                                pattern_name
                            )
                            if success:
                                st.success(f"✅ Pattern saved: {pattern_name}")
                else:
                    st.error(f"❌ Extraction failed: {', '.join(result.errors)}")
                    
            except Exception as e:
                st.error(f"❌ Error during extraction: {str(e)}")
                logger.error(f"Extraction error: {str(e)}")
    
    def _display_extraction_summary(self, result: ExtractionResult):
        """Display summary of extraction results"""
        if not result.success:
            st.error("❌ Extraction failed")
            for error in result.errors:
                st.error(f"• {error}")
            return
        
        # Success metrics
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("📄 Total Transactions", result.total_transactions)
        
        with col2:
            st.metric("📑 Pages Processed", len(result.pages_processed))
        
        with col3:
            avg_per_page = result.extraction_summary.get('average_transactions_per_page', 0)
            st.metric("📊 Avg per Page", f"{avg_per_page:.1f}")
        
        with col4:
            format_type = result.pattern_rule_used.get('format_type', 'Unknown')
            st.metric("🎨 Format Type", format_type)
        
        # Pattern rule details
        st.subheader("📋 Pattern Rule Used")
        pattern_info = result.pattern_rule_used
        
        col1, col2 = st.columns(2)
        with col1:
            st.write("**Headers Detected:**")
            headers = pattern_info.get('headers', [])
            for i, header in enumerate(headers, 1):
                st.write(f"{i}. {header}")
        
        with col2:
            st.write("**Pattern Details:**")
            st.write(f"• **Columns:** {pattern_info.get('column_count', 'N/A')}")
            st.write(f"• **Layout:** {pattern_info.get('layout_mode', 'N/A')}")
            st.write(f"• **Date Pattern:** `{pattern_info.get('date_pattern', 'N/A')}`")
        
        # Pages processed
        st.subheader("📑 Pages with Transactions")
        if result.pages_processed:
            pages_text = ", ".join(map(str, result.pages_processed))
            st.write(f"**Pages:** {pages_text}")
        
        # Show sample transactions
        if result.transactions:
            st.subheader("📋 Sample Transactions")
            sample_df = pd.DataFrame(result.transactions[:5])  # Show first 5
            
            # Clean up the dataframe for display
            display_columns = [col for col in sample_df.columns if not col.startswith('_')]
            if display_columns:
                st.dataframe(sample_df[display_columns], use_container_width=True)
    
    def _render_results_tab(self):
        """Render the results viewing tab"""
        st.subheader("📊 Extracted Transaction Data")
        
        pdf_path = st.session_state.current_pdf_path
        if pdf_path not in st.session_state.extraction_results:
            st.info("👆 Please extract data first using the 'Extract Data' tab")
            return
        
        result = st.session_state.extraction_results[pdf_path]
        if not result.success:
            st.error("❌ No successful extraction results to display")
            return
        
        transactions = st.session_state.adjusted_transactions
        if not transactions:
            st.warning("⚠️ No transactions found")
            return
        
        # Create DataFrame
        df = pd.DataFrame(transactions)
        
        # Filter controls
        col1, col2, col3 = st.columns(3)
        
        with col1:
            # Page filter
            all_pages = sorted(list(set(df.get('_page_number', [1]).dropna())))
            selected_pages = st.multiselect(
                "Filter by Pages",
                all_pages,
                default=all_pages,
                help="Select specific pages to view"
            )
        
        with col2:
            # Date range filter (if date column exists)
            date_columns = [col for col in df.columns if 'date' in col.lower()]
            if date_columns:
                st.selectbox("Date Column", date_columns, key="date_filter_col")
        
        with col3:
            # Search filter
            search_term = st.text_input(
                "Search Transactions",
                placeholder="Search in all fields...",
                help="Search across all transaction fields"
            )
        
        # Apply filters
        filtered_df = df.copy()
        
        if selected_pages:
            if '_page_number' in filtered_df.columns:
                filtered_df = filtered_df[filtered_df['_page_number'].isin(selected_pages)]
        
        if search_term:
            mask = filtered_df.astype(str).apply(
                lambda x: x.str.contains(search_term, case=False, na=False)
            ).any(axis=1)
            filtered_df = filtered_df[mask]
        
        # Display results
        st.write(f"**Showing {len(filtered_df)} of {len(df)} transactions**")
        
        # Clean columns for display
        display_columns = [col for col in filtered_df.columns if not col.startswith('_')]
        if display_columns:
            st.dataframe(
                filtered_df[display_columns], 
                use_container_width=True,
                height=400
            )
        
        # Transaction details expander
        with st.expander("🔍 View Raw Transaction Data"):
            selected_row = st.number_input(
                "Select Row Number",
                min_value=0,
                max_value=len(filtered_df) - 1,
                value=0
            )
            
            if 0 <= selected_row < len(filtered_df):
                transaction = filtered_df.iloc[selected_row].to_dict()
                st.json(transaction)
    
    def _render_adjustment_tab(self):
        """Render pattern adjustment tab"""
        st.subheader("⚙️ Adjust Extraction Patterns")
        
        pdf_path = st.session_state.current_pdf_path
        if pdf_path not in st.session_state.extraction_results:
            st.info("👆 Please extract data first using the 'Extract Data' tab")
            return
        
        result = st.session_state.extraction_results[pdf_path]
        if not result.success:
            st.error("❌ No successful extraction results to adjust")
            return
        
        # Current pattern details
        st.subheader("📋 Current Pattern Rule")
        pattern_info = result.pattern_rule_used
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**Current Headers:**")
            current_headers = pattern_info.get('headers', [])
            for i, header in enumerate(current_headers):
                st.write(f"{i+1}. {header}")
        
        with col2:
            st.write("**Pattern Settings:**")
            st.write(f"• **Format:** {pattern_info.get('format_type', 'N/A')}")
            st.write(f"• **Layout:** {pattern_info.get('layout_mode', 'N/A')}")
            st.write(f"• **Columns:** {pattern_info.get('column_count', 'N/A')}")
        
        st.markdown("---")
        
        # Header adjustment
        st.subheader("📝 Adjust Headers")
        st.write("Modify the column headers used for extraction:")
        
        adjusted_headers = []
        for i, header in enumerate(current_headers):
            new_header = st.text_input(
                f"Header {i+1}",
                value=header,
                key=f"header_{i}"
            )
            adjusted_headers.append(new_header)
        
        # Add new header option
        col1, col2 = st.columns([3, 1])
        with col1:
            new_header = st.text_input("Add New Header", placeholder="Enter new header name")
        with col2:
            if st.button("➕ Add Header") and new_header:
                adjusted_headers.append(new_header)
                st.success(f"Added: {new_header}")
        
        # Pattern settings adjustment
        st.subheader("🎛️ Pattern Settings")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            layout_mode = st.selectbox(
                "Layout Mode",
                ["table", "text-aligned", "sectioned"],
                index=0
            )
        
        with col2:
            format_type = st.selectbox(
                "Format Type",
                ["tabular", "text_based", "sectioned", "list_format"],
                index=0
            )
        
        with col3:
            confidence_adjustment = st.slider(
                "Detection Sensitivity",
                min_value=0.1,
                max_value=1.0,
                value=0.4,
                step=0.05
            )
        
        # Apply adjustments
        col1, col2 = st.columns([1, 1])
        
        with col1:
            if st.button("🔄 Apply Adjustments", type="primary", use_container_width=True):
                self._apply_pattern_adjustments(adjusted_headers, layout_mode, format_type)
        
        with col2:
            pattern_name = st.text_input("Pattern Name", placeholder="my_custom_pattern")
            if st.button("💾 Save Pattern", use_container_width=True) and pattern_name:
                self._save_adjusted_pattern(pattern_name, adjusted_headers, layout_mode, format_type)
    
    def _apply_pattern_adjustments(self, headers: List[str], layout_mode: str, format_type: str):
        """Apply pattern rule adjustments and re-extract"""
        pdf_path = st.session_state.current_pdf_path
        
        with st.spinner("🔄 Applying adjustments and re-extracting..."):
            try:
                # Create adjusted pattern rule
                adjusted_pattern = PatternRule(
                    column_count=len(headers),
                    header_keywords=headers,
                    row_gap_tolerance=10.0,
                    font_size_range=(8.0, 14.0),
                    first_column_pattern=r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
                    layout_mode=layout_mode,
                    header_positions=[(i * 120, (i + 1) * 120) for i in range(len(headers))],
                    row_height=18.0,
                    format_type=format_type
                )
                
                # Re-extract with adjusted pattern
                result = self.applicator.generate_and_apply_pattern_rule(pdf_path)
                
                # Update session state
                st.session_state.extraction_results[pdf_path] = result
                st.session_state.adjusted_transactions = result.transactions.copy()
                
                if result.success:
                    st.success(f"✅ Re-extracted {result.total_transactions} transactions with adjusted pattern!")
                else:
                    st.error(f"❌ Re-extraction failed: {', '.join(result.errors)}")
                    
            except Exception as e:
                st.error(f"❌ Error applying adjustments: {str(e)}")
    
    def _save_adjusted_pattern(self, name: str, headers: List[str], layout_mode: str, format_type: str):
        """Save the adjusted pattern rule"""
        try:
            # Create pattern rule
            pattern_rule = PatternRule(
                column_count=len(headers),
                header_keywords=headers,
                row_gap_tolerance=10.0,
                font_size_range=(8.0, 14.0),
                first_column_pattern=r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
                layout_mode=layout_mode,
                header_positions=[(i * 120, (i + 1) * 120) for i in range(len(headers))],
                row_height=18.0,
                format_type=format_type
            )
            
            # Extract bank name from PDF filename
            pdf_name = os.path.basename(st.session_state.current_pdf_path)
            bank_name = pdf_name.replace('.pdf', '').replace('_', ' ').title()
            
            # Save pattern
            success = self.pattern_manager.save_pattern(name, pattern_rule, bank_name)
            
            if success:
                st.success(f"✅ Pattern '{name}' saved successfully!")
            else:
                st.error(f"❌ Failed to save pattern '{name}'")
                
        except Exception as e:
            st.error(f"❌ Error saving pattern: {str(e)}")
    
    def _render_analytics_tab(self):
        """Render analytics and visualization tab"""
        st.subheader("📈 Transaction Analytics")
        
        pdf_path = st.session_state.current_pdf_path
        if pdf_path not in st.session_state.extraction_results:
            st.info("👆 Please extract data first using the 'Extract Data' tab")
            return
        
        result = st.session_state.extraction_results[pdf_path]
        if not result.success or not result.transactions:
            st.error("❌ No transaction data available for analytics")
            return
        
        transactions = st.session_state.adjusted_transactions
        df = pd.DataFrame(transactions)
        
        # Analytics metrics
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("📊 Total Transactions", len(df))
        
        with col2:
            pages_with_data = len(set(df.get('_page_number', [1]).dropna()))
            st.metric("📑 Pages with Data", pages_with_data)
        
        with col3:
            avg_per_page = len(df) / max(pages_with_data, 1)
            st.metric("📈 Avg per Page", f"{avg_per_page:.1f}")
        
        with col4:
            extraction_method = result.pattern_rule_used.get('layout_mode', 'Unknown')
            st.metric("🎨 Method", extraction_method)
        
        # Page distribution chart
        if '_page_number' in df.columns:
            st.subheader("📊 Transactions per Page")
            page_counts = df['_page_number'].value_counts().sort_index()
            
            fig = px.bar(
                x=page_counts.index,
                y=page_counts.values,
                labels={'x': 'Page Number', 'y': 'Transaction Count'},
                title="Distribution of Transactions Across Pages"
            )
            st.plotly_chart(fig, use_container_width=True)
        
        # Field completeness analysis
        st.subheader("📋 Field Completeness Analysis")
        
        # Get headers excluding internal fields
        headers = [col for col in df.columns if not col.startswith('_')]
        
        if headers:
            completeness_data = []
            for header in headers:
                non_empty = df[header].astype(str).str.strip().ne('').sum()
                completeness = (non_empty / len(df)) * 100
                completeness_data.append({
                    'Field': header,
                    'Completeness': completeness,
                    'Non-Empty Count': non_empty,
                    'Total Count': len(df)
                })
            
            completeness_df = pd.DataFrame(completeness_data)
            
            # Completeness chart
            fig = px.bar(
                completeness_df,
                x='Field',
                y='Completeness',
                title="Field Completeness Percentage",
                labels={'Completeness': 'Completeness (%)'}
            )
            fig.update_layout(xaxis_tickangle=-45)
            st.plotly_chart(fig, use_container_width=True)
            
            # Completeness table
            st.dataframe(completeness_df, use_container_width=True)
        
        # Data quality insights
        st.subheader("🔍 Data Quality Insights")
        
        insights = []
        
        # Check for potential duplicates
        duplicate_count = df.duplicated().sum()
        if duplicate_count > 0:
            insights.append(f"⚠️ Found {duplicate_count} potential duplicate transactions")
        
        # Check for empty transactions
        empty_count = df.apply(lambda row: all(str(val).strip() == '' for val in row if not str(val).startswith('_')), axis=1).sum()
        if empty_count > 0:
            insights.append(f"⚠️ Found {empty_count} transactions with all empty fields")
        
        # Check field consistency
        for header in headers:
            unique_formats = df[header].astype(str).str.extract(r'(\d+[.,]\d{2})').dropna()
            if len(unique_formats) > 0:
                insights.append(f"💰 '{header}' appears to contain monetary values")
        
        if insights:
            for insight in insights:
                st.write(insight)
        else:
            st.success("✅ No data quality issues detected!")
    
    def _render_export_tab(self):
        """Render export and save tab"""
        st.subheader("💾 Export & Save Results")
        
        pdf_path = st.session_state.current_pdf_path
        if pdf_path not in st.session_state.extraction_results:
            st.info("👆 Please extract data first using the 'Extract Data' tab")
            return
        
        result = st.session_state.extraction_results[pdf_path]
        if not result.success or not result.transactions:
            st.error("❌ No transaction data available for export")
            return
        
        transactions = st.session_state.adjusted_transactions
        df = pd.DataFrame(transactions)
        
        # Clean dataframe for export
        export_df = df[[col for col in df.columns if not col.startswith('_')]]
        
        st.write(f"**Ready to export {len(export_df)} transactions**")
        
        # Export format selection
        col1, col2 = st.columns(2)
        
        with col1:
            export_format = st.selectbox(
                "Export Format",
                ["CSV", "JSON", "Excel"],
                help="Choose the format for exported data"
            )
        
        with col2:
            include_metadata = st.checkbox(
                "Include Metadata",
                value=True,
                help="Include extraction metadata in export"
            )
        
        # Generate export data
        if export_format == "CSV":
            export_data = export_df.to_csv(index=False)
            filename = f"transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            mime_type = "text/csv"
        
        elif export_format == "JSON":
            export_data = export_df.to_json(orient='records', indent=2)
            filename = f"transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            mime_type = "application/json"
        
        elif export_format == "Excel":
            from io import BytesIO
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
                export_df.to_excel(writer, sheet_name='Transactions', index=False)
                
                if include_metadata:
                    # Add metadata sheet
                    metadata_df = pd.DataFrame([
                        ['Total Transactions', len(export_df)],
                        ['Pages Processed', len(result.pages_processed)],
                        ['Format Type', result.pattern_rule_used.get('format_type', 'N/A')],
                        ['Layout Mode', result.pattern_rule_used.get('layout_mode', 'N/A')],
                        ['Headers', ', '.join(result.pattern_rule_used.get('headers', []))],
                        ['Extraction Date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')]
                    ], columns=['Metric', 'Value'])
                    metadata_df.to_excel(writer, sheet_name='Metadata', index=False)
            
            export_data = buffer.getvalue()
            filename = f"transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
        # Download button
        st.download_button(
            label=f"📥 Download {export_format}",
            data=export_data,
            file_name=filename,
            mime=mime_type,
            type="primary",
            use_container_width=True
        )
        
        # Export preview
        with st.expander("👀 Preview Export Data"):
            if export_format in ["CSV", "JSON"]:
                st.text_area("Export Preview", export_data[:1000] + "..." if len(export_data) > 1000 else export_data, height=200)
            else:
                st.dataframe(export_df.head(10), use_container_width=True)
        
        # Save extraction results
        st.subheader("💾 Save Extraction Session")
        
        col1, col2 = st.columns(2)
        
        with col1:
            session_name = st.text_input(
                "Session Name",
                value=f"extraction_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                help="Name for this extraction session"
            )
        
        with col2:
            if st.button("💾 Save Session", use_container_width=True):
                self._save_extraction_session(session_name, result)
        
        # Extraction statistics
        st.subheader("📊 Extraction Statistics")
        
        stats = self.applicator.get_extraction_statistics(result)
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.json({
                "total_transactions": stats.get('total_transactions', 0),
                "pages_processed": stats.get('pages_processed', 0),
                "extraction_method": stats.get('extraction_method', 'Unknown'),
                "format_type": stats.get('format_type', 'Unknown')
            })
        
        with col2:
            if 'field_completeness' in stats:
                completeness_df = pd.DataFrame([
                    {
                        'Field': field,
                        'Completion Rate': f"{data['completion_rate']:.1f}%",
                        'Non-Empty Values': data['total_values']
                    }
                    for field, data in stats['field_completeness'].items()
                ])
                st.dataframe(completeness_df, use_container_width=True)
        
        # Bank pattern statistics
        st.subheader("🏦 Bank Pattern Statistics")
        
        pattern_stats = self.pattern_manager.get_pattern_statistics()
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("Total Patterns", pattern_stats['total_patterns'])
            st.metric("Bank Templates", pattern_stats['templates_available'])
        
        with col2:
            st.write("**Patterns by Bank:**")
            for bank, count in list(pattern_stats['patterns_by_bank'].items())[:5]:
                st.write(f"• {bank}: {count}")
        
        with col3:
            st.write("**Patterns by Format:**")
            for format_type, count in pattern_stats['patterns_by_format'].items():
                st.write(f"• {format_type}: {count}")
        
        # Export/Import bank patterns
        st.subheader("🔄 Pattern Management")
        
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("📤 Export All Patterns", use_container_width=True):
                export_file = f"bank_patterns_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                success = self.pattern_manager.export_bank_patterns(export_file)
                if success:
                    st.success(f"✅ Patterns exported to {export_file}")
                    # Provide download link
                    if os.path.exists(export_file):
                        with open(export_file, 'rb') as f:
                            st.download_button(
                                "📥 Download Export File",
                                f.read(),
                                export_file,
                                "application/json"
                            )
                else:
                    st.error("❌ Export failed")
        
        with col2:
            uploaded_patterns = st.file_uploader(
                "📥 Import Patterns",
                type=['json'],
                help="Import previously exported pattern files"
            )
            
            if uploaded_patterns:
                # Save uploaded file temporarily
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp_file:
                    tmp_file.write(uploaded_patterns.getbuffer())
                    tmp_file_path = tmp_file.name
                
                try:
                    success = self.pattern_manager.import_bank_patterns(tmp_file_path)
                    if success:
                        st.success("✅ Patterns imported successfully!")
                        st.rerun()  # Refresh to show new patterns
                    else:
                        st.error("❌ Import failed")
                finally:
                    os.unlink(tmp_file_path)
    
    def _save_extraction_session(self, session_name: str, result: ExtractionResult):
        """Save complete extraction session"""
        try:
            session_data = {
                'session_name': session_name,
                'pdf_path': st.session_state.current_pdf_path,
                'extraction_timestamp': datetime.now().isoformat(),
                'success': result.success,
                'total_transactions': result.total_transactions,
                'pages_processed': result.pages_processed,
                'pattern_rule_used': result.pattern_rule_used,
                'extraction_summary': result.extraction_summary,
                'transactions': result.transactions,
                'errors': result.errors
            }
            
            # Save to file
            sessions_dir = "/tmp/extraction_sessions"
            os.makedirs(sessions_dir, exist_ok=True)
            
            session_file = os.path.join(sessions_dir, f"{session_name}.json")
            with open(session_file, 'w') as f:
                json.dump(session_data, f, indent=2, default=str)
            
            st.success(f"✅ Session saved as: {session_file}")
            
        except Exception as e:
            st.error(f"❌ Error saving session: {str(e)}")


def main():
    """Main function to run the Streamlit interface"""
    interface = TransactionDisplayInterface()
    interface.run_interface()


if __name__ == "__main__":
    main()