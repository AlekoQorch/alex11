package ge.autodialer.sms

import android.app.Application
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.lifecycle.AndroidViewModel
import kotlinx.coroutines.flow.StateFlow

class AutoDialerViewModel(application: Application) : AndroidViewModel(application) {

    private val callHelper = CallHelper(application)
    private val smsSender = SmsSender(application)
    private val dialerManager = AutoDialerManager(application, callHelper)

    val dialerState: StateFlow<AutoDialerState> = dialerManager.state
    val smsTemplates: List<SmsTemplate> = SmsTemplates.defaults

    fun updateNumbersFromText(text: String) {
        dialerManager.setNumbers(PhoneNumberParser.parse(text))
    }

    fun startAutoDial(text: String) {
        val numbers = PhoneNumberParser.parse(text)
        dialerManager.start(numbers)
    }

    fun stopAutoDial() {
        dialerManager.stop()
    }

    fun sendSms(phoneNumber: String, template: SmsTemplate) {
        smsSender.send(phoneNumber, template.message)
    }

    fun isDefaultDialer(): Boolean {
        val context = getApplication<Application>()
        val telecomManager = context.getSystemService(TelecomManager::class.java)
        return telecomManager.defaultDialerPackage == context.packageName
    }

    fun createDefaultDialerIntent(): Intent? {
        val context = getApplication<Application>()
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = context.getSystemService(RoleManager::class.java)
            roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
        } else {
            Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, context.packageName)
            }
        }
    }

    fun createAccessibilitySettingsIntent(): Intent {
        return Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
    }
}
