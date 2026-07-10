package ge.autodialer.sms

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.telecom.TelecomManager
import android.telephony.SmsManager
import android.widget.Toast

class SmsSender(private val context: Context) {

    fun send(phoneNumber: String, message: String): Boolean {
        if (phoneNumber.isBlank() || message.isBlank()) return false

        return try {
            val smsManager = context.getSystemService(SmsManager::class.java)
            smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            Toast.makeText(context, "SMS გაიგზავნა: $phoneNumber", Toast.LENGTH_SHORT).show()
            true
        } catch (e: SecurityException) {
            Toast.makeText(context, "SMS-ის გაგზავნის ნებართვა არ არის", Toast.LENGTH_LONG).show()
            false
        } catch (e: Exception) {
            Toast.makeText(context, "SMS ვერ გაიგზავნა: ${e.message}", Toast.LENGTH_LONG).show()
            false
        }
    }
}

class CallHelper(private val context: Context) {

    fun placeCall(phoneNumber: String): Boolean {
        return try {
            val telecomManager = context.getSystemService(TelecomManager::class.java)
            val uri = Uri.fromParts("tel", phoneNumber, null)
            telecomManager.placeCall(uri, null)
            true
        } catch (_: SecurityException) {
            try {
                val intent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$phoneNumber")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                true
            } catch (e: Exception) {
                false
            }
        }
    }

    fun endCall(): Boolean {
        if (DialerInCallService.endActiveCall()) return true
        if (EndCallAccessibilityService.requestEndCall()) return true

        return try {
            val telecomManager = context.getSystemService(TelecomManager::class.java)
            @Suppress("DEPRECATION")
            telecomManager.endCall()
        } catch (_: Exception) {
            false
        }
    }
}
