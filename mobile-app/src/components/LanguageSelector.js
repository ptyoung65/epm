/**
 * Language Selector Component for AIRIS EPM Mobile App
 * React Native implementation with native device integration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

const LanguageSelector = ({ visible, onClose, style }) => {
  const { i18n, t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [deviceInfo, setDeviceInfo] = useState(null);

  // Language configurations
  const languages = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸',
      regions: ['US', 'CA', 'AU', 'GB', 'IE'],
    },
    {
      code: 'ko',
      name: 'Korean',
      nativeName: '한국어',
      flag: '🇰🇷',
      regions: ['KR'],
    },
    {
      code: 'ja',
      name: 'Japanese',
      nativeName: '日本語',
      flag: '🇯🇵',
      regions: ['JP'],
    },
    {
      code: 'zh',
      name: 'Chinese',
      nativeName: '中文',
      flag: '🇨🇳',
      regions: ['CN', 'TW', 'HK', 'SG'],
    },
  ];

  // Get device locale information
  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        const locales = getLocales();
        const deviceLocale = locales[0];
        const country = await DeviceInfo.getDeviceCountry();
        const timezone = await DeviceInfo.getTimezone();
        
        setDeviceInfo({
          ...deviceLocale,
          country,
          timezone,
        });
        
        // Auto-suggest language based on device locale
        const suggestedLang = languages.find(lang => 
          lang.regions.includes(deviceLocale.countryCode?.toUpperCase()) ||
          lang.code === deviceLocale.languageCode
        );
        
        if (suggestedLang && suggestedLang.code !== i18n.language) {
          const dismissed = await AsyncStorage.getItem('@airis_language_suggestion_dismissed');
          if (!dismissed) {
            showLanguageSuggestion(suggestedLang);
          }
        }
      } catch (error) {
        console.warn('Failed to get device info:', error);
      }
    };
    
    getDeviceInfo();
  }, []);

  // Show language suggestion alert
  const showLanguageSuggestion = (suggestedLang) => {
    Alert.alert(
      `Switch to ${suggestedLang.nativeName}?`,
      `We detected your device is set to ${deviceInfo?.countryCode}. Would you like to use ${suggestedLang.nativeName}?`,
      [
        {
          text: 'No, thanks',
          onPress: async () => {
            await AsyncStorage.setItem('@airis_language_suggestion_dismissed', 'true');
          },
          style: 'cancel',
        },
        {
          text: 'Yes, switch',
          onPress: () => handleLanguageChange(suggestedLang.code),
        },
      ]
    );
  };

  // Handle language change
  const handleLanguageChange = async (langCode) => {
    try {
      setSelectedLanguage(langCode);
      await i18n.changeLanguage(langCode);
      
      // Store preference
      await AsyncStorage.setItem('@airis_language', langCode);
      await AsyncStorage.setItem('@airis_language_changed_at', new Date().toISOString());
      
      // Analytics tracking
      try {
        // Add your analytics tracking here
        console.log('Language changed to:', langCode);
      } catch (analyticsError) {
        console.warn('Analytics tracking failed:', analyticsError);
      }
      
      onClose && onClose();
      
      // Show success feedback
      const selectedLang = languages.find(lang => lang.code === langCode);
      Alert.alert(
        'Language Updated',
        `Language switched to ${selectedLang?.nativeName || langCode}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Language change failed:', error);
      Alert.alert(
        'Error',
        'Failed to change language. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Reset language to device default
  const resetToDeviceLanguage = async () => {
    if (deviceInfo) {
      const deviceLang = languages.find(lang => 
        lang.code === deviceInfo.languageCode ||
        lang.regions.includes(deviceInfo.countryCode?.toUpperCase())
      );
      
      if (deviceLang) {
        await handleLanguageChange(deviceLang.code);
      }
    }
  };

  // Render language item
  const renderLanguageItem = ({ item }) => {
    const isSelected = item.code === selectedLanguage;
    const isDeviceRecommended = deviceInfo && (
      item.code === deviceInfo.languageCode ||
      item.regions.includes(deviceInfo.countryCode?.toUpperCase())
    );
    
    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          isSelected && styles.selectedLanguageItem
        ]}
        onPress={() => handleLanguageChange(item.code)}
        activeOpacity={0.7}
      >
        <View style={styles.languageItemContent}>
          <Text style={styles.flag}>{item.flag}</Text>
          <View style={styles.languageInfo}>
            <Text style={[
              styles.nativeName,
              isSelected && styles.selectedText
            ]}>
              {item.nativeName}
            </Text>
            <Text style={[
              styles.englishName,
              isSelected && styles.selectedSecondaryText
            ]}>
              {item.name}
            </Text>
            {isDeviceRecommended && (
              <Text style={styles.recommendedText}>
                Recommended for your device
              </Text>
            )}
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, style]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('settings.language')}</Text>
          <TouchableOpacity onPress={resetToDeviceLanguage} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Device Info */}
        {deviceInfo && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoTitle}>Device Settings</Text>
            <Text style={styles.deviceInfoText}>
              Language: {deviceInfo.languageTag || 'Unknown'}
            </Text>
            <Text style={styles.deviceInfoText}>
              Region: {deviceInfo.countryCode || 'Unknown'}
            </Text>
            <Text style={styles.deviceInfoText}>
              24-hour format: {deviceInfo.uses24HourClock ? 'Yes' : 'No'}
            </Text>
          </View>
        )}

        {/* Language List */}
        <FlatList
          data={languages}
          renderItem={renderLanguageItem}
          keyExtractor={(item) => item.code}
          style={styles.languageList}
          showsVerticalScrollIndicator={false}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Language preference will be saved for next time
          </Text>
          <TouchableOpacity
            style={styles.autoDetectButton}
            onPress={async () => {
              const dismissed = await AsyncStorage.getItem('@airis_language_suggestion_dismissed');
              if (dismissed) {
                await AsyncStorage.removeItem('@airis_language_suggestion_dismissed');
                Alert.alert(
                  'Auto-detect Enabled',
                  'Language suggestions based on your location will be shown again.',
                  [{ text: 'OK' }]
                );
              } else {
                await AsyncStorage.setItem('@airis_language_suggestion_dismissed', 'true');
                Alert.alert(
                  'Auto-detect Disabled',
                  'Language suggestions will no longer be shown.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Text style={styles.autoDetectButtonText}>
              Toggle Auto-detect
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  cancelButton: {
    paddingVertical: 5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6c757d',
  },
  resetButton: {
    paddingVertical: 5,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#007bff',
  },
  deviceInfo: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginVertical: 15,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  deviceInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  deviceInfoText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 2,
  },
  languageList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  languageItem: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedLanguageItem: {
    borderColor: '#007bff',
    backgroundColor: '#f8f9ff',
  },
  languageItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  flag: {
    fontSize: 24,
    marginRight: 15,
  },
  languageInfo: {
    flex: 1,
  },
  nativeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  selectedText: {
    color: '#007bff',
  },
  englishName: {
    fontSize: 14,
    color: '#6c757d',
  },
  selectedSecondaryText: {
    color: '#5a9fd8',
  },
  recommendedText: {
    fontSize: 12,
    color: '#28a745',
    fontStyle: 'italic',
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 10,
  },
  autoDetectButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignSelf: 'center',
  },
  autoDetectButtonText: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
});

export default LanguageSelector;