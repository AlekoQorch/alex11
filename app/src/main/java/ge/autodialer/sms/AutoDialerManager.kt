package ge.autodialer.sms

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class DialerStatus {
    IDLE,
    DIALING,
    RINGING,
    ANSWERED,
    ENDED,
    PAUSED
}

data class AutoDialerState(
    val status: DialerStatus = DialerStatus.IDLE,
    val numbers: List<String> = emptyList(),
    val currentIndex: Int = 0,
    val currentNumber: String? = null,
    val completedCount: Int = 0,
    val secondsRemaining: Int = 30,
    val statusMessage: String = "მზად ხართ დასაწყებად",
    val lastResult: String? = null
)

class AutoDialerManager(
    private val context: Context,
    private val callHelper: CallHelper,
    private val timeoutSeconds: Int = 30
) {
    private val handler = Handler(Looper.getMainLooper())
    private val telephonyManager = context.getSystemService(TelephonyManager::class.java)

    private val _state = MutableStateFlow(AutoDialerState())
    val state: StateFlow<AutoDialerState> = _state.asStateFlow()

    private var queue: List<String> = emptyList()
    private var currentIndex = 0
    private var isRunning = false
    private var callAnswered = false
    private var callFinishedHandled = false
    private var timeoutRunnable: Runnable? = null
    private var countdownRunnable: Runnable? = null
    private var secondsLeft = timeoutSeconds

    private val legacyListener = object : PhoneStateListener() {
        @Deprecated("Deprecated in Java")
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            handleCallState(state)
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private val telephonyCallback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) {
            handleCallState(state)
        }
    }

    private var callbackRegistered = false

    fun start(numbers: List<String>) {
        if (numbers.isEmpty()) {
            updateState(statusMessage = "შეიყვანეთ მაინც ერთი ნომერი")
            return
        }
        stopInternal(resetQueue = false)
        queue = numbers
        currentIndex = 0
        isRunning = true
        registerPhoneListener()
        dialNext()
    }

    fun stop() {
        stopInternal(resetQueue = true)
        callHelper.endCall()
    }

    fun pause() {
        isRunning = false
        cancelTimers()
        updateState(status = DialerStatus.PAUSED, statusMessage = "დაპაუზებულია")
    }

    fun resume() {
        if (queue.isEmpty()) return
        isRunning = true
        updateState(status = DialerStatus.IDLE, statusMessage = "გაგრძელება...")
        if (_state.value.status == DialerStatus.PAUSED) {
            dialNext()
        }
    }

    private fun dialNext() {
        if (!isRunning) return

        cancelTimers()
        callAnswered = false
        callFinishedHandled = false

        if (currentIndex >= queue.size) {
            finishQueue("ყველა ნომერზე დარეკვა დასრულდა")
            return
        }

        val number = queue[currentIndex]
        updateState(
            status = DialerStatus.DIALING,
            currentIndex = currentIndex,
            currentNumber = number,
            secondsRemaining = timeoutSeconds,
            statusMessage = "ირეკება: $number (${currentIndex + 1}/${queue.size})"
        )

        val placed = callHelper.placeCall(number)
        if (!placed) {
            updateState(
                lastResult = "$number — ვერ დარეკა",
                statusMessage = "შეცდომა: $number"
            )
            currentIndex++
            handler.postDelayed({ dialNext() }, 1500)
            return
        }

        secondsLeft = timeoutSeconds
        startCountdown()
        startTimeout()
    }

    private fun startTimeout() {
        timeoutRunnable = Runnable {
            if (!callAnswered && isRunning) {
                callHelper.endCall()
                onCallFinished(answered = false)
            }
        }
        handler.postDelayed(timeoutRunnable!!, timeoutSeconds * 1000L)
    }

    private fun startCountdown() {
        countdownRunnable = object : Runnable {
            override fun run() {
                if (!isRunning || callAnswered) return
                secondsLeft--
                updateState(secondsRemaining = secondsLeft.coerceAtLeast(0))
                if (secondsLeft > 0) {
                    handler.postDelayed(this, 1000L)
                }
            }
        }
        handler.postDelayed(countdownRunnable!!, 1000L)
    }

    private fun cancelTimers() {
        timeoutRunnable?.let { handler.removeCallbacks(it) }
        countdownRunnable?.let { handler.removeCallbacks(it) }
        timeoutRunnable = null
        countdownRunnable = null
    }

    private fun handleCallState(state: Int) {
        if (!isRunning) return

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                updateState(status = DialerStatus.RINGING)
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (DialerInCallService.isCallAnswered()) {
                    onAnswered()
                } else {
                    handler.postDelayed({
                        if (isRunning && !callAnswered && DialerInCallService.isCallAnswered()) {
                            onAnswered()
                        }
                    }, 500)
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (_state.value.status != DialerStatus.DIALING &&
                    _state.value.status != DialerStatus.RINGING &&
                    _state.value.status != DialerStatus.ANSWERED &&
                    _state.value.status != DialerStatus.IDLE
                ) return

                if (_state.value.status == DialerStatus.DIALING ||
                    _state.value.status == DialerStatus.RINGING
                ) {
                    onCallFinished(answered = callAnswered)
                } else if (_state.value.status == DialerStatus.ANSWERED) {
                    onCallFinished(answered = true)
                }
            }
        }
    }

    private fun onAnswered() {
        if (callAnswered) return
        callAnswered = true
        cancelTimers()
        updateState(
            status = DialerStatus.ANSWERED,
            statusMessage = "მიპასუხეს: ${_state.value.currentNumber}",
            secondsRemaining = 0
        )
    }

    private fun onCallFinished(answered: Boolean) {
        if (callFinishedHandled) return
        if (!isRunning && _state.value.status == DialerStatus.IDLE) return

        callFinishedHandled = true
        cancelTimers()
        val number = _state.value.currentNumber ?: queue.getOrNull(currentIndex) ?: return
        val result = if (answered) {
            "$number — მიპასუხეს ✓"
        } else {
            "$number — არ მიპასუხეს (30 წმ)"
        }

        currentIndex++
        val completed = currentIndex

        updateState(
            status = DialerStatus.ENDED,
            completedCount = completed,
            lastResult = result,
            statusMessage = result
        )

        handler.postDelayed({
            if (isRunning) dialNext()
        }, 2000)
    }

    private fun finishQueue(message: String) {
        isRunning = false
        cancelTimers()
        unregisterPhoneListener()
        updateState(
            status = DialerStatus.IDLE,
            currentNumber = null,
            statusMessage = message,
            secondsRemaining = timeoutSeconds
        )
    }

    private fun stopInternal(resetQueue: Boolean) {
        isRunning = false
        cancelTimers()
        unregisterPhoneListener()
        if (resetQueue) {
            queue = emptyList()
            currentIndex = 0
            updateState(
                status = DialerStatus.IDLE,
                numbers = emptyList(),
                currentIndex = 0,
                currentNumber = null,
                secondsRemaining = timeoutSeconds,
                statusMessage = "გაჩერებულია"
            )
        }
    }

    private fun registerPhoneListener() {
        if (callbackRegistered) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            telephonyManager.registerTelephonyCallback(
                context.mainExecutor,
                telephonyCallback
            )
        } else {
            @Suppress("DEPRECATION")
            telephonyManager.listen(legacyListener, PhoneStateListener.LISTEN_CALL_STATE)
        }
        callbackRegistered = true
    }

    private fun unregisterPhoneListener() {
        if (!callbackRegistered) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            telephonyManager.unregisterTelephonyCallback(telephonyCallback)
        } else {
            @Suppress("DEPRECATION")
            telephonyManager.listen(legacyListener, PhoneStateListener.LISTEN_NONE)
        }
        callbackRegistered = false
    }

    private fun updateState(
        status: DialerStatus = _state.value.status,
        numbers: List<String> = _state.value.numbers,
        currentIndex: Int = _state.value.currentIndex,
        currentNumber: String? = _state.value.currentNumber,
        completedCount: Int = _state.value.completedCount,
        secondsRemaining: Int = _state.value.secondsRemaining,
        statusMessage: String = _state.value.statusMessage,
        lastResult: String? = _state.value.lastResult
    ) {
        _state.value = AutoDialerState(
            status = status,
            numbers = numbers,
            currentIndex = currentIndex,
            currentNumber = currentNumber,
            completedCount = completedCount,
            secondsRemaining = secondsRemaining,
            statusMessage = statusMessage,
            lastResult = lastResult
        )
    }

    fun setNumbers(numbers: List<String>) {
        updateState(numbers = numbers)
    }
}
