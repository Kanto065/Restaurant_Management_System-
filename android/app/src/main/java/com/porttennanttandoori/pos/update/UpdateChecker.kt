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

// Field names match GitHub's REST API response verbatim (snake_case), not this project's usual
// camelCase DTO convention, so kotlinx.serialization can decode it with zero extra config.
@Serializable
private data class GitHubReleaseAsset(val name: String, val browser_download_url: String)

@Serializable
private data class GitHubRelease(val tag_name: String, val name: String, val assets: List<GitHubReleaseAsset>)

data class AvailableUpdate(val label: String, val buildNumber: Int, val downloadUrl: String)

/** Polls this repo's public GitHub Releases for a newer POS build than the one currently running,
 * downloads its APK, and hands back an install Intent. Release tags look like "pos-v0.1.<N>",
 * where N is both the CI run number (android-release.yml) and versionName's own patch digit
 * (build.gradle.kts) - one number, so this and Android's own "is this an update" versionCode
 * check always agree. Uses a bare OkHttp client with none of NetworkModule's auth wiring, since
 * this talks to GitHub, not our API. */
class UpdateChecker(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun checkForUpdate(): AvailableUpdate? = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("https://api.github.com/repos/$REPO/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .build()
        runCatching {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val release = json.decodeFromString<GitHubRelease>(response.body?.string() ?: return@withContext null)
                val buildNumber = release.tag_name.substringAfterLast('.').toIntOrNull() ?: return@withContext null
                if (buildNumber <= BuildConfig.POS_BUILD_NUMBER) return@withContext null
                val apkUrl = release.assets.firstOrNull { it.name.endsWith(".apk") }?.browser_download_url
                    ?: return@withContext null
                AvailableUpdate(release.name, buildNumber, apkUrl)
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
        const val REPO = "Kanto065/Restaurant_Management_System-"
    }
}
