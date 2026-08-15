package com.porttennanttandoori.pos.ui.login

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/** Shown when no device is paired yet. An admin generates the id + secret (and a QR code
 * encoding both) from the dashboard's Restaurant Settings > Devices page - scanning it pairs
 * immediately, or the id/secret can be typed in by hand as a fallback. */
@Composable
fun PairingScreen(viewModel: PairingViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showScanner by remember { mutableStateOf(false) }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) showScanner = true }

    if (showScanner) {
        QrScannerScreen(
            onResult = { rawValue -> showScanner = false; viewModel.pairFromQr(rawValue) },
            onCancel = { showScanner = false },
        )
        return
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "Pair this terminal",
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = "Scan the QR code shown when this terminal was registered in the admin dashboard, " +
                    "or enter the device ID and secret by hand.",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
            )

            Button(
                onClick = {
                    val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                        PackageManager.PERMISSION_GRANTED
                    if (granted) showScanner = true else cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                },
                enabled = !uiState.isSubmitting,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Scan QR to pair") }

            HorizontalDivider(modifier = Modifier.padding(vertical = 20.dp))

            OutlinedTextField(
                value = uiState.deviceId,
                onValueChange = viewModel::onDeviceIdChanged,
                label = { Text("Device ID") },
                singleLine = true,
                enabled = !uiState.isSubmitting,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = uiState.secret,
                onValueChange = viewModel::onSecretChanged,
                label = { Text("Secret") },
                singleLine = true,
                enabled = !uiState.isSubmitting,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
            )

            uiState.errorMessage?.let { message ->
                Text(
                    text = message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }

            OutlinedButton(
                onClick = viewModel::pair,
                enabled = !uiState.isSubmitting,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp),
            ) {
                if (uiState.isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(18.dp),
                        strokeWidth = 2.dp,
                    )
                }
                Text(if (uiState.isSubmitting) "Pairing..." else "Pair terminal")
            }
        }
    }
}
