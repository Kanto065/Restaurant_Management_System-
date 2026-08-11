package com.porttennanttandoori.pos.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/** Shown when no device is paired yet. An admin generates the id + secret from the dashboard's
 * Restaurant Settings > Devices page (Admin/DevicesController.Create) and reads them out to
 * whoever is setting up the terminal - there's no QR/barcode flow yet. */
@Composable
fun PairingScreen(viewModel: PairingViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

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
                text = "Enter the device ID and secret shown when this terminal was registered in the admin dashboard.",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
            )

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

            Button(
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
