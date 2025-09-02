import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Upload, X, File, CheckCircle as CheckCircle, AlertTriangle as AlertTriangle, Download, FileText } from 'lucide-react-native';
import { parseFile, ParsedData } from '@/utils/fileParser';
import { FieldMappingComponent } from './FieldMappingComponent';
import { DataPreviewComponent } from './DataPreviewComponent';
import { ValidationResultsComponent } from './ValidationResultsComponent';
import { validateBatchData, MappedSubscriptionData, ValidationError } from '@/utils/subscriptionValidator';

interface BulkUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (data: MappedSubscriptionData[]) => Promise<void>;
}

type UploadStep = 'upload' | 'mapping' | 'preview' | 'validation' | 'importing';

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const [currentStep, setCurrentStep] = useState<UploadStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, number>>({});
  const [validationResults, setValidationResults] = useState<{
    validData: MappedSubscriptionData[];
    errors: ValidationError[];
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<any>(null);

  const resetModal = useCallback(() => {
    setCurrentStep('upload');
    setParsedData(null);
    setFieldMapping({});
    setValidationResults(null);
    setIsDragOver(false);
    setIsProcessing(false);
  }, []);

  const handleClose = useCallback(() => {
    resetModal();
    onClose();
  }, [resetModal, onClose]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      Alert.alert('Error', 'File size must be less than 5MB');
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.totalRows > 500) {
        Alert.alert('Error', 'Maximum 500 records allowed per upload');
        return;
      }
      
      setParsedData(parsed);
      setCurrentStep('mapping');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleMobileFileSelect = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Convert the document picker result to a File-like object
        const response = await fetch(file.uri);
        const blob = await response.blob();
        
        // Create a file-like object that works with our parser
        const fileObj = {
          ...blob,
          name: file.name,
          lastModified: Date.now(),
          webkitRelativePath: '',
          type: file.mimeType || 'application/octet-stream',
          size: file.size || blob.size || 0,
        } as File;
        
        await handleFileSelect(fileObj);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select file');
      console.error('File selection error:', error);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: any) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0] as File);
    }
  }, [handleFileSelect]);

  const handleMappingComplete = useCallback((mapping: Record<string, number>) => {
    setFieldMapping(mapping);
    setCurrentStep('preview');
  }, []);

  const handleValidation = useCallback(() => {
    if (!parsedData) return;

    const results = validateBatchData(parsedData.rows, fieldMapping);
    setValidationResults(results);
    setCurrentStep('validation');
  }, [parsedData, fieldMapping]);

  const handleImport = useCallback(async () => {
    if (!validationResults?.validData.length) return;

    setCurrentStep('importing');
    try {
      await onImport(validationResults.validData);
      Alert.alert('Success', `Successfully imported ${validationResults.validData.length} subscriptions`);
      handleClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to import subscriptions');
      setCurrentStep('validation');
    }
  }, [validationResults, onImport, handleClose]);

  const downloadTemplate = useCallback(() => {
    const headers = [
      'Subscription Name',
      'Category',
      'Status',
      'Plan Name',
      'Monthly Cost',
      'Billing Cycle',
      'Renewal Date',
      'Payment Method',
      'Notes',
      'Last Used',
      'Priority',
      'Deactivation Date'
    ];

    const exampleRow = [
      'Netflix',
      'Entertainment',
      'Active',
      'Premium',
      '15.99',
      'Monthly',
      '2024-02-15',
      'Visa ****1234',
      'Family plan',
      '2024-01-10',
      'High',
      ''
    ];

    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    
    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'subscription_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        Alert.alert('Error', 'Template download not supported on this platform');
      }
    } else {
      Alert.alert(
        'Template Download',
        'Template download is only available on web. Please use the following format:\n\n' + 
        headers.join(', ') + '\n\nExample:\n' + exampleRow.join(', ')
      );
    }
  }, []);

  const renderUploadStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Upload Subscription Data</Text>
      <Text style={styles.stepSubtitle}>
        Upload a CSV or Excel file with your subscription data
      </Text>

      <TouchableOpacity style={styles.templateButton} onPress={downloadTemplate}>
        <Download size={16} color="#3B82F6" />
        <Text style={styles.templateButtonText}>Download Template</Text>
      </TouchableOpacity>

      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.dropZone,
            {
              backgroundColor: isDragOver ? '#EFF6FF' : '#F8FAFC',
              borderColor: isDragOver ? '#3B82F6' : '#E2E8F0',
            }
          ]}
          // @ts-ignore - Web-specific drag handlers
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload size={48} color="#64748B" />
          <Text style={styles.dropZoneTitle}>
            {isDragOver ? 'Drop file here' : 'Drag & drop your file here'}
          </Text>
          <Text style={styles.dropZoneSubtitle}>or</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => fileInputRef.current?.click()}
          >
            <Text style={styles.browseButtonText}>Browse Files</Text>
          </TouchableOpacity>
          {/* Hidden file input for web */}
          <View style={styles.hiddenInput}>
            {/* @ts-ignore - Web-specific input element */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              aria-label="Upload file"
              title="Choose a file to upload"
              onChange={handleFileInputChange}
            />
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.mobileUploadButton} onPress={handleMobileFileSelect}>
          <Upload size={48} color="#64748B" />
          <Text style={styles.dropZoneTitle}>Select File</Text>
          <Text style={styles.dropZoneSubtitle}>Tap to choose a file from your device</Text>
        </TouchableOpacity>
      )}

      <View style={styles.supportedFormats}>
        <Text style={styles.supportedFormatsTitle}>Supported formats:</Text>
        <View style={styles.formatList}>
          <View style={styles.formatItem}>
            <FileText size={16} color="#64748B" />
            <Text style={styles.formatText}>CSV (.csv)</Text>
          </View>
          <View style={styles.formatItem}>
            <File size={16} color="#64748B" />
            <Text style={styles.formatText}>Excel (.xlsx)</Text>
          </View>
        </View>
        <Text style={styles.limitText}>Maximum file size: 5MB, Maximum records: 500</Text>
      </View>
    </View>
  );

  const renderStepContent = () => {
    if (isProcessing) {
      return (
        <View style={styles.processingContainer}>
          <Text style={styles.processingText}>Processing file...</Text>
        </View>
      );
    }

    switch (currentStep) {
      case 'upload':
        return renderUploadStep();
      case 'mapping':
        return parsedData && (
          <FieldMappingComponent
            headers={parsedData.headers}
            onMappingChange={handleMappingComplete}
          />
        );
      case 'preview':
        return parsedData && (
          <DataPreviewComponent
            data={parsedData}
            fieldMapping={fieldMapping}
            onValidate={handleValidation}
          />
        );
      case 'validation':
        return validationResults && (
          <ValidationResultsComponent
            results={validationResults}
            onImport={handleImport}
            onBack={() => setCurrentStep('preview')}
          />
        );
      case 'importing':
        return (
          <View style={styles.processingContainer}>
            <Text style={styles.processingText}>Importing subscriptions...</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bulk Import Subscriptions</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderStepContent()}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 24,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  templateButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
  },
  dropZone: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 24,
  },
  dropZoneTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  dropZoneSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
    marginBottom: 16,
  },
  browseButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
  supportedFormats: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  supportedFormatsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1E293B',
    marginBottom: 12,
  },
  formatList: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  formatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  limitText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
  },
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  processingText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  mobileUploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
  },
});