package com.porttennanttandoori.pos.ui.orders

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.porttennanttandoori.pos.data.model.OrderStatus
import com.porttennanttandoori.pos.data.model.OrderStatusDefinitionDto

/** Recreates admin-frontend/src/pages/Orders.tsx's inline status control: a colored chip showing
 * the current status (tap to jump straight to any other one), an arrow button that steps to the
 * next status in DisplayOrder, a check button that jumps straight to whichever status
 * CountsAsCompleted, and a "..." overflow for the full note-taking dialog. Quick actions (chip,
 * arrow, check) send no note - only the overflow dialog does, matching quickStatusMutation vs
 * updateStatusMutation on the admin side. */
@Composable
fun OrderStatusChanger(
    currentStatus: OrderStatus,
    statusDefinitions: List<OrderStatusDefinitionDto>,
    isUpdating: Boolean,
    onQuickChange: (OrderStatus) -> Unit,
    onOpenNoteDialog: () -> Unit,
) {
    val sorted = statusDefinitions.sortedBy { it.displayOrder }
    val currentIndex = sorted.indexOfFirst { it.name == currentStatus }
    val currentDisplayOrder = sorted.getOrNull(currentIndex)?.displayOrder ?: 0
    val nextStatus = sorted.getOrNull(currentIndex + 1)?.takeIf { currentIndex != -1 }?.name
    val doneStatus = statusDefinitions.firstOrNull { it.countsAsCompleted }?.name

    var chipMenuExpanded by remember { mutableStateOf(false) }
    var overflowMenuExpanded by remember { mutableStateOf(false) }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(8.dp))
                .background(statusBackgroundColor(currentDisplayOrder)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box {
                Text(
                    text = currentStatus,
                    color = statusForegroundColor(currentDisplayOrder),
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

            StatusChangerDivider(statusForegroundColor(currentDisplayOrder))
            IconButton(
                enabled = nextStatus != null && !isUpdating,
                onClick = { nextStatus?.let(onQuickChange) },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Outlined.ArrowForward,
                    contentDescription = "Next status" + (nextStatus?.let { ": $it" } ?: ""),
                    tint = statusForegroundColor(currentDisplayOrder),
                    modifier = Modifier.size(18.dp),
                )
            }
            StatusChangerDivider(statusForegroundColor(currentDisplayOrder))
            IconButton(
                enabled = doneStatus != null && doneStatus != currentStatus && !isUpdating,
                onClick = { doneStatus?.let(onQuickChange) },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    Icons.Outlined.Check,
                    contentDescription = doneStatus?.let { "Mark as $it" } ?: "No completed status configured",
                    tint = statusForegroundColor(currentDisplayOrder),
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        Box {
            IconButton(onClick = { overflowMenuExpanded = true }) {
                Icon(Icons.Outlined.MoreVert, contentDescription = "More status options")
            }
            DropdownMenu(expanded = overflowMenuExpanded, onDismissRequest = { overflowMenuExpanded = false }) {
                DropdownMenuItem(
                    text = { Text("Jump to Status (with note)") },
                    onClick = { overflowMenuExpanded = false; onOpenNoteDialog() },
                )
            }
        }
    }
}

@Composable
private fun StatusChangerDivider(color: Color) {
    Box(
        modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .padding(vertical = 8.dp)
            .background(color.copy(alpha = 0.25f)),
    )
}
