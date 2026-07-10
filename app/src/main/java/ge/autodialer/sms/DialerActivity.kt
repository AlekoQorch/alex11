package ge.autodialer.sms

import android.app.Activity
import android.os.Bundle

/**
 * Minimal dialer activity required for the default-phone-app role.
 * Auto-dialing is handled from [MainActivity].
 */
class DialerActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        finish()
    }
}
