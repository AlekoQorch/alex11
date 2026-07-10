package ge.autodialer.sms

import android.telecom.Call
import android.telecom.InCallService

class DialerInCallService : InCallService() {

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCall = call
        call.registerCallback(callCallback)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        call.unregisterCallback(callCallback)
        if (activeCall == call) {
            activeCall = null
        }
    }

    companion object {
        @Volatile
        private var activeCall: Call? = null

        private val callCallback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                if (state == Call.STATE_DISCONNECTED) {
                    if (activeCall == call) activeCall = null
                }
            }
        }

        fun endActiveCall(): Boolean {
            val call = activeCall ?: return false
            return try {
                call.disconnect()
                true
            } catch (_: Exception) {
                false
            }
        }

        fun isCallAnswered(): Boolean {
            return activeCall?.details?.state == Call.STATE_ACTIVE
        }
    }
}
