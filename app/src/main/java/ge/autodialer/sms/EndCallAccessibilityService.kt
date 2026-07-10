package ge.autodialer.sms

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class EndCallAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!endCallRequested) return
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val root = rootInActiveWindow ?: return
        if (findAndClickEndCall(root)) {
            endCallRequested = false
        }
    }

    override fun onInterrupt() = Unit

    companion object {
        @Volatile
        var endCallRequested = false
            private set

        fun requestEndCall(): Boolean {
            endCallRequested = true
            return instance != null
        }

        @Volatile
        private var instance: EndCallAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    private fun findAndClickEndCall(node: AccessibilityNodeInfo): Boolean {
        val endCallLabels = listOf(
            "End call", "Hang up", "გათიშვა", "დასრულება",
            "end_call", "decline", "Reject"
        )

        for (label in endCallLabels) {
            val matches = node.findAccessibilityNodeInfosByText(label)
            for (match in matches) {
                if (clickNode(match)) return true
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            if (findAndClickEndCall(child)) return true
        }
        return false
    }

    private fun clickNode(node: AccessibilityNodeInfo): Boolean {
        if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            return true
        }
        var parent = node.parent
        while (parent != null) {
            if (parent.isClickable && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true
            }
            parent = parent.parent
        }
        return false
    }
}
