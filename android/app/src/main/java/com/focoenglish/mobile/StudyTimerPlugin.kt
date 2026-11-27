package com.focoenglish.mobile

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "StudyTimer",
    permissions = [
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class StudyTimerPlugin : Plugin() {

    @PluginMethod
    fun startSession(call: PluginCall) {
        val intent = Intent(context, StudyTimerService::class.java).apply {
            action = StudyTimerService.ACTION_START
            putExtra(StudyTimerService.EXTRA_ACTIVITY, call.getString("activity", "Speaking"))
            putExtra(StudyTimerService.EXTRA_SKILL, call.getString("skill", "Speaking"))
            putExtra(StudyTimerService.EXTRA_LEVEL, call.getString("level", "A1"))
            putExtra(StudyTimerService.EXTRA_TOPIC, call.getString("topicTitle", "English Lesson"))
            putExtra(StudyTimerService.EXTRA_ACCUMULATED_MS, call.getLong("accumulatedMs") ?: 0L)
            putExtra(StudyTimerService.EXTRA_RESUMED_AT_MS, call.getLong("startedAtMs") ?: System.currentTimeMillis())
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun pauseSession(call: PluginCall) {
        val intent = Intent(context, StudyTimerService::class.java).apply {
            action = StudyTimerService.ACTION_PAUSE
        }
        context.startService(intent)
        call.resolve()
    }

    @PluginMethod
    fun resumeSession(call: PluginCall) {
        val intent = Intent(context, StudyTimerService::class.java).apply {
            action = StudyTimerService.ACTION_RESUME
            putExtra(StudyTimerService.EXTRA_ACCUMULATED_MS, call.getLong("accumulatedMs") ?: 0L)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun stopSession(call: PluginCall) {
        val intent = Intent(context, StudyTimerService::class.java).apply {
            action = StudyTimerService.ACTION_STOP
        }
        context.startService(intent)
        call.resolve()
    }

    @PluginMethod
    fun getActiveSession(call: PluginCall) {
        val prefs = context.getSharedPreferences(StudyTimerService.PREFS_NAME, Context.MODE_PRIVATE)
        val res = JSObject().apply {
            put("isRunning", prefs.getBoolean("isRunning", false))
            put("isPaused", prefs.getBoolean("isPaused", false))
            put("accumulatedMs", prefs.getLong("accumulatedMs", 0L))
            put("lastResumedAtMs", prefs.getLong("lastResumedAtMs", 0L))
        }
        call.resolve(res)
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
        } else {
            requestPermissionForAlias("notifications", call, "notificationsCallback")
        }
    }

    @PermissionCallback
    private fun notificationsCallback(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        call.resolve(JSObject().put("granted", granted))
    }
}
