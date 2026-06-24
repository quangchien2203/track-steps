import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Pedometer } from 'expo-sensors';
import { calculateDistance, calculateCalories } from '../utils/trackerUtils';

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TrackerScreen() {
  const [steps, setSteps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean | null>(null);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean | null>(null);
  const [height, setHeight] = useState<number>(170); // default 170cm
  const [weight, setWeight] = useState<number>(70);  // default 70kg

  const goal = 10000;
  const calories = Math.round(calculateCalories(steps, weight, height, true));
  const distance = calculateDistance(steps, height).toFixed(2);
  const percentage = Math.min((steps / goal) * 100, 100);

  const stepsRef = React.useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const saveStepsToFirestore = useCallback(async (stepsCount: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const todayStr = getLocalDateString(new Date());
    const docRef = doc(db, 'users', userId, 'step_history', todayStr);

    const cal = Math.round(calculateCalories(stepsCount, weight, height, true));
    const dist = parseFloat(calculateDistance(stepsCount, height).toFixed(2));

    try {
      await setDoc(docRef, {
        caloriesBurned: cal,
        date: todayStr,
        distanceKm: dist,
        goalReached: stepsCount >= goal,
        goalSteps: goal,
        steps: stepsCount,
        uid: userId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error saving steps to Firestore:', error);
    }
  }, [weight, height]);

  const syncHistoricalSteps = useCallback(async (heightVal: number, weightVal: number) => {
    const userId = auth.currentUser?.uid;
    if (!userId || !isPermissionGranted || !isPedometerAvailable) return;

    try {
      // Sync last 7 days (including today)
      for (let i = 0; i < 7; i++) {
        const start = new Date();
        start.setDate(start.getDate() - i);
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setDate(end.getDate() - i);
        end.setHours(23, 59, 59, 999);

        const dateStr = getLocalDateString(start);

        const result = await Pedometer.getStepCountAsync(start, end);
        if (result) {
          const daySteps = result.steps;
          const cal = Math.round(calculateCalories(daySteps, weightVal, heightVal, true));
          const dist = parseFloat(calculateDistance(daySteps, heightVal).toFixed(2));

          const docRef = doc(db, 'users', userId, 'step_history', dateStr);
          await setDoc(docRef, {
            caloriesBurned: cal,
            date: dateStr,
            distanceKm: dist,
            goalReached: daySteps >= goal,
            goalSteps: goal,
            steps: daySteps,
            uid: userId,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }
      console.log('Synced historical steps for the last 7 days.');
    } catch (error) {
      console.error('Failed to sync historical steps:', error);
    }
  }, [isPermissionGranted, isPedometerAvailable]);

  // Synchronize historical steps for the last 7 days when pedometer is available and permitted
  useEffect(() => {
    if (isPedometerAvailable && isPermissionGranted && height > 0 && weight > 0) {
      syncHistoricalSteps(height, weight);
    }
  }, [isPedometerAvailable, isPermissionGranted, height, weight, syncHistoricalSteps]);

  // Load user profile stats on mount from Firestore
  useEffect(() => {
    async function loadStats() {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.height) setHeight(data.height);
          if (data.weight) setWeight(data.weight);
        }
      } catch (error) {
        console.error('Failed to load profile stats from Firestore in tracker:', error);
      }
    }
    loadStats();
  }, []);

  // Check pedometer availability and load historical steps (reconciled with Firestore)
  useEffect(() => {
    async function checkAvailabilityAndLoadSteps() {
      const userId = auth.currentUser?.uid;
      let initialSteps = 0;

      // 1. Try to load today's saved steps from Firestore
      if (userId) {
        try {
          const todayStr = getLocalDateString(new Date());
          const docRef = doc(db, 'users', userId, 'step_history', todayStr);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            initialSteps = docSnap.data().steps || 0;
            setSteps(initialSteps);
          }
        } catch (error) {
          console.error("Error fetching steps from Firestore on load:", error);
        }
      }

      // 2. Check pedometer availability and reconcile
      try {
        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);
        
        if (available) {
          const permission = await Pedometer.getPermissionsAsync();
          setIsPermissionGranted(permission.granted);
          
          if (permission.granted) {
            // Get steps from the start of today
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            const result = await Pedometer.getStepCountAsync(start, end);
            if (result) {
              // Reconcile: use the larger value between Firestore steps and real sensor steps
              setSteps(Math.max(initialSteps, result.steps));
            }
          }
        }
      } catch (error) {
        console.error("Error setting up pedometer:", error);
        setIsPedometerAvailable(false);
      }
    }
    checkAvailabilityAndLoadSteps();
  }, []);

  // Handle step updates (either real sensor or simulation)
  useEffect(() => {
    let subscription: any = null;
    let interval: any = null;

    if (isTracking) {
      if (isPedometerAvailable && isPermissionGranted) {
        let lastReportedSteps = 0;
        subscription = Pedometer.watchStepCount((result) => {
          const delta = result.steps - lastReportedSteps;
          lastReportedSteps = result.steps;
          setSteps((prevSteps) => prevSteps + delta);
        });
      } else {
        // Fallback: simulating 2 to 4 steps per second
        interval = setInterval(() => {
          setSteps((prevSteps) => prevSteps + Math.floor(Math.random() * 3) + 2);
        }, 1000);
      }
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTracking, isPedometerAvailable, isPermissionGranted]);

  // Auto-save steps to Firestore periodically while tracking
  useEffect(() => {
    if (!isTracking) return;

    // Save every 10 seconds
    const interval = setInterval(() => {
      saveStepsToFirestore(stepsRef.current);
    }, 10000);

    return () => {
      clearInterval(interval);
      // Save final steps when tracking stops or screen unmounts
      saveStepsToFirestore(stepsRef.current);
    };
  }, [isTracking, saveStepsToFirestore]);

  const handleToggleTracking = async () => {
    if (!isTracking) {
      if (isPedometerAvailable) {
        // Request permissions first
        const permission = await Pedometer.requestPermissionsAsync();
        setIsPermissionGranted(permission.granted);
        
        if (permission.granted) {
          // Get latest step count from today start
          try {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            const result = await Pedometer.getStepCountAsync(start, end);
            if (result) {
              setSteps(result.steps);
            }
          } catch (e) {
            console.error(e);
          }
          setIsTracking(true);
        } else {
          Alert.alert(
            'Quyền truy cập bị từ chối',
            'Ứng dụng cần quyền nhận diện hoạt động để đếm bước chân. Vui lòng cấp quyền trong Cài đặt.',
            [{ text: 'Đóng' }]
          );
        }
      } else {
        // Simulator mode: Just start
        setIsTracking(true);
      }
    } else {
      setIsTracking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error(error);
      Alert.alert('Lỗi', 'Không thể đăng xuất.');
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />
      <ScrollView
        className="flex-1"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Header Gradient */}
        <LinearGradient
          colors={['#3274fd', '#9e30ff']}
          style={{ height: 180, justifyContent: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 44 : 24 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View className="flex-row justify-between items-center mt-4">
            <Text className="text-white text-[32px] font-extrabold tracking-tight">Today</Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => router.push('/profile')}
                className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-3 active:opacity-85"
              >
                <Ionicons name="person-outline" size={22} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSignOut}
                className="w-12 h-12 rounded-full bg-white/20 items-center justify-center active:opacity-85"
              >
                <Ionicons name="log-out-outline" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Card Overlay */}
        <View className="flex-1 bg-white rounded-t-[40px] mt-[-30px] px-8 pt-8 pb-8 shadow-2xl">
          {/* Circular Steps Progress */}
          <View className="items-center justify-center my-6">
            <View className="w-64 h-64 rounded-full border-[18px] border-[#f0f2f6] bg-white items-center justify-center shadow-sm">
              <Ionicons name="footsteps-outline" size={48} color="#3274fd" />
              <Text className="text-[52px] font-black text-[#9e30ff] mt-2 mb-1">
                {steps.toLocaleString()}
              </Text>
              <Text className="text-gray-500 text-[16px] font-semibold">steps</Text>
            </View>
          </View>

          {/* Daily Goal Card */}
          <View className="bg-[#fcfaff] rounded-3xl p-5 mb-6 shadow-sm border border-[#f0ebff]">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <LinearGradient
                  colors={['#3274fd', '#9e30ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="w-12 h-12 rounded-full items-center justify-center"
                >
                  <Ionicons name="disc-outline" size={24} color="#ffffff" />
                </LinearGradient>
                <View className="ml-3">
                  <Text className="text-gray-800 text-[16px] font-black">Daily Goal</Text>
                  <Text className="text-gray-400 text-[13px] font-medium">10,000 steps</Text>
                </View>
              </View>
              <Text className="text-[#9e30ff] text-[26px] font-black">
                {Math.round(percentage)}%
              </Text>
            </View>
            <View className="w-full h-2.5 bg-[#ece7f5] rounded-full overflow-hidden">
              <View
                className="h-full bg-[#9e30ff] rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </View>
          </View>

          {/* Metrics Row */}
          <View className="flex-row justify-between mb-8">
            {/* Calories Card */}
            <View className="flex-1 bg-[#fffbf5] rounded-3xl p-5 mr-2 border border-[#ffe8d1] shadow-sm">
              <View className="w-11 h-11 rounded-full bg-[#ff5e00] items-center justify-center mb-3">
                <Ionicons name="pulse" size={22} color="#ffffff" />
              </View>
              <Text className="text-[#ff5e00] text-[13px] font-extrabold mb-1">Calories</Text>
              <Text className="text-gray-800 text-[30px] font-black mb-1">{calories}</Text>
              <Text className="text-[#ff5e00]/70 text-[12px] font-semibold">kcal burned</Text>
            </View>

            {/* Distance Card */}
            <View className="flex-1 bg-[#f5fdf7] rounded-3xl p-5 ml-2 border border-[#d6f5e1] shadow-sm">
              <View className="w-11 h-11 rounded-full bg-[#00c853] items-center justify-center mb-3">
                <Ionicons name="trending-up" size={22} color="#ffffff" />
              </View>
              <Text className="text-[#008a3c] text-[13px] font-extrabold mb-1">Distance</Text>
              <Text className="text-gray-800 text-[30px] font-black mb-1">{distance}</Text>
              <Text className="text-[#008a3c]/70 text-[12px] font-semibold">kilometers</Text>
            </View>
          </View>

          {/* Simulator & Permission Status Banners */}
          {isPedometerAvailable === false && (
            <View className="flex-row items-center justify-center bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 shadow-sm">
              <Ionicons name="warning-outline" size={20} color="#d97706" />
              <View className="ml-3 flex-1">
                <Text className="text-amber-800 text-[13px] font-bold">Chế độ giả lập (Simulator Mode)</Text>
                <Text className="text-amber-700/80 text-[11px] font-medium mt-0.5">Thiết bị không hỗ trợ cảm biến bước chân. Đang giả lập dữ liệu để thử nghiệm.</Text>
              </View>
            </View>
          )}

          {isPedometerAvailable === true && isPermissionGranted === false && (
            <View className="flex-row items-center justify-center bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 shadow-sm">
              <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
              <View className="ml-3 flex-1">
                <Text className="text-red-800 text-[13px] font-bold">Chưa cấp quyền cảm biến</Text>
                <Text className="text-red-700/80 text-[11px] font-medium mt-0.5">Vui lòng cấp quyền Nhận diện hoạt động trong Cài đặt để tự động đếm bước.</Text>
              </View>
            </View>
          )}

          {/* Start/Stop Tracking Button */}
          <TouchableOpacity
            onPress={handleToggleTracking}
            className="rounded-[24px] active:opacity-90 mb-4"
            style={{
              shadowColor: isTracking ? '#ff4d4d' : '#9e30ff',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={isTracking ? ['#ff4d4d', '#ff0055'] : ['#3274fd', '#9e30ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 20 }}
            >
              <View className="rounded-2xl flex-row items-center justify-center h-[68px]">
                <Text className="text-white text-[18px] font-bold text-center">
                  {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
