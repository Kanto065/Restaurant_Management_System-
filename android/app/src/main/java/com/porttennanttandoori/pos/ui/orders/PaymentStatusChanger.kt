package com.porttennanttandoori.pos.ui.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.porttennanttandoori.pos.data.model.PaymentStatus
import com.porttennanttandoori.pos.data.model.PaymentStatusDefinitionDto

/** Payment-status counterpart to OrderStatusChanger.kt - same chip/arrow/check/overflow shape,
 * colored by paymentBackgroundColor/paymentForegroundColor (semantic by name, e.g. Paid=green)
 * rather than statusBackgroundColor's plain positional cycle. "Paid" here is whichever payment
 * status definition is flagged isDefault=false and comes right after the default one is NOT a
 * safe assumption (payment statuses don't carry a countsAsCompleted-style flag), so the check
 * button jumps to the definition named "Paid" if one exists - same semantic-name reliance as the
 * color mapping above. */
@Composable
fun PaymentStatusChanger(
    currentStatus: PaymentStatus,
    paymentStatusDefinitions: List<PaymentStatusDefinitionDto>,
    isUpdating: Boolean,
    onQuickChange: (PaymentStatus) -> Unit,
    onOpenNoteDialog: () -> Unit,
) {
    val sorted = paymentStatusDefinitions.sortedBy { it.displayOrder }
    val currentIndex = sorted.indexOfFirst { it.name == currentStatus }
    val currentDisplayOrder = sorted.getOrNull(currentIndex)?.displayOrder ?: 0
    val nextStatus = sorted.getOrNull(currentIndex + 1)?.takeIf { currentIndex != -1 }?.name
    val paidStatus = paymentStatusDefinitions.firstOrNull { it.name.equals("Paid", ignoreCase = true) }?.name

    var chipMenuExpanded by remember { mutableStateOf(false) }
    var overflowMenuExpanded by remember { mutableStateOf(false) }

    val bg = paymentBackgroundColor(currentStatus, currentDisplayOrder)
    val fg = paymentForegroundColor(currentStatus, currentDisplayOrder)

    Row(verticalAlignment = Alignment.CenterVertically) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(8.dp))
                .background(bg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box {
                Text(
                    text = currentStatus,
                    color = fg,
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    modifier = Modifier
                        .clickable(enabled = !isUpdating) { chipMenuExpanded = true }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                )
                DropdownMenu(expanded = chipMenuExpanded, onDismissRequest = { chipMenuExpanded = false }) {
                    sorted.forEach { definition ->
                        DropdownMenuItem(
                            text = { Text(definition.name) },
                            onClick = { chipMenuExpanded = false; onQuickChange(definition.name) },
                        )
                    }
                }
            }

            StatusChangerDivider(fg)
            IconButton(
                enabled = nextStatus != null && !isUpdating,
                onClick = { nextStatus?.let(onQuickChange) },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Outlined.ArrowForward,
                    contentDescription = "Next payment status" + (nextStatus?.let { ": $it" } ?: ""),
                    tint = fg,
                    modifier = Modifier.size(18.dp),
                )
            }
            StatusChangerDivider(fg)
            IconButton(
                enabled = paidStatus != null && paidStatus != currentStatus && !isUpdating,
                onClick = { paidStatus?.let(onQuickChange) },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Outlined.Check,
                    contentDescription = paidStatus?.let { "Mark as $it" } ?: "No \"Paid\" status configured",
                    tint = fg,
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        Box {
            IconButton(onClick = { overflowMenuExpanded = true }) {
                Icon(Icons.Outlined.MoreVert, contentDescription = "More payment options")
            }
            DropdownMenu(expanded = overflowMenuExpanded, onDismissRequest = { overflowMenuExpanded = false }) {
                DropdownMenuItem(
                    text = { Text("Jump to Payment Status") },
                    onClick = { overflowMenuExpanded = false; onOpenNoteDialog() },
                )
            }
        }
    }
}
