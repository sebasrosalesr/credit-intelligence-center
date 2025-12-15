import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilters } from '../useFilters'
import type { CreditRecord } from '../../types'

// Mock the getWorkflowState function
const mockGetWorkflowState = (record: CreditRecord): string => {
  const rtnCrNo = record.RTN_CR_No
  return !rtnCrNo || rtnCrNo === "nan" || rtnCrNo === "" ? "Pending" : "Completed"
}

// Sample test data
const mockCredits: CreditRecord[] = [
  {
    id: '1',
    "Invoice Number": "INV001",
    "Item Number": "ITEM001",
    "Customer Number": "CUST001",
    "Ticket Number": "TICKET001",
    RTN_CR_No: "",
    "Credit Request Total": 100.50,
    Date: "2024-01-01",
  },
  {
    id: '2',
    "Invoice Number": "INV002",
    "Item Number": "ITEM002",
    "Customer Number": "CUST002",
    "Ticket Number": "TICKET002",
    RTN_CR_No: "CR123",
    "Credit Request Total": 200.75,
    Date: "2024-01-02",
  },
  {
    id: '3',
    "Invoice Number": "INV003",
    "Item Number": "ITEM003",
    "Customer Number": "CUST001",
    "Ticket Number": "TICKET003",
    RTN_CR_No: "",
    "Credit Request Total": 50.25,
    Date: "2024-01-03",
  },
]

describe('useFilters', () => {
  beforeEach(() => {
    // Reset any test state if needed
  })

  it('should return initial state correctly', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    expect(result.current.search).toBe('')
    expect(result.current.statusFilter).toBe('All')
    expect(result.current.bulkList).toBe('')
    expect(result.current.sortBy).toBe('Date')
    expect(result.current.sortDir).toBe('desc')
    expect(result.current.isFiltered).toBe(false)
    expect(result.current.filteredData).toEqual(mockCredits)
    // sortedData should be sorted by Date descending (newest first)
    expect(result.current.sortedData[0]?.Date).toBe("2024-01-03")
    expect(result.current.sortedData[2]?.Date).toBe("2024-01-01")
  })

  it('should filter by search term', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    act(() => {
      result.current.setSearch('CUST001')
    })

    expect(result.current.search).toBe('CUST001')
    expect(result.current.filteredData).toHaveLength(2)
    expect(result.current.isFiltered).toBe(true)
  })

  it('should filter by status', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    act(() => {
      result.current.setStatusFilter('Pending')
    })

    expect(result.current.statusFilter).toBe('Pending')
    expect(result.current.filteredData).toHaveLength(2) // Records with empty RTN_CR_No
    expect(result.current.filteredData.every(record =>
      !record.RTN_CR_No || record.RTN_CR_No === "nan" || record.RTN_CR_No === ""
    )).toBe(true)
  })

  it('should filter by bulk list', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    act(() => {
      result.current.setBulkList('INV001\nTICKET003')
    })

    expect(result.current.bulkList).toBe('INV001\nTICKET003')
    expect(result.current.filteredData).toHaveLength(2)
    expect(result.current.filteredData.some(record =>
      record["Invoice Number"] === "INV001"
    )).toBe(true)
    expect(result.current.filteredData.some(record =>
      record["Ticket Number"] === "TICKET003"
    )).toBe(true)
  })

  it('should sort data by date', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    // Default sort should be by Date descending
    expect(result.current.sortedData[0]?.Date).toBe("2024-01-03")
    expect(result.current.sortedData[2]?.Date).toBe("2024-01-01")

    // Toggle to ascending
    act(() => {
      result.current.toggleSort('Date')
    })

    expect(result.current.sortDir).toBe('asc')
    expect(result.current.sortedData[0]?.Date).toBe("2024-01-01")
    expect(result.current.sortedData[2]?.Date).toBe("2024-01-03")
  })

  it('should change sort column', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    act(() => {
      result.current.toggleSort('CreditTotal')
    })

    expect(result.current.sortBy).toBe('CreditTotal')
    expect(result.current.sortDir).toBe('asc')
    expect(result.current.sortedData[0]?.["Credit Request Total"]).toBe(50.25)
    expect(result.current.sortedData[2]?.["Credit Request Total"]).toBe(200.75)
  })

  it('should combine multiple filters', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    act(() => {
      result.current.setSearch('CUST001')
      result.current.setStatusFilter('Pending')
    })

    expect(result.current.filteredData).toHaveLength(2)
    expect(result.current.isFiltered).toBe(true)
  })

  it('should normalize bulk search keys', () => {
    const { result } = renderHook(() =>
      useFilters(mockCredits, mockGetWorkflowState)
    )

    // Test that inv prefix is stripped
    act(() => {
      result.current.setBulkList('inv001') // Should match INV001
    })

    expect(result.current.filteredData).toHaveLength(1)
    expect(result.current.filteredData[0]?.["Invoice Number"]).toBe("INV001")
  })
})
