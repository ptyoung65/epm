/**
 * AIRIS EPM 모바일 앱
 * React Native 기반 네이티브 모바일 애플리케이션
 * 
 * 주요 기능:
 * - 실시간 모니터링 대시보드
 * - 알림 및 인시던트 관리
 * - 오프라인 지원
 * - 생체 인증
 * - 차트 및 시각화
 */

import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  StatusBar,
  useColorScheme,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import NetInfo from '@react-native-community/netinfo';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

// 컨텍스트 및 서비스
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { AppConfigProvider } from './src/context/AppConfigContext';

// 화면 컴포넌트
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MonitoringScreen from './src/screens/MonitoringScreen';
import IncidentScreen from './src/screens/IncidentScreen';
import AlertScreen from './src/screens/AlertScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OfflineScreen from './src/screens/OfflineScreen';

// 서비스
import AuthService from './src/services/AuthService';
import ApiService from './src/services/ApiService';
import NotificationService from './src/services/NotificationService';
import StorageService from './src/services/StorageService';
import SyncService from './src/services/SyncService';

// 컴포넌트
import LoadingScreen from './src/components/LoadingScreen';
import NetworkStatusBar from './src/components/NetworkStatusBar';
import PushNotificationHandler from './src/components/PushNotificationHandler';

// 스타일 및 테마
import { lightTheme, darkTheme } from './src/styles/theme';
import { Colors } from './src/styles/colors';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// 메인 탭 네비게이션
function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Monitoring':
              iconName = focused ? 'monitor' : 'monitor-dashboard';
              break;
            case 'Incidents':
              iconName = focused ? 'alert-circle' : 'alert-circle-outline';
              break;
            case 'Alerts':
              iconName = focused ? 'bell' : 'bell-outline';
              break;
            default:
              iconName = 'help-circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.onPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: '대시보드' }}
      />
      <Tab.Screen 
        name="Monitoring" 
        component={MonitoringScreen}
        options={{ title: '모니터링' }}
      />
      <Tab.Screen 
        name="Incidents" 
        component={IncidentScreen}
        options={{ title: '인시던트' }}
      />
      <Tab.Screen 
        name="Alerts" 
        component={AlertScreen}
        options={{ title: '알림' }}
      />
    </Tab.Navigator>
  );
}

// 드로어 네비게이션
function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        drawerStyle: {
          backgroundColor: Colors.surface,
        },
        drawerActiveTintColor: Colors.primary,
        drawerInactiveTintColor: Colors.textSecondary,
      }}
    >
      <Drawer.Screen 
        name="MainTabs" 
        component={MainTabNavigator}
        options={{ 
          title: 'AIRIS EPM',
          drawerIcon: ({ focused, size, color }) => (
            <Icon name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ 
          title: '프로필',
          drawerIcon: ({ focused, size, color }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ 
          title: '설정',
          drawerIcon: ({ focused, size, color }) => (
            <Icon name="cog" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

// 메인 스택 네비게이션
function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    initializeApp();
    setupNetworkListener();
    setupAppStateListener();
  }, []);

  // 앱 초기화
  const initializeApp = async () => {
    try {
      // 권한 확인
      await checkPermissions();
      
      // 저장소 초기화
      await StorageService.initialize();
      
      // 인증 상태 확인
      const authenticated = await AuthService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      // 알림 서비스 초기화
      await NotificationService.initialize();
      
      // 동기화 서비스 시작
      if (authenticated) {
        SyncService.startBackgroundSync();
      }
      
    } catch (error) {
      console.error('앱 초기화 실패:', error);
      Alert.alert('초기화 오류', '앱 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 권한 확인
  const checkPermissions = async () => {
    const permissions = Platform.select({
      ios: [
        PERMISSIONS.IOS.CAMERA,
        PERMISSIONS.IOS.PHOTO_LIBRARY,
        PERMISSIONS.IOS.MICROPHONE,
      ],
      android: [
        PERMISSIONS.ANDROID.CAMERA,
        PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
        PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
        PERMISSIONS.ANDROID.RECORD_AUDIO,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ],
    });

    for (const permission of permissions) {
      const result = await check(permission);
      if (result === RESULTS.DENIED) {
        await request(permission);
      }
    }
  };

  // 네트워크 상태 감지
  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      
      if (state.isConnected) {
        // 온라인 복구 시 동기화 시작
        SyncService.syncPendingData();
      }
    });

    return unsubscribe;
  };

  // 앱 상태 변경 감지
  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background') {
        // 백그라운드 진입 시 동기화
        SyncService.syncBeforeBackground();
      } else if (nextAppState === 'active') {
        // 포그라운드 복귀 시 데이터 새로고침
        SyncService.refreshData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  // 로그인 성공 핸들러
  const handleLoginSuccess = async () => {
    setIsAuthenticated(true);
    SyncService.startBackgroundSync();
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await AuthService.logout();
    setIsAuthenticated(false);
    SyncService.stopBackgroundSync();
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isOffline && !isAuthenticated) {
    return <OfflineScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={DrawerNavigator} />
      ) : (
        <Stack.Screen name="Login">
          {props => (
            <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

// 메인 앱 컴포넌트
export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const navigationTheme = isDarkMode ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      <AppConfigProvider>
        <AuthProvider>
          <DataProvider>
            <NotificationProvider>
              <PaperProvider theme={theme}>
                <StatusBar
                  barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                  backgroundColor={Colors.primary}
                />
                <NetworkStatusBar />
                <NavigationContainer theme={navigationTheme}>
                  <AppNavigator />
                </NavigationContainer>
                <PushNotificationHandler />
              </PaperProvider>
            </NotificationProvider>
          </DataProvider>
        </AuthProvider>
      </AppConfigProvider>
    </SafeAreaProvider>
  );
}