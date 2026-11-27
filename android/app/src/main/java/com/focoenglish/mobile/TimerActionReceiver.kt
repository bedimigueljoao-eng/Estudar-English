package com.focoenglish.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TimerActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val serviceIntent = Intent(context, StudyTimerService::class.java).apply {
            this.action = action
        }
        context.startService(serviceIntent)
    }
}
