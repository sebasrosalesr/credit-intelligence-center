#!/usr/bin/env python3
"""
Simple test script for CSV validation functionality.
Tests the backend validation for uploaded CSV data.
"""

import requests
import json
import sys
from pathlib import Path

# Test cases for validation
test_cases = [
    {
        "name": "Valid minimal CSV",
        "data": [
            {
                "Date": "2025-01-20",
                "Customer Number": "CUST001",
                "Invoice Number": "INV001234",
                "Item Number": "12345",
                "Credit Request Total": "100.00",
                "Credit Type": "Credit Memo",
                "Ticket Number": "TKT001"
            }
        ],
        "should_pass": True
    },
    {
        "name": "Missing required fields",
        "data": [
            {
                "Date": "2025-01-20",
                "Invoice Number": "INV001234",
                "Item Number": "12345",
            }
        ],
        "should_pass": False
    },
    {
        "name": "Invalid data types",
        "data": [
            {
                "Date": "2025-01-20",
                "Customer Number": "CUST001",
                "Invoice Number": "INV001234",
                "Item Number": "12345",
                "Credit Request Total": "not-a-number",
                "Credit Type": "Invalid Type",
                "Ticket Number": "TKT001"
            }
        ],
        "should_pass": False
    },
    {
        "name": "Duplicate combinations",
        "data": [
            {
                "Date": "2025-01-20",
                "Customer Number": "CUST001",
                "Invoice Number": "INV001234",
                "Item Number": "12345",
                "Credit Request Total": "100.00",
                "Credit Type": "Credit Memo",
                "Ticket Number": "TKT001"
            },
            {
                "Date": "2025-01-21",
                "Customer Number": "CUST002",
                "Invoice Number": "INV001234",  # Same as first
                "Item Number": "12345",        # Same as first
                "Credit Request Total": "200.00",
                "Credit Type": "Internal",
                "Ticket Number": "TKT002"
            }
        ],
        "should_pass": False
    }
]

def test_csv_validation():
    """Test CSV validation against our backend endpoint."""
    print("🧪 Testing CSV validation functionality...")

    base_url = "http://127.0.0.1:8000"

    # Check if server is running
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code != 200:
            print("❌ Server not running or health check failed")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        return False

    print("✅ Server is running")

    # Test each case
    passed = 0
    total = len(test_cases)

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}/{total}: {test_case['name']}")

        payload = {
            "rows": test_case["data"],
            "dry_run": True
        }

        try:
            response = requests.post(
                f"{base_url}/ingestion/ai-intake/push",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if test_case["should_pass"]:
                if response.status_code == 200:
                    print("✅ PASS: Request successful as expected")
                    passed += 1
                else:
                    print(f"❌ FAIL: Expected success (200) but got {response.status_code}")
                    print(f"   Response: {response.text[:200]}...")
            else:
                if response.status_code != 200:
                    print(f"✅ PASS: Request failed as expected (status {response.status_code})")
                    # Check if it's a validation error
                    if response.status_code == 422 and "validation" in response.text.lower():
                        print("   ✓ Validation error correctly triggered")
                    passed += 1
                else:
                    print("❌ FAIL: Expected failure but request succeeded")

        except Exception as e:
            print(f"❌ FAIL: Request failed with exception: {e}")

    print(f"\n🏁 Test Results: {passed}/{total} tests passed")
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️  Some tests failed")
        return False

if __name__ == "__main__":
    success = test_csv_validation()
    sys.exit(0 if success else 1)
