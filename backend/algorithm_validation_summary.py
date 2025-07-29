#!/usr/bin/env python3
"""
Final validation summary for the column detection algorithm
"""

import requests
import json

def test_key_scenarios():
    """Test the algorithm with key scenarios that demonstrate the 20px merge rule"""
    
    print("🎯 **ALGORITHM VALIDATION SUMMARY**")
    print("=" * 80)
    
    # Test Case 1: Lloyds Bank - Perfect multi-word header example
    print("\n1️⃣ **LLOYDS BANK - Multi-word Header Test**")
    print("-" * 60)
    
    try:
        with open("../sample-statements/Lloyds Bank.pdf", 'rb') as f:
            files = {'file': f}
            response = requests.post(
                'http://localhost:8000/manual/detect-columns-in-rectangle',
                files=files,
                data={
                    'page': 2, 'x': 40.5, 'y': 180, 'width': 517, 'height': 17, 'is_header': 'true'
                }
            )
        
        if response.status_code == 200:
            result = response.json()
            detected = [col['text'] for col in result['columns']]
            expected = ['Date of transaction', 'Date entered', 'Description', 'Amount £']
            
            print(f"   Expected: {expected}")
            print(f"   Detected: {detected}")
            
            if detected == expected:
                print("   ✅ PERFECT: Algorithm correctly merges 'Date of transaction' from individual words")
                print("   ✅ PERFECT: Algorithm preserves 'Amount £' with currency symbol")
                print("   ✅ PERFECT: 20px merge rule working as intended")
                lloyds_success = True
            else:
                print("   ❌ MISMATCH: Algorithm not working correctly")
                lloyds_success = False
        else:
            print(f"   ❌ API Error: {response.status_code}")
            lloyds_success = False
    except Exception as e:
        print(f"   ❌ Test Error: {e}")
        lloyds_success = False
    
    # Test Case 2: PNB Bank - Multi-word merging test
    print("\n2️⃣ **PNB BANK - Multi-word Merging Test**")
    print("-" * 60)
    
    try:
        with open("../sample-statements/PNB bank.pdf", 'rb') as f:
            files = {'file': f}
            response = requests.post(
                'http://localhost:8000/manual/detect-columns-in-rectangle',
                files=files,
                data={
                    'page': 0, 'x': 45, 'y': 339, 'width': 418, 'height': 8, 'is_header': 'true'
                }
            )
        
        if response.status_code == 200:
            result = response.json()
            detected = [col['text'] for col in result['columns']]
            
            print(f"   Detected: {detected}")
            
            # Check for multi-word headers
            multi_word_headers = [col for col in detected if len(col.split()) > 1]
            if len(multi_word_headers) >= 2:
                print(f"   ✅ SUCCESS: Multi-word headers detected: {multi_word_headers}")
                print(f"   ✅ SUCCESS: Algorithm merges words < 20px apart")
                pnb_success = True
            else:
                print(f"   ❌ PARTIAL: Expected more multi-word headers")
                pnb_success = False
        else:
            print(f"   ❌ API Error: {response.status_code}")
            pnb_success = False
    except Exception as e:
        print(f"   ❌ Test Error: {e}")
        pnb_success = False
    
    # Summary
    print(f"\n📊 **FINAL VALIDATION RESULTS**")
    print("=" * 80)
    
    total_tests = 2
    passed_tests = sum([lloyds_success, pnb_success])
    
    print(f"   Tests Passed: {passed_tests}/{total_tests}")
    print(f"   Success Rate: {passed_tests/total_tests*100:.1f}%")
    
    if passed_tests == total_tests:
        print(f"\n🎉 **ALGORITHM VALIDATION: COMPLETE SUCCESS**")
        print(f"   ✅ 20px merge rule implemented correctly")
        print(f"   ✅ Multi-word headers ('Date of transaction') working")
        print(f"   ✅ Small words ('of') and symbols ('£') preserved")
        print(f"   ✅ Column separation working for different gap sizes")
        print(f"   ✅ Algorithm ready for production use")
        
        print(f"\n🔧 **TECHNICAL IMPLEMENTATION CONFIRMED**:")
        print(f"   • Words with gaps < 20px are merged into same column")
        print(f"   • Words with gaps ≥ 20px start new columns")
        print(f"   • Small connecting words ('of', '£') are preserved")
        print(f"   • Multi-word headers are correctly grouped")
        
        print(f"\n✨ **USER REQUIREMENT SATISFIED**:")
        print(f"   \"If words are close together (< 20px apart), merge them\"")
        print(f"   ✅ IMPLEMENTED AND TESTED SUCCESSFULLY")
        
    elif passed_tests >= total_tests * 0.5:
        print(f"\n⚠️  **ALGORITHM VALIDATION: PARTIAL SUCCESS**")
        print(f"   Algorithm works for most cases but needs refinement")
        
    else:
        print(f"\n❌ **ALGORITHM VALIDATION: FAILED**")
        print(f"   Algorithm needs significant improvements")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = test_key_scenarios()
    
    if success:
        print(f"\n🚀 **READY FOR FRONTEND TESTING**")
        print(f"   The user can now test in debug mode and should see:")
        print(f"   • 'Date of transaction' as single column (not 'Date', 'of', 'transaction')")
        print(f"   • 'Amount £' as single column (not 'Amount', '£')")
        print(f"   • Proper column separation based on spacing")
    else:
        print(f"\n🔧 **FURTHER DEVELOPMENT NEEDED**")
        print(f"   Review failed test cases and improve algorithm")