import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { auth, db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function ProfileScreen() {
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('70');
  const [isHeightFocused, setIsHeightFocused] = useState(false);
  const [isWeightFocused, setIsWeightFocused] = useState(false);

  useEffect(() => {
    async function loadStats() {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.height) setHeight(data.height.toString());
          if (data.weight) setWeight(data.weight.toString());
        }
      } catch (error) {
        console.error('Failed to load profile stats from Firestore:', error);
      }
    }
    loadStats();
  }, []);

  const handleContinue = async () => {
    if (!height.trim() || !weight.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ chiều cao và cân nặng.');
      return;
    }

    const heightVal = parseFloat(height);
    const weightVal = parseFloat(weight);

    if (isNaN(heightVal) || heightVal <= 0) {
      Alert.alert('Lỗi', 'Chiều cao không hợp lệ.');
      return;
    }

    if (isNaN(weightVal) || weightVal <= 0) {
      Alert.alert('Lỗi', 'Cân nặng không hợp lệ.');
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Lỗi', 'Người dùng chưa đăng nhập.');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        height: heightVal,
        weight: weightVal,
      }, { merge: true });

      // Navigate to tracker page
      router.replace('/tracker');
    } catch (error) {
      console.error('Failed to save profile stats to Firestore:', error);
      Alert.alert('Lỗi', 'Không thể lưu thông tin của bạn lên Cloud.');
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
          style={{ height: 310, justifyContent: 'center', alignItems: 'center' }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View className="items-center justify-center mt-8">
            <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center border border-white/30 shadow-md">
              <Ionicons name="person-outline" size={44} color="#ffffff" />
            </View>
            <Text className="text-white text-[34px] font-extrabold text-center mt-5 tracking-tight">
              Your Profile
            </Text>
            <Text className="text-white/80 text-[16px] font-medium text-center mt-1.5">
              Set up your physical stats
            </Text>
          </View>
        </LinearGradient>

        {/* Card Overlay */}
        <View className="flex-1 bg-white rounded-t-[40px] mt-[-40px] px-8 pt-10 pb-8 shadow-2xl">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View>
              {/* Height Segment */}
              <View className="bg-[#edf5ff] rounded-[32px] p-6 mb-6">
                <View className="flex-row items-center">
                  <View className="w-14 h-14 rounded-full bg-[#3274fd] items-center justify-center shadow-sm">
                    <FontAwesome5 name="ruler" size={24} color="#ffffff" />
                  </View>
                  <Text className="text-[20px] font-extrabold text-gray-800 ml-4">
                    Height
                  </Text>
                </View>
                <View
                  className={`bg-white rounded-[24px] h-20 mt-6 px-8 justify-center shadow-sm border-2 ${isHeightFocused ? 'border-blue-400' : 'border-transparent'
                    }`}
                >
                  <TextInput
                    className="text-[32px] font-bold text-gray-700 w-full"
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    placeholder="170"
                    placeholderTextColor="#9ca3af"
                    onFocus={() => setIsHeightFocused(true)}
                    onBlur={() => setIsHeightFocused(false)}
                  />
                </View>
              </View>

              {/* Weight Segment */}
              <View className="bg-[#fcf5ff] rounded-[32px] p-6 mb-10">
                <View className="flex-row items-center">
                  <View className="w-14 h-14 rounded-full bg-[#9e30ff] items-center justify-center shadow-sm">
                    <FontAwesome5 name="weight" size={22} color="#ffffff" />
                  </View>
                  <Text className="text-[20px] font-extrabold text-gray-800 ml-4">
                    Weight
                  </Text>
                </View>
                <View
                  className={`bg-white rounded-[24px] h-20 mt-6 px-8 justify-center shadow-sm border-2 ${isWeightFocused ? 'border-[#9e30ff]' : 'border-transparent'
                    }`}
                >
                  <TextInput
                    className="text-[32px] font-bold text-gray-700 w-full"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="70"
                    placeholderTextColor="#9ca3af"
                    onFocus={() => setIsWeightFocused(true)}
                    onBlur={() => setIsWeightFocused(false)}
                  />
                </View>
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              className="rounded-full mt-8 active:opacity-90"
              style={{
                shadowColor: '#3274fd',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <LinearGradient
                colors={['#3274fd', '#9e30ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20 }}
              >
                <View className="rounded-2xl flex-row items-center justify-center h-[68px]">
                  <Text
                    numberOfLines={1}
                    className="text-white text-[18px] font-bold mr-3 text-center"
                  >
                    Continue to Tracker
                  </Text>
                  <Ionicons name="arrow-forward" size={24} color="#ffffff" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </ScrollView>
    </View>
  );
}
