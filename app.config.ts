// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: com.credify.facial
// This is used for both iOS and Android package identification
const bundleId = "com.credify.facial";

// Extract timestamp from bundle ID for deep link scheme
// e.g., "com.credify.facial" -> "credifyfacial"
const schemeFromBundleId = "credifyfacial";

const env = {
  // App branding - Update these values
  appName: "Credify Facial Recognition",
  appSlug: "credify-facial-recognition",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  // iOS Configuration
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    // Permissions for camera and microphone
    infoPlist: {
      NSCameraUsageDescription: "We need access to your camera to capture facial recognition images.",
      NSMicrophoneUsageDescription: "We need access to your microphone for audio processing.",
    },
  },

  // Android Configuration
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "POST_NOTIFICATIONS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },

  // Plugins
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          minSdkVersion: 24,
        },
        ios: {
          deploymentTarget: "15.1",
        },
      },
    ],
  ],

  // Experiments
  experiments: {
    typedRoutes: true,
  },

  // EAS Project Configuration
  extra: {
    eas: {
      projectId: "aa079e59-f348-4a11-adba-70636f56f33d",
    },
  },
};

export default config;
