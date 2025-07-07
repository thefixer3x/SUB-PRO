import { useState, useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export interface ChartFilters {
  timeframe: '1M' | '3M' | '6M' | '1Y';
  category: string | null;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  priority: 'High' | 'Medium' | 'Low' | null;
}

const DEFAULT_FILTERS: ChartFilters = {
  timeframe: '6M',
  category: null,
  dateRange: {
    start: null,
    end: null,
  },
  priority: null,
};

export const useChartFilters = () => {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  
  // Initialize filters from URL parameters
  const [filters, setFilters] = useState<ChartFilters>(() => {
    const urlTimeframe = searchParams.timeframe as ChartFilters['timeframe'];
    const urlCategory = searchParams.category as string;
    const urlPriority = searchParams.priority as ChartFilters['priority'];
    const urlStartDate = searchParams.startDate as string;
    const urlEndDate = searchParams.endDate as string;
    
    return {
      timeframe: urlTimeframe || DEFAULT_FILTERS.timeframe,
      category: urlCategory || DEFAULT_FILTERS.category,
      priority: urlPriority || DEFAULT_FILTERS.priority,
      dateRange: {
        start: urlStartDate ? new Date(urlStartDate) : DEFAULT_FILTERS.dateRange.start,
        end: urlEndDate ? new Date(urlEndDate) : DEFAULT_FILTERS.dateRange.end,
      },
    };
  });

  // Update URL when filters change
  const updateFilters = useCallback((newFilters: Partial<ChartFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    // Update URL parameters
    const params = new URLSearchParams();
    
    if (updatedFilters.timeframe !== DEFAULT_FILTERS.timeframe) {
      params.set('timeframe', updatedFilters.timeframe);
    }
    
    if (updatedFilters.category) {
      params.set('category', updatedFilters.category);
    }
    
    if (updatedFilters.priority) {
      params.set('priority', updatedFilters.priority);
    }
    
    if (updatedFilters.dateRange.start) {
      params.set('startDate', updatedFilters.dateRange.start.toISOString());
    }
    
    if (updatedFilters.dateRange.end) {
      params.set('endDate', updatedFilters.dateRange.end.toISOString());
    }
    
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '';
    
    // Update URL without causing navigation
    router.setParams(Object.fromEntries(params.entries()));
  }, [filters, router]);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    router.setParams({});
  }, [router]);

  // Filter state helpers
  const hasActiveFilters = useMemo(() => {
    return (
      filters.timeframe !== DEFAULT_FILTERS.timeframe ||
      filters.category !== DEFAULT_FILTERS.category ||
      filters.priority !== DEFAULT_FILTERS.priority ||
      filters.dateRange.start !== DEFAULT_FILTERS.dateRange.start ||
      filters.dateRange.end !== DEFAULT_FILTERS.dateRange.end
    );
  }, [filters]);

  // Specific filter update functions
  const setTimeframe = useCallback((timeframe: ChartFilters['timeframe']) => {
    updateFilters({ timeframe });
  }, [updateFilters]);

  const setCategory = useCallback((category: string | null) => {
    updateFilters({ category });
  }, [updateFilters]);

  const setPriority = useCallback((priority: ChartFilters['priority']) => {
    updateFilters({ priority });
  }, [updateFilters]);

  const setDateRange = useCallback((start: Date | null, end: Date | null) => {
    updateFilters({ dateRange: { start, end } });
  }, [updateFilters]);

  return {
    filters,
    updateFilters,
    resetFilters,
    hasActiveFilters,
    setTimeframe,
    setCategory,
    setPriority,
    setDateRange,
  };
};

// Hook for filtering data based on current filters
export const useFilteredData = <T extends { date?: Date; category?: string; priority?: string }>(
  data: T[],
  filters: ChartFilters
): T[] => {
  return useMemo(() => {
    return data.filter(item => {
      // Category filter
      if (filters.category && item.category !== filters.category) {
        return false;
      }
      
      // Priority filter
      if (filters.priority && item.priority !== filters.priority) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) {
        return false;
      }
      
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) {
        return false;
      }
      
      return true;
    });
  }, [data, filters]);
};