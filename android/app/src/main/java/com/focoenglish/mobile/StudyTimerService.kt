package com.focoenglish.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

class StudyTimerService : Service() {

    companion object {
        const val CHANNEL_ID = "focoenglish_study_timer_channel"
        const val NOTIFICATION_ID = 2001
        const val PREFS_NAME = "focoenglish_timer_prefs"

        const val ACTION_START = "com.focoenglish.mobile.ACTION_START"
        const val ACTION_PAUSE = "com.focoenglish.mobile.ACTION_PAUSE"
        const val ACTION_RESUME = "com.focoenglish.mobile.ACTION_RESUME"
        const val ACTION_STOP = "com.focoenglish.mobile.ACTION_STOP"

        const val EXTRA_ACTIVITY = "activity"
        const val EXTRA_SKILL = "skill"
        const val EXTRA_LEVEL = "level"
        const val EXTRA_TOPIC = "topicTitle"
        const val EXTRA_ACCUMULATED_MS = "accumulatedMs"
        const val EXTRA_RESUMED_AT_MS = "resumedAtMs"

        fun formatHMS(totalMs: Long): String {
            val totalSec = (totalMs / 1000L).coerceAtLeast(0L)
            val h = totalSec / 3600L
            val m = (totalSec % 3600L) / 60L
            val s = totalSec % 60L
            return String.format("%02d:%02d:%02d", h, m, s)
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val tickRunnable = object : Runnable {
        override fun run() {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (prefs.getBoolean("isRunning", false)) {
                updateNotification()
                handler.postDelayed(this, 1000L)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val action = intent?.action

        when (action) {
            ACTION_START -> {
                val now = System.currentTimeMillis()
                prefs.edit()
                    .putBoolean("isRunning", true)
                    .putBoolean("isPaused", false)
                    .putLong("accumulatedMs", intent.getLongExtra(EXTRA_ACCUMULATED_MS, 0L))
                    .putLong("lastResumedAtMs", intent.getLongExtra(EXTRA_RESUMED_AT_MS, now))
                    .putString("activity", intent.getStringExtra(EXTRA_ACTIVITY) ?: "Study")
                    .putString("skill", intent.getStringExtra(EXTRA_SKILL) ?: "Speaking")
                    .putString("level", intent.getStringExtra(EXTRA_LEVEL) ?: "A1")
                    .putString("topicTitle", intent.getStringExtra(EXTRA_TOPIC) ?: "English Session")
                    .apply()
                startForeground(NOTIFICATION_ID, buildNotification())
                handler.removeCallbacks(tickRunnable)
                handler.postDelayed(tickRunnable, 1000L)
            }

            ACTION_PAUSE -> {
                val acc = computeElapsedMs()
                prefs.edit()
                    .putBoolean("isRunning", false)
                    .putBoolean("isPaused", true)
                    .putLong("accumulatedMs", acc)
                    .apply()
                handler.removeCallbacks(tickRunnable)
                updateNotification()
            }

            ACTION_RESUME -> {
                val now = System.currentTimeMillis()
                val acc = intent?.getLongExtra(EXTRA_ACCUMULATED_MS, prefs.getLong("accumulatedMs", 0L))
                    ?: prefs.getLong("accumulatedMs", 0L)
                prefs.edit()
                    .putBoolean("isRunning", true)
                    .putBoolean("isPaused", false)
                    .putLong("accumulatedMs", acc)
                    .putLong("lastResumedAtMs", now)
                    .apply()
                startForeground(NOTIFICATION_ID, buildNotification())
                handler.removeCallbacks(tickRunnable)
                handler.postDelayed(tickRunnable, 1000L)
            }

            ACTION_STOP -> {
                prefs.edit()
                    .putBoolean("isRunning", false)
                    .putBoolean("isPaused", false)
                    .putLong("accumulatedMs", 0L)
                    .apply()
                handler.removeCallbacks(tickRunnable)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }

            else -> {
                // Service restarted by Android OS after process kill: restore active timer seamlessly
                if (prefs.getBoolean("isRunning", false)) {
                    startForeground(NOTIFICATION_ID, buildNotification())
                    handler.removeCallbacks(tickRunnable)
                    handler.postDelayed(tickRunnable, 1000L)
                } else if (prefs.getBoolean("isPaused", false)) {
                    startForeground(NOTIFICATION_ID, buildNotification())
                }
            }
        }

        return START_STICKY
    }

    private fun computeElapsedMs(): Long {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val acc = prefs.getLong("accumulatedMs", 0L)
        val isRunning = prefs.getBoolean("isRunning", false)
        if (!isRunning) return acc
        val resumedAt = prefs.getLong("lastResumedAtMs", System.currentTimeMillis())
        return acc + (System.currentTimeMillis() - resumedAt).coerceAtLeast(0L)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.timer_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.timer_channel_desc)
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun updateNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isRunning = prefs.getBoolean("isRunning", false)
        val activity = prefs.getString("activity", "Listening") ?: "Listening"
        val level = prefs.getString("level", "A2") ?: "A2"
        val topic = prefs.getString("topicTitle", "English Study") ?: "English Study"
        val elapsedStr = formatHMS(computeElapsedMs())

        // Tap notification -> return directly to active study session in MainActivity
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("openSection", "timer")
        }
        val openPending = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val pauseOrResumeIntent = Intent(this, TimerActionReceiver::class.java).apply {
            action = if (isRunning) ACTION_PAUSE else ACTION_RESUME
        }
        val pauseOrResumePending = PendingIntent.getBroadcast(
            this,
            1,
            pauseOrResumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, TimerActionReceiver::class.java).apply {
            action = ACTION_STOP
        }
        val stopPending = PendingIntent.getBroadcast(
            this,
            2,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = "\uD83C\uDF93 FOCOENGLISH · $activity $level"
        val text = if (isRunning) "$elapsedStr · $topic" else "Paused $elapsedStr · $topic"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_focoenglish)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openPending)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(
                0,
                if (isRunning) "Pause" else "Resume",
                pauseOrResumePending
            )
            .addAction(0, "Stop", stopPending)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(tickRunnable)
        super.onDestroy()
    }
}
