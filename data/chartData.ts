import { mockSubscriptions, mockSpendingData, mockCategorySpend } from './mockData';

// Enhanced spending data with more months for trend analysis
export const spendingTrendData = [
  { month: 'Jan', amount: 89.97, subscriptions: 8, year: 2024 },
  { month: 'Feb', amount: 89.97, subscriptions: 8, year: 2024 },
  { month: 'Mar', amount: 104.96, subscriptions: 9, year: 2024 },
  { month: 'Apr', amount: 104.96, subscriptions: 9, year: 2024 },
  { month: 'May', amount: 119.95, subscriptions: 10, year: 2024 },
  { month: 'Jun', amount: 83.97, subscriptions: 7, year: 2024 },
  { month: 'Jul', amount: 68.99, subscriptions: 6, year: 2024 },
  { month: 'Aug', amount: 73.98, subscriptions: 7, year: 2024 },
  { month: 'Sep', amount: 92.97, subscriptions: 8, year: 2024 },
  { month: 'Oct', amount: 98.96, subscriptions: 9, year: 2024 },
  { month: 'Nov', amount: 103.95, subscriptions: 9, year: 2024 },
  { month: 'Dec', amount: 108.94, subscriptions: 10, year: 2024 },
];

// Category distribution data for pie chart
export const categoryDistributionData = mockCategorySpend.map(item => ({
  category: item.category,
  amount: item.amount,
  percentage: item.percentage,
  color: item.color,
}));

// Annual heatmap data (month x category matrix)
export const annualHeatmapData = [
  {
    month: 'Jan',
    categories: {
      'Productivity': 29,
      'Entertainment': 19.98,
      'AI': 20,
      'Creative': 14.99,
    }
  },
  {
    month: 'Feb', 
    categories: {
      'Productivity': 31,
      'Entertainment': 19.98,
      'AI': 25,
      'Creative': 12.99,
    }
  },
  {
    month: 'Mar',
    categories: {
      'Productivity': 35,
      'Entertainment': 29.97,
      'AI': 30,
      'Creative': 14.99,
    }
  },
  {
    month: 'Apr',
    categories: {
      'Productivity': 29,
      'Entertainment': 29.97,
      'AI': 35,
      'Creative': 19.99,
    }
  },
  {
    month: 'May',
    categories: {
      'Productivity': 42,
      'Entertainment': 29.97,
      'AI': 40,
      'Creative': 24.99,
    }
  },
  {
    month: 'Jun',
    categories: {
      'Productivity': 29,
      'Entertainment': 19.98,
      'AI': 20,
      'Creative': 0,
    }
  },
];

// Cost vs Usage scatter plot data
export const costUsageData = mockSubscriptions
  .filter(sub => sub.status === 'Active')
  .map(sub => {
    // Calculate usage score based on last used date and priority
    const daysSinceLastUsed = sub.lastUsed 
      ? Math.floor((new Date().getTime() - new Date(sub.lastUsed).getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    let usageScore = Math.max(0, 100 - (daysSinceLastUsed * 3));
    
    // Adjust based on priority
    if (sub.priority === 'High') usageScore = Math.min(100, usageScore + 10);
    if (sub.priority === 'Low') usageScore = Math.max(0, usageScore - 20);
    
    return {
      subscriptionName: sub.name,
      monthlyCost: sub.monthlyCost,
      usageScore: Math.round(usageScore),
      category: sub.category,
      priority: sub.priority,
    };
  });

// Performance metrics for monitoring
export const chartPerformanceMetrics = {
  loadTimes: {
    spendingTrend: 0,
    categoryPie: 0,
    heatmap: 0,
    scatterPlot: 0,
  },
  renderCounts: {
    spendingTrend: 0,
    categoryPie: 0,
    heatmap: 0,
    scatterPlot: 0,
  },
  lastUpdated: new Date(),
};

// Chart configuration constants
export const CHART_CONFIG = {
  animation: {
    duration: 1000,
    easing: 'ease-out',
  },
  colors: {
    primary: '#3B82F6',
    secondary: '#8B5CF6', 
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    muted: '#64748B',
  },
  accessibility: {
    minContrastRatio: 4.5,
    focusRingWidth: 2,
    keyboardNavigation: true,
  },
  responsive: {
    breakpoints: {
      mobile: 640,
      tablet: 768,
      desktop: 1024,
    },
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 2,
    },
  },
} as const;