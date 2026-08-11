package com.porttennanttandoori.pos.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.porttennanttandoori.pos.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PairingUiState(
    val deviceId: String = "",
    val secret: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val pairedRestaurantName: String? = null,
)

class PairingViewModel(private val authRepository: AuthRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(PairingUiState())
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    fun onDeviceIdChanged(value: String) {
        _uiState.value = _uiState.value.copy(deviceId = value, errorMessage = null)
    }

    fun onSecretChanged(value: String) {
        _uiState.value = _uiState.value.copy(secret = value, errorMessage = null)
    }

    fun pair() {
        val state = _uiState.value
        val deviceId = state.deviceId.trim()
        val secret = state.secret.trim()

        if (deviceId.isEmpty() || secret.isEmpty()) {
            _uiState.value = state.copy(errorMessage = "Enter both the device ID and secret.")
            return
        }

        _uiState.value = state.copy(isSubmitting = true, errorMessage = null)
        viewModelScope.launch {
            val result = authRepository.pairAndLogin(deviceId, secret)
            result.fold(
                onSuccess = { token ->
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        pairedRestaurantName = token.restaurantName,
                    )
                },
                onFailure = { error ->
                    _uiState.value = _uiState.value.copy(
                        isSubmitting = false,
                        errorMessage = error.message ?: "Pairing failed.",
                    )
                },
            )
        }
    }

    class Factory(private val authRepository: AuthRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return PairingViewModel(authRepository) as T
        }
    }
}
