package com.focoenglish.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var textToSpeech: TextToSpeech? = null
    private var ttsReady: Boolean = false

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback ?: return@registerForActivityResult
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        callback.onReceiveValue(uris)
        filePathCallback = null
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    private val audioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        textToSpeech = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.language = Locale.US
                ttsReady = true
            }
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler(
                "/",
                WebViewAssetLoader.AssetsPathHandler(this)
            )
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.addJavascriptInterface(FocoAndroidBridge(), "FocoAndroidBridge")

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                // Rewrite root-relative paths to assets/public/
                val rewrittenUri = if (url.host == "appassets.androidplatform.net") {
                    val path = url.path ?: "/"
                    val assetPath = if (path == "/" || !path.startsWith("/public")) {
                        val clean = if (path == "/") "/index.html" else path
                        "/public$clean"
                    } else {
                        path
                    }
                    url.buildUpon().path(assetPath).build()
                } else {
                    url
                }
                return assetLoader.shouldInterceptRequest(rewrittenUri)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = fileChooserParams?.createIntent() ?: return false
                fileChooserLauncher.launch(intent)
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.let { req ->
                    if (req.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        if (ContextCompat.checkSelfPermission(
                                this@MainActivity,
                                Manifest.permission.RECORD_AUDIO
                            ) == PackageManager.PERMISSION_GRANTED
                        ) {
                            req.grant(req.resources)
                        } else {
                            audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            req.deny()
                        }
                    } else {
                        req.grant(req.resources)
                    }
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView.loadUrl("https://appassets.androidplatform.net/public/index.html")
        handleNotificationIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    private fun handleNotificationIntent(intent: Intent?) {
        if (intent?.getStringExtra("openSection") == "timer") {
            webView.post {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('foco-open-timer'));",
                    null
                )
            }
        }
    }

    inner class FocoAndroidBridge {

        @JavascriptInterface
        fun startSession(
            activity: String,
            skill: String,
            level: String,
            topicTitle: String,
            startedAtMs: Long,
            accumulatedMs: Long
        ) {
            val svcIntent = Intent(this@MainActivity, StudyTimerService::class.java).apply {
                action = StudyTimerService.ACTION_START
                putExtra(StudyTimerService.EXTRA_ACTIVITY, activity)
                putExtra(StudyTimerService.EXTRA_SKILL, skill)
                putExtra(StudyTimerService.EXTRA_LEVEL, level)
                putExtra(StudyTimerService.EXTRA_TOPIC, topicTitle)
                putExtra(StudyTimerService.EXTRA_RESUMED_AT_MS, startedAtMs)
                putExtra(StudyTimerService.EXTRA_ACCUMULATED_MS, accumulatedMs)
            }
            ContextCompat.startForegroundService(this@MainActivity, svcIntent)
        }

        @JavascriptInterface
        fun pauseSession() {
            val svcIntent = Intent(this@MainActivity, StudyTimerService::class.java).apply {
                action = StudyTimerService.ACTION_PAUSE
            }
            startService(svcIntent)
        }

        @JavascriptInterface
        fun resumeSession(accumulatedMs: Long) {
            val svcIntent = Intent(this@MainActivity, StudyTimerService::class.java).apply {
                action = StudyTimerService.ACTION_RESUME
                putExtra(StudyTimerService.EXTRA_ACCUMULATED_MS, accumulatedMs)
            }
            ContextCompat.startForegroundService(this@MainActivity, svcIntent)
        }

        @JavascriptInterface
        fun stopSession() {
            val svcIntent = Intent(this@MainActivity, StudyTimerService::class.java).apply {
                action = StudyTimerService.ACTION_STOP
            }
            startService(svcIntent)
        }

        @JavascriptInterface
        fun getActiveSessionJson(): String {
            val prefs = getSharedPreferences(StudyTimerService.PREFS_NAME, Context.MODE_PRIVATE)
            return JSONObject().apply {
                put("isRunning", prefs.getBoolean("isRunning", false))
                put("isPaused", prefs.getBoolean("isPaused", false))
                put("accumulatedMs", prefs.getLong("accumulatedMs", 0L))
                put("lastResumedAtMs", prefs.getLong("lastResumedAtMs", 0L))
            }.toString()
        }

        @JavascriptInterface
        fun requestNotificationPermission(): Boolean {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
            val granted = ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            return granted
        }

        @JavascriptInterface
        fun speakText(text: String, rate: Float) {
            if (!ttsReady) return
            textToSpeech?.setSpeechRate(rate.coerceIn(0.6f, 1.4f))
            textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "foco_tts_${System.currentTimeMillis()}")
        }

        @JavascriptInterface
        fun stopSpeaking() {
            textToSpeech?.stop()
        }
    }

    override fun onDestroy() {
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        super.onDestroy()
    }
}
