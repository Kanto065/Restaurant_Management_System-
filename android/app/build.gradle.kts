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

    // CI passes -PposBuildNumber=$GITHUB_RUN_NUMBER. GitHub run numbers only ever go up for this
    // repo, so using it directly as versionCode (Android's own "is this newer" check, separate
    // from versionName/UpdateChecker's comparison) guarantees every release installs as an update
    // over the last one instead of tripping "app not installed" on a same/lower versionCode.
    // Local/dev builds get 0 - not a valid versionCode, so bumped to 1 just for that case.
    val posBuildNumber = (project.findProperty("posBuildNumber") as String?)?.toIntOrNull() ?: 0

    signingConfigs {
        // Committed on purpose - a debug key secures nothing (anyone can read it out of the repo
        // or generate their own), and it exists ONLY so every CI-built APK is signed with the
        // SAME key run to run. Without this, Gradle falls back to an auto-generated
        // ~/.android/debug.keystore that's different on every fresh CI runner, and Android refuses
        // to install an update signed by a different key than what's already on the device -
        // exactly the "conflicts with an existing package" error that forced an uninstall before
        // this existed.
        getByName("debug") {
            storeFile = file("keystore/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    defaultConfig {
        applicationId = "com.porttennanttandoori.pos"
        // Sunmi V2 terminals ship Android 7.1-9 depending on batch; 24 covers all of them.
        minSdk = 24
        targetSdk = 34
        versionCode = posBuildNumber.coerceAtLeast(1)
        // Real, monotonically-increasing version string - matches versionCode 1:1 so "version"
        // means the same thing everywhere (Settings screen, GitHub release name/tag, Android's
        // own version display) instead of a fixed "0.1.0" with the actual build number stuck in
        // a trailing "(build N)". 0.1.0 stays as the base for local/dev builds only.
        versionName = if (posBuildNumber > 0) "0.1.$posBuildNumber" else "0.1.0"

        // UpdateChecker compares this against the latest GitHub release tag's suffix to decide
        // whether a newer build exists - kept as its own field (rather than reading versionCode)
        // so that check stays meaningful even if versionCode's source ever changes.
        buildConfigField("int", "POS_BUILD_NUMBER", posBuildNumber.toString())
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
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
    // Outline-style icon set matching the admin dashboard's lucide-react icons (bottom nav,
    // status-changer arrow/check/more, search/filter) - material-icons-core only covers a small
    // common subset that doesn't include History/Notifications/FilterList.
    implementation("androidx.compose.material:material-icons-extended")
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

    // QR scanning for device pairing: CameraX drives the live preview, ML Kit's on-device barcode
    // model decodes frames - no network call and no Play Services dependency at runtime beyond
    // what ML Kit bundles itself.
    val cameraxVersion = "1.4.1"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
