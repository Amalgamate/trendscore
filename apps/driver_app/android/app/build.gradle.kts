plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "co.trendscore.driver_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // One universal install identity; school selection happens at runtime.
        applicationId = "co.trendscore.driver"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        manifestPlaceholders["appLabel"] = "TrendsCORE Driver"
    }

    signingConfigs {
        // Release signing. This is NOT optional for a sideloaded APK: the same
        // keystore must sign every future build or Android refuses the update.
        //
        // Back up android/upload-keystore.jks AND its passwords somewhere you
        // can reach without this machine. If they are lost, drivers must
        // uninstall and reinstall, losing their session and queued boarding
        // events.
        create("release") {
            val keystorePath = System.getenv("TRENDS_KEYSTORE_PATH")
            if (keystorePath != null && file(keystorePath).exists()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("TRENDS_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TRENDS_KEY_ALIAS")
                keyPassword = System.getenv("TRENDS_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            val releaseSigning = signingConfigs.findByName("release")
            // Fall back to debug keys only so `flutter run --release` still works
            // on a fresh checkout. A real distribution build must set
            // TRENDS_KEYSTORE_PATH — see scripts/build-driver-app.mjs.
            signingConfig = if (
                releaseSigning?.storeFile != null &&
                System.getenv("TRENDS_KEYSTORE_PATH") != null
            ) {
                releaseSigning
            } else {
                logger.warn(
                    "[driver_app] No release keystore configured — signing with debug keys. " +
                        "DO NOT distribute this APK; set TRENDS_KEYSTORE_PATH first."
                )
                signingConfigs.getByName("debug")
            }

            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

flutter {
    source = "../.."
}
