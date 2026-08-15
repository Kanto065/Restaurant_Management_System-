package com.porttennanttandoori.pos.update

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.porttennanttandoori.pos.BuildConfig
import java.io.File
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

/** Matches the version.json android-release.yml writes alongside the APK in MinIO. */
@Serializable
private data class VersionManifest(val buildNumber: Int, val versionName: String)

data class AvailableUpdate(val label: String, val buildNumber: Int, val downloadUrl: String)

/** Polls admin.porttennanttandoori.co.uk/download/pos-version for a newer POS build than the one
 * currently running, and hands back the fixed /download/pos APK URL to install if so. Both are
 * self-hosted (android-release.yml re-publishes them to MinIO on every build - see
 * deploy/caddy/Caddyfile) rather than GitHub's Releases API, which this used before: GitHub
 * releases need an auth token to read once the repo goes private, and the POS app has no way to
 * carry one. Uses a bare OkHttp client with none of NetworkModule's auth wiring, since this
 * doesn't go through our own API either. */
class UpdateChecker(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun checkForUpdate(): AvailableUpdate? = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$BASE_URL/download/pos-version").build()
        runCatching {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val manifest = json.decodeFromString<VersionManifest>(response.body?.string() ?: return@withContext null)
                if (manifest.buildNumber <= BuildConfig.POS_BUILD_NUMBER) return@withContext null
                AvailableUpdate("POS v${manifest.versionName}", manifest.buildNumber, "$BASE_URL/download/pos")
            }
        }.getOrNull()
    }

    /** Downloads to the app's cache dir, overwriting any previous download - the FileProvider
     * grant below only needs to survive long enough for the installer to read it. */
    suspend fun download(update: AvailableUpdate): File = withContext(Dispatchers.IO) {
        val target = File(context.cacheDir, "pos-update.apk")
        client.newCall(Request.Builder().url(update.downloadUrl).build()).execute().use { response ->
            val body = response.body ?: error("Empty download response for ${update.downloadUrl}")
            target.outputStream().use { out -> body.byteStream().copyTo(out) }
        }
        target
    }

    fun installIntent(apkFile: File): Intent {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    private companion object {
        const val BASE_URL = "https://admin.porttennanttandoori.co.uk"
    }
}
