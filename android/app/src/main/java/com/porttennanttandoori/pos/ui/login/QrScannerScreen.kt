package com.porttennanttandoori.pos.ui.login

import android.Manifest
import android.content.pm.PackageManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/** Full-screen live camera preview that decodes the first QR code it sees and hands its raw text
 * to [onResult] - PairingViewModel expects that text to be the JSON payload the admin dashboard's
 * device QR encodes ({"deviceId": "...", "secret": "..."}, see Devices.tsx). Caller is responsible
 * for having already confirmed CAMERA permission (PairingScreen does this before navigating here). */
@Composable
fun QrScannerScreen(onResult: (String) -> Unit, onCancel: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasResult by remember { mutableStateOf(false) }
    val currentOnResult by rememberUpdatedState(onResult)

    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    // Reused across every analyzed frame - creating a new client per frame (as this did before)
    // reloads the on-device model each time and was the main source of the scanner feeling
    // choppy/laggy compared to the rest of the app.
    val barcodeScanner = remember { BarcodeScanning.getClient() }
    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
            barcodeScanner.close()
        }
    }

    Scaffold { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                    cameraProviderFuture.addListener(
                        {
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().apply {
                                surfaceProvider = previewView.surfaceProvider
                            }
                            val analysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .apply {
                                    setAnalyzer(cameraExecutor) { imageProxy ->
                                        analyzeFrame(imageProxy, barcodeScanner, onDecoded = { value ->
                                            if (!hasResult) {
                                                hasResult = true
                                                currentOnResult(value)
                                            }
                                        })
                                    }
                                }
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis,
                            )
                        },
                        ContextCompat.getMainExecutor(ctx),
                    )
                    previewView
                },
            )

            Column(modifier = Modifier.align(Alignment.BottomCenter).padding(24.dp)) {
                Text(
                    text = "Point the camera at the QR code shown in the admin dashboard.",
                    color = MaterialTheme.colorScheme.onBackground,
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(onClick = onCancel) { Text("Cancel, enter manually") }
            }
        }
    }
}

private fun analyzeFrame(imageProxy: ImageProxy, scanner: BarcodeScanner, onDecoded: (String) -> Unit) {
    val mediaImage = imageProxy.image
    if (mediaImage == null) {
        imageProxy.close()
        return
    }
    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
    scanner.process(image)
        .addOnSuccessListener { barcodes ->
            barcodes.firstOrNull { it.valueType == Barcode.TYPE_TEXT || it.rawValue != null }
                ?.rawValue?.let(onDecoded)
        }
        .addOnCompleteListener { imageProxy.close() }
}
