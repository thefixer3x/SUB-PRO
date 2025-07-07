import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronDown, ArrowRight, CircleCheck as CheckCircle } from 'lucide-react-native';

interface FieldMappingComponentProps {
  headers: string[];
  onMappingChange: (mapping: Record<string, number>) => void;
}

const SUBSCRIPTION_FIELDS = [
  { key: 'subscriptionName', label: 'Subscription Name', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'status', label: 'Status', required: true },
  { key: 'planName', label: 'Plan Name', required: false },
  { key: 'monthlyCost', label: 'Monthly Cost', required: true },
  { key: 'billingCycle', label: 'Billing Cycle', required: false },
  { key: 'renewalDate', label: 'Renewal Date', required: false },
  { key: 'paymentMethod', label: 'Payment Method', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'lastUsed', label: 'Last Used', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'deactivationDate', label: 'Deactivation Date', required: false },
];

export const FieldMappingComponent: React.FC<FieldMappingComponentProps> = ({
  headers,
  onMappingChange,
}) => {
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);

  // Auto-map obvious matches
  useEffect(() => {
    const autoMapping: Record<string, number | null> = {};
    
    SUBSCRIPTION_FIELDS.forEach(field => {
      const matchingHeaderIndex = headers.findIndex(header => {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '');
        const normalizedField = field.key.toLowerCase().replace(/[^a-z]/g, '');
        const normalizedLabel = field.label.toLowerCase().replace(/[^a-z]/g, '');
        
        return normalizedHeader.includes(normalizedField) || 
               normalizedHeader.includes(normalizedLabel) ||
               normalizedField.includes(normalizedHeader);
      });
      
      autoMapping[field.key] = matchingHeaderIndex >= 0 ? matchingHeaderIndex : null;
    });

    setMapping(autoMapping);
  }, [headers]);

  const handleFieldMapping = useCallback((fieldKey: string, headerIndex: number | null) => {
    setMapping(prev => ({ ...prev, [fieldKey]: headerIndex }));
    setExpandedDropdown(null);
  }, []);

  const handleContinue = useCallback(() => {
    const finalMapping: Record<string, number> = {};
    
    Object.entries(mapping).forEach(([key, index]) => {
      if (index !== null) {
        finalMapping[key] = index;
      }
    });

    onMappingChange(finalMapping);
  }, [mapping, onMappingChange]);

  const canContinue = SUBSCRIPTION_FIELDS
    .filter(field => field.required)
    .every(field => mapping[field.key] !== null);

  const renderDropdown = (field: typeof SUBSCRIPTION_FIELDS[0]) => {
    const isExpanded = expandedDropdown === field.key;
    const selectedIndex = mapping[field.key];
    const selectedHeader = selectedIndex !== null ? headers[selectedIndex] : null;

    return (
      <View key={field.key} style={styles.mappingRow}>
        <View style={styles.fieldInfo}>
          <Text style={[styles.fieldLabel, field.required && styles.requiredField]}>
            {field.label}
            {field.required && <Text style={styles.asterisk}> *</Text>}
          </Text>
          {field.required && (
            <Text style={styles.requiredText}>Required</Text>
          )}
        </View>

        <ArrowRight size={16} color="#94A3B8" style={styles.arrow} />

        <TouchableOpacity
          style={[
            styles.dropdown,
            isExpanded && styles.dropdownExpanded,
            selectedHeader && styles.dropdownSelected,
          ]}
          onPress={() => setExpandedDropdown(isExpanded ? null : field.key)}
        >
          <Text style={[
            styles.dropdownText,
            selectedHeader ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder,
          ]}>
            {selectedHeader || 'Select column...'}
          </Text>
          <ChevronDown 
            size={16} 
            color="#64748B" 
            style={[styles.chevron, isExpanded && styles.chevronRotated]} 
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownOption}
              onPress={() => handleFieldMapping(field.key, null)}
            >
              <Text style={styles.dropdownOptionText}>Don't map</Text>
            </TouchableOpacity>
            {headers.map((header, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dropdownOption,
                  selectedIndex === index && styles.dropdownOptionSelected,
                ]}
                onPress={() => handleFieldMapping(field.key, index)}
              >
                <Text style={[
                  styles.dropdownOptionText,
                  selectedIndex === index && styles.dropdownOptionTextSelected,
                ]}>
                  {header}
                </Text>
                {selectedIndex === index && (
                  <CheckCircle size={16} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map Your Columns</Text>
      <Text style={styles.subtitle}>
        Match your file columns to the subscription fields below
      </Text>

      <ScrollView style={styles.mappingContainer} showsVerticalScrollIndicator={false}>
        {SUBSCRIPTION_FIELDS.map(renderDropdown)}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {Object.values(mapping).filter(v => v !== null).length} of {SUBSCRIPTION_FIELDS.length} fields mapped
          </Text>
          {!canContinue && (
            <Text style={styles.warningText}>
              Please map all required fields to continue
            </Text>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
            Continue to Preview
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
  title: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 24,
  },
  mappingContainer: {
    flex: 1,
    marginBottom: 20,
  },
  mappingRow: {
    marginBottom: 16,
    position: 'relative',
  },
  fieldInfo: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  requiredField: {
    color: '#DC2626',
  },
  asterisk: {
    color: '#DC2626',
  },
  requiredText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
    marginTop: 2,
  },
  arrow: {
    position: 'absolute',
    right: 120,
    top: 40,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginLeft: 140,
  },
  dropdownExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: '#3B82F6',
  },
  dropdownSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  dropdownText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  dropdownTextSelected: {
    color: '#1E293B',
  },
  dropdownTextPlaceholder: {
    color: '#94A3B8',
  },
  chevron: {
    marginLeft: 8,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 140,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    zIndex: 1000,
    maxHeight: 200,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionSelected: {
    backgroundColor: '#F0FDF4',
  },
  dropdownOptionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1E293B',
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: '#059669',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 20,
  },
  summary: {
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#DC2626',
  },
  continueButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
  continueButtonTextDisabled: {
    color: '#94A3B8',
  },
});