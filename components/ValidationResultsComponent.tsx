import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, ChevronLeft, Upload, ChevronDown, ChevronRight } from 'lucide-react-native';
import { MappedSubscriptionData, ValidationError } from '@/utils/subscriptionValidator';

interface ValidationResultsComponentProps {
  results: {
    validData: MappedSubscriptionData[];
    errors: ValidationError[];
  };
  onImport: () => void;
  onBack: () => void;
}

export const ValidationResultsComponent: React.FC<ValidationResultsComponentProps> = ({
  results,
  onImport,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'valid' | 'errors'>('summary');
  const [expandedError, setExpandedError] = useState<number | null>(null);

  const { validData, errors } = results;
  const totalRows = validData.length + errors.length;
  const errorsByRow = errors.reduce((acc, error) => {
    if (!acc[error.row]) acc[error.row] = [];
    acc[error.row].push(error);
    return acc;
  }, {} as Record<number, ValidationError[]>);

  const renderSummaryTab = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryCards}>
        <View style={[styles.summaryCard, styles.successCard]}>
          <CheckCircle size={32} color="#10B981" />
          <Text style={styles.summaryCardValue}>{validData.length}</Text>
          <Text style={styles.summaryCardLabel}>Valid Records</Text>
        </View>

        <View style={[styles.summaryCard, styles.errorCard]}>
          <XCircle size={32} color="#EF4444" />
          <Text style={styles.summaryCardValue}>{Object.keys(errorsByRow).length}</Text>
          <Text style={styles.summaryCardLabel}>Rows with Errors</Text>
        </View>

        <View style={[styles.summaryCard, styles.totalCard]}>
          <AlertTriangle size={32} color="#F59E0B" />
          <Text style={styles.summaryCardValue}>{errors.length}</Text>
          <Text style={styles.summaryCardLabel}>Total Errors</Text>
        </View>
      </View>

      <View style={styles.summaryDetails}>
        <Text style={styles.summaryText}>
          {validData.length > 0 
            ? `${validData.length} of ${totalRows} records are ready to import.`
            : 'No valid records found. Please fix the errors and try again.'
          }
        </Text>
        
        {errors.length > 0 && (
          <Text style={styles.errorSummaryText}>
            {Object.keys(errorsByRow).length} rows contain validation errors that need to be fixed.
          </Text>
        )}
      </View>

      {validData.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Sample Valid Records</Text>
          {validData.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.previewItem}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewName}>{item.subscriptionName}</Text>
                <Text style={styles.previewCost}>${item.monthlyCost.toFixed(2)}</Text>
              </View>
              <View style={styles.previewDetails}>
                <Text style={styles.previewDetail}>{item.category} • {item.status}</Text>
                <Text style={styles.previewDetail}>{item.planName}</Text>
              </View>
            </View>
          ))}
          {validData.length > 3 && (
            <Text style={styles.moreRecordsText}>
              And {validData.length - 3} more records...
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const renderValidTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Valid Records ({validData.length})</Text>
      <ScrollView style={styles.validList} showsVerticalScrollIndicator={false}>
        {validData.map((item, index) => (
          <View key={index} style={styles.validItem}>
            <View style={styles.validHeader}>
              <Text style={styles.validName}>{item.subscriptionName}</Text>
              <Text style={styles.validCost}>${item.monthlyCost.toFixed(2)}</Text>
            </View>
            <View style={styles.validDetails}>
              <Text style={styles.validDetail}>{item.category} • {item.status} • {item.planName}</Text>
              {item.renewalDate && (
                <Text style={styles.validDetail}>
                  Renews: {item.renewalDate.toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderErrorsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.tabTitle}>Validation Errors ({Object.keys(errorsByRow).length} rows)</Text>
      <ScrollView style={styles.errorsList} showsVerticalScrollIndicator={false}>
        {Object.entries(errorsByRow).map(([rowNumber, rowErrors]) => {
          const isExpanded = expandedError === parseInt(rowNumber);
          return (
            <View key={rowNumber} style={styles.errorGroup}>
              <TouchableOpacity
                style={styles.errorGroupHeader}
                onPress={() => setExpandedError(isExpanded ? null : parseInt(rowNumber))}
              >
                <Text style={styles.errorRowNumber}>Row {rowNumber}</Text>
                <View style={styles.errorGroupSummary}>
                  <Text style={styles.errorCount}>{rowErrors.length} errors</Text>
                  {isExpanded ? (
                    <ChevronDown size={16} color="#64748B" />
                  ) : (
                    <ChevronRight size={16} color="#64748B" />
                  )}
                </View>
              </TouchableOpacity>
              
              {isExpanded && (
                <View style={styles.errorDetails}>
                  {rowErrors.map((error, errorIndex) => (
                    <View key={errorIndex} style={styles.errorItem}>
                      <View style={styles.errorField}>
                        <Text style={styles.errorFieldName}>{error.field}</Text>
                        <Text style={styles.errorValue}>
                          Value: "{String(error.value)}"
                        </Text>
                      </View>
                      <Text style={styles.errorMessage}>{error.message}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return renderSummaryTab();
      case 'valid':
        return renderValidTab();
      case 'errors':
        return renderErrorsTab();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Validation Results</Text>
        <Text style={styles.subtitle}>
          Review the validation results before importing
        </Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'summary' && styles.activeTab]}
          onPress={() => setActiveTab('summary')}
        >
          <Text style={[styles.tabText, activeTab === 'summary' && styles.activeTabText]}>
            Summary
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'valid' && styles.activeTab]}
          onPress={() => setActiveTab('valid')}
        >
          <Text style={[styles.tabText, activeTab === 'valid' && styles.activeTabText]}>
            Valid ({validData.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'errors' && styles.activeTab]}
          onPress={() => setActiveTab('errors')}
        >
          <Text style={[styles.tabText, activeTab === 'errors' && styles.activeTabText]}>
            Errors ({Object.keys(errorsByRow).length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {renderTabContent()}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeft size={20} color="#64748B" />
          <Text style={styles.backButtonText}>Back to Preview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.importButton, validData.length === 0 && styles.importButtonDisabled]}
          onPress={onImport}
          disabled={validData.length === 0}
        >
          <Upload size={20} color="#ffffff" />
          <Text style={styles.importButtonText}>
            Import {validData.length} Records
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  activeTabText: {
    color: '#1E293B',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 16,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  successCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  errorCard: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  totalCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  summaryCardValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
    textAlign: 'center',
  },
  summaryDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 8,
  },
  errorSummaryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  previewSection: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  previewItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
  },
  previewCost: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  previewDetails: {
    gap: 2,
  },
  previewDetail: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  moreRecordsText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  validList: {
    flex: 1,
  },
  validItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  validHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  validName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    flex: 1,
  },
  validCost: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  validDetails: {
    gap: 2,
  },
  validDetail: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  errorsList: {
    flex: 1,
  },
  errorGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  errorRowNumber: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  errorGroupSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorCount: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  errorDetails: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    padding: 12,
    gap: 8,
  },
  errorItem: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 8,
  },
  errorField: {
    marginBottom: 4,
  },
  errorFieldName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#DC2626',
  },
  errorValue: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#7F1D1D',
    marginTop: 2,
  },
  errorMessage: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#991B1B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 20,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    gap: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  importButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  importButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
});