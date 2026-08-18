package com.porttennanttandoori.pos.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.porttennanttandoori.pos.BuildConfig
import com.porttennanttandoori.pos.R
import com.porttennanttandoori.pos.data.local.AlarmMode
import com.porttennanttandoori.pos.data.local.TerminalSettings

private data class PrinterOption(val id: String, val name: String, val detail: String, val available: Boolean)

private val PRINTER_OPTIONS = listOf(
    PrinterOption(TerminalSettings.PRINTER_SUNMI, "Sunmi internal printer", "80mm · built-in", available = true),
    PrinterOption(TerminalSettings.PRINTER_STAR, "Star TSP143", "USB · 80mm · coming soon", available = false),
    PrinterOption(TerminalSettings.PRINTER_EPSON, "Epson TM-T20III", "LAN · coming soon", available = false),
)

private val ALARM_MODES = listOf(
    AlarmMode.UNTIL_CONFIRMED to "Until confirmed or cancelled",
    AlarmMode.TEN_SECONDS to "Sound for 10 seconds",
    AlarmMode.THIRTY_SECONDS to "Sound for 30 seconds",
    AlarmMode.OFF to "No sound",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    restaurantName: String,
    settings: TerminalSettings,
    checkingForUpdate: Boolean,
    testingPrint: Boolean,
    onSetDarkTheme: (Boolean) -> Unit,
    onSetPrinter: (String) -> Unit,
    onSetCopies: (Int) -> Unit,
    onSetVolume: (Int) -> Unit,
    onSetAlarmMode: (AlarmMode) -> Unit,
    onTestPrint: () -> Unit,
    onCheckForUpdate: () -> Unit,
    onSignOut: () -> Unit,
) {
    var showSignOutConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Settings") }) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SettingsCard {
                Text(text = "Paired restaurant", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(text = restaurantName, style = MaterialTheme.typography.headlineSmall)
                Text(
                    text = "${stringResource(R.string.app_name)} · v${BuildConfig.VERSION_NAME}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SettingsCard {
                Text(text = "Appearance", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    ThemeOption("Light", selected = !settings.darkTheme, modifier = Modifier.weight(1f)) { onSetDarkTheme(false) }
                    ThemeOption("Dark", selected = settings.darkTheme, modifier = Modifier.weight(1f)) { onSetDarkTheme(true) }
                }
            }

            SettingsCard {
                Text(text = "Thermal printer", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Column(modifier = Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PRINTER_OPTIONS.forEach { option ->
                        PrinterRow(
                            option = option,
                            selected = settings.printerId == option.id,
                            onSelect = { if (option.available) onSetPrinter(option.id) },
                        )
                    }
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Copies per order", style = MaterialTheme.typography.bodyMedium)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { onSetCopies((settings.copiesPerOrder - 1).coerceAtLeast(1)) }) { Text("−") }
                        Text(settings.copiesPerOrder.toString(), style = MaterialTheme.typography.titleMedium)
                        IconButton(onClick = { onSetCopies((settings.copiesPerOrder + 1).coerceAtMost(3)) }) { Text("+") }
                    }
                }
                OutlinedButton(
                    onClick = onTestPrint,
                    enabled = !testingPrint,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                ) {
                    if (testingPrint) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp).padding(end = 8.dp), strokeWidth = 2.dp)
                    }
                    Text(if (testingPrint) "Printing test…" else "Test print")
                }
            }

            SettingsCard {
                Text(text = "New-order alarm", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("Volume", style = MaterialTheme.typography.bodyMedium)
                    Text("${settings.alarmVolume}%", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Slider(
                    value = settings.alarmVolume.toFloat(),
                    onValueChange = { onSetVolume(it.toInt()) },
                    valueRange = 0f..100f,
                )
                AlarmModeSelector(current = settings.alarmMode, onSelect = onSetAlarmMode)
            }

            OutlinedButton(onClick = onCheckForUpdate, enabled = !checkingForUpdate, modifier = Modifier.fillMaxWidth()) {
                if (checkingForUpdate) {
                    CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp).size(16.dp), strokeWidth = 2.dp)
                }
                Text(if (checkingForUpdate) "Checking..." else "Check for updates")
            }

            Button(
                onClick = { showSignOutConfirm = true },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Sign out this terminal")
            }
        }
    }

    if (showSignOutConfirm) {
        AlertDialog(
            onDismissRequest = { showSignOutConfirm = false },
            title = { Text("Sign out this terminal?") },
            text = { Text("You'll need the device ID and secret (or a fresh QR code) from the admin dashboard to pair it again.") },
            confirmButton = {
                TextButton(onClick = { showSignOutConfirm = false; onSignOut() }) { Text("Sign out") }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutConfirm = false }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun SettingsCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
private fun ThemeOption(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        modifier = modifier
            .padding(3.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) MaterialTheme.colorScheme.surface else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 11.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun PrinterRow(option: PrinterOption, selected: Boolean, onSelect: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) MaterialTheme.colorScheme.surfaceVariant else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(enabled = option.available, onClick = onSelect)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier = Modifier.size(18.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) Icon(Icons.Outlined.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        }
        Column {
            Text(
                option.name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (option.available) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(option.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AlarmModeSelector(current: AlarmMode, onSelect: (AlarmMode) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("How long it sounds", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Box {
            TextButton(onClick = { expanded = true }) {
                Text(ALARM_MODES.first { it.first == current }.second)
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                ALARM_MODES.forEach { (mode, label) ->
                    DropdownMenuItem(text = { Text(label) }, onClick = { expanded = false; onSelect(mode) })
                }
            }
        }
    }
}
