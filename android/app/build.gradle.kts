plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.porttennanttandoori.pos"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.porttennanttandoori.pos"
        // Sunmi V2 terminals ship Android 7.1-9 depending on batch; 24 covers all of them.
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"https://api.porttennanttandoori.co.uk\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"https://api.porttennanttandoori.co.uk\"")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // minSdk 24 terminals don't have java.time natively - desugaring backports it so the
        // token-expiry parsing (Instant.parse on the backend's DateTimeOffset strings) just works.
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
        aidl = true
    }
    // Compose compiler version is resolved by the org.jetbrains.kotlin.plugin.compose plugin
    // (matched to the Kotlin version above) - composeOptions.kotlinCompilerExtensionVersion is
    // the pre-Kotlin-2.0 way and no longer applies.

    packaging {
        resources.excludes.add("/META-INF/{AL2.0,LGPL2.1}")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    // Only needed for the Theme.Material3.DayNight.NoActionBar window theme in themes.xml -
    // actual UI theming happens in ui/theme/Theme.kt via Compose, not Material Components views.
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.8.4")

    // Networking - OkHttp for the raw SSE stream (server-sent events don't fit Retrofit's
    // request/response model), Retrofit for the regular REST calls, kotlinx.serialization for
    // JSON so response shapes are plain data classes matching the backend's camelCase DTOs.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Local persistence: DataStore for the device auth token, Room for the offline order/print
    // queue so a dropped connection doesn't lose orders that already arrived.
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.3")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
