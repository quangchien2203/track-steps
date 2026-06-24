import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { router } from 'expo-router';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);

  useEffect(() => {
    console.log('onAuthStateChanged listener registered');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged triggered, user is:', user ? user.email : 'null');
      if (user) {
        console.log('Navigating to profile...');
        // Use a small timeout to ensure Expo Router is fully mounted and ready for routing
        setTimeout(() => {
          router.replace('/profile');
        }, 0);
      } else {
        setIsAuthInitializing(false);
      }
    });
    return unsubscribe;
  }, []);



  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/profile');
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Đã xảy ra lỗi, vui lòng thử lại sau.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Email không đúng định dạng.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Tài khoản này đã bị khóa.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Tài khoản không tồn tại.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Mật khẩu không chính xác.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Thông tin đăng nhập không chính xác.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Không thể kết nối Internet. Vui lòng kiểm tra lại mạng.';
          break;
      }
      
      Alert.alert('Lỗi đăng nhập', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthInitializing) {
    return (
      <LinearGradient
        colors={['#3274fd', '#9e30ff']}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ActivityIndicator size="large" color="#ffffff" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#3274fd', '#9e30ff']}
      style={{ flex: 1 }}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 justify-between px-8 py-10">
              <View className="flex-1 justify-center items-center mt-12">
                <View
                  className="w-28 h-28 rounded-full bg-white items-center justify-center shadow-lg"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 5,
                  }}
                >
                  <Ionicons name="footsteps" size={56} color="#3274fd" />
                </View>
                <Text className="text-white text-[42px] font-bold text-center mt-8 tracking-tight">
                  Step Tracker
                </Text>
                <Text className="text-white/90 text-[17px] text-center mt-3 font-medium px-4 leading-6">
                  Track your daily steps and reach your goals
                </Text>
                <View className="w-full mt-10">
                  <View
                    className={`bg-white/95 rounded-2xl h-16 flex-row items-center px-6 shadow-sm border-2 ${isEmailFocused ? 'border-blue-400 bg-white' : 'border-transparent'
                      }`}
                  >
                    <TextInput
                      className="flex-1 h-full text-[17px] text-gray-800"
                      placeholder="Email"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => setIsEmailFocused(false)}
                      editable={!isLoading}
                    />
                  </View>
                  <View
                    className={`bg-white/95 rounded-2xl h-16 flex-row items-center px-6 shadow-sm mt-4 border-2 ${isPasswordFocused ? 'border-blue-400 bg-white' : 'border-transparent'
                      }`}
                  >
                    <TextInput
                      className="flex-1 h-full text-[17px] text-gray-800"
                      placeholder="Password"
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      editable={!isLoading}
                    />
                    <Ionicons name="lock-closed-outline" size={24} color="#9ca3af" />
                  </View>
                  <TouchableOpacity
                    className={`py-5 items-center justify-center mt-8 active:opacity-75 ${
                      isLoading ? 'opacity-60' : ''
                    }`}
                    onPress={handleSignIn}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#5533FF" />
                    ) : (
                      <Text className="text-xl font-bold text-[#5533FF]">
                        Sign In
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <View className="items-center mt-8">
                <Text className="text-white/70 text-[14px] text-center font-normal">
                  Firebase Authentication Mode
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
