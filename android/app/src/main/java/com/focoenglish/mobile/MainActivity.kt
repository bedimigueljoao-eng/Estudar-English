package com.focoenglish.mobile

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(StudyTimerPlugin::class.java)
        registerPlugin(PdfVaultPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
