import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, ScrollView, Dimensions } from 'react-native';
import { X, ExternalLink } from 'lucide-react-native';
import { Partner } from '@/types/partner';
import { partnerTrackingService } from '@/services/partnerTracking';

const { width } = Dimensions.get('window');

interface PartnerModalProps {
  partner: Partner | null;
  visible: boolean;
  onClose: () => void;
  onClaimDeal: (partner: Partner) => void;
  userId: string;
}

export const PartnerModal: React.FC<PartnerModalProps> = ({ 
  partner, 
  visible, 
  onClose, 
  onClaimDeal,
  userId 
}) => {
  if (!partner) return null;

  const handleClaimDeal = () => {
    if (partner) {
      // Track click event for modal button
      partnerTrackingService.trackClick(partner.id, userId, 'modal');
      onClaimDeal(partner);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{partner.name}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <Image 
              source={{ uri: partner.logo }} 
              style={styles.modalLogo} 
              resizeMode="cover"
            />
            
            <View style={styles.dealHighlight}>
              <Text style={styles.dealTitle}>Exclusive Deal</Text>
              <Text style={styles.dealDescription}>{partner.benefit}</Text>
            </View>
            
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionTitle}>About {partner.name}</Text>
              <Text style={styles.description}>{partner.description}</Text>
              
              <Text style={styles.termsTitle}>Terms & Conditions</Text>
              <Text style={styles.termsText}>
                • Offer valid for new customers only{'\n'}
                • Cannot be combined with other promotions{'\n'}
                • Subscription Manager users get exclusive pricing{'\n'}
                • Offer expires 30 days after clicking "Claim Deal"
              </Text>
            </View>
            
            <View style={styles.disclaimerContainer}>
              <Text style={styles.disclaimerText}>
                By claiming this deal, you'll be redirected to {partner.name}'s website. 
                Subscription Manager may receive a commission if you subscribe through this link.
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.claimButton}
              onPress={handleClaimDeal}
            >
              <Text style={styles.claimButtonText}>Claim Deal</Text>
              <ExternalLink size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modalContent: {
    width: width > 650 ? 600 : width * 0.9,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    flex: 1,
  },
  modalLogo: {
    width: '100%',
    height: 200,
    backgroundColor: '#F8FAFC', // Placeholder color
  },
  dealHighlight: {
    backgroundColor: '#EFF6FF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E7FF',
  },
  dealTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  dealDescription: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3B82F6',
    fontWeight: '500',
  },
  descriptionContainer: {
    padding: 20,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 20,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  disclaimerContainer: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  claimButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});