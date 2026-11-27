-keep class com.focoenglish.mobile.** { *; }
-keepclassmembers class com.focoenglish.mobile.MainActivity$FocoAndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}
