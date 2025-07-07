import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Eye, ArrowRight } from 'lucide-react-native';
import { ParsedData } from '@/utils/fileParser';

interface DataPreviewComponentProps {
  data: ParsedData;
  fieldMapping: Record<string, number>;
  onValidate: () => void;
}

export const DataPreviewComponent: React.FC<DataPreviewComponentProps> = ({
  data,
  fieldMapping,
  onValidate,
}) => {
  const previewRows = data.rows.slice(0, 5);
  const mappedFields = Object.keys(fieldMapping);

  const renderPreviewTable = () => {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeader}>
            {mappedFields.map((fieldKey) => {
              const headerIndex = fieldMapping[fieldKey];
              const headerTitle = data.headers[headerIndex];
              return (
                <View key={fieldKey} style={styles.tableHeaderCell}>
                  <Text style={styles.tableHeaderText}>{fieldKey}</Text>
                  <Text style={styles.tableHeaderSubtext}>({headerTitle})</Text>
                </View>
              );
            })}
          </View>

          {/* Rows */}
          {previewRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.tableRow}>
              {mappedFields.map((fieldKey) => {
                const headerIndex = fieldMapping[fieldKey];
                const cellValue = row[headerIndex] || '';
                return (
                  <View key={fieldKey} style={styles.tableCell}>
                    <Text style={styles.tableCellText} numberOfLines={2}>
                      {String(cellValue)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Eye size={24} color="#3B82F6" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Data Preview</Text>
          <Text style={styles.subtitle}>
            Preview of the first 5 rows from your file ({data.totalRows} total rows)
          </Text>
        </View>
      </View>

      <View style={styles.mappingSummary}>
        <Text style={styles.mappingSummaryTitle}>Field Mapping Summary</Text>
        <View style={styles.mappingList}>
          {Object.entries(fieldMapping).map(([fieldKey, headerIndex]) => (
            <View key={fieldKey} style={styles.mappingItem}>
              <Text style={styles.mappingFieldText}>{fieldKey}</Text>
              <ArrowRight size={14} color="#94A3B8" />
              <Text style={styles.mappingHeaderText}>{data.headers[headerIndex]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.previewTitle}>Data Preview</Text>
        {renderPreviewTable()}
      </View>

      <View style={styles.footer}>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{data.totalRows}</Text>
            <Text style={styles.statLabel}>Total Rows</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{mappedFields.length}</Text>
            <Text style={styles.statLabel}>Mapped Fields</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.validateButton} onPress={onValidate}>
          <Text style={styles.validateButtonText}>Validate & Continue</Text>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
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
  mappingSummary: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  mappingSummaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  mappingList: {
    gap: 8,
  },
  mappingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mappingFieldText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
    minWidth: 120,
  },
  mappingHeaderText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    flex: 1,
  },
  previewSection: {
    flex: 1,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  table: {
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderCell: {
    padding: 12,
    minWidth: 120,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  tableHeaderText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 2,
  },
  tableHeaderSubtext: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCell: {
    padding: 12,
    minWidth: 120,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 20,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  validateButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  validateButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
});