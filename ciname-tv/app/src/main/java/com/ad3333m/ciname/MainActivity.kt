package com.ad3333m.ciname

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Display
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import java.io.ByteArrayInputStream

/**
 * Ciname for Google TV: opens on a picker, then Anikku or Cinejoy. Each is a full-screen WebView in one
 * Activity, stacked in [root]; an app keeps its place when you go back to the picker. Built for a Sony
 * BRAVIA 8: remote only, read from across a room, and gentle on the TV's GPU.
 */
class MainActivity : AppCompatActivity() {

    lateinit var root: FrameLayout
        private set
    private lateinit var picker: PickerPane
    private val apps = HashMap<String, Pane>()
    private var current: Pane? = null

    val isTv by lazy {
        packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK) ||
            packageManager.hasSystemFeature("android.hardware.type.television")
    }

    /** res/raw/tv_nav.js, injected into every page. */
    val navScript: String by lazy { resources.openRawResource(R.raw.tv_nav).bufferedReader().use { it.readText() } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        setContentView(R.layout.activity_main)
        root = findViewById(R.id.root)
        window.setBackgroundDrawableResource(R.color.page)

        picker = PickerPane(this)
        root.addView(picker.web, fill())
        picker.load()
        picker.web.requestFocus()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = (current ?: picker).back()
        })
        handle(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** `adb shell am start -n com.ad3333m.ciname/.MainActivity --es open anikku --es path '#/watch/97940/1'` */
    private fun handle(intent: Intent?) {
        val app = intent?.getStringExtra("open") ?: return
        open(app, intent.getStringExtra("path"))
    }

    // -- the remote: every key goes to whatever is on screen ------------------------------------------

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_BACK && (current ?: picker).onKey(event)) return true
        return super.dispatchKeyEvent(event)
    }

    // -- picker <-> app ---------------------------------------------------------------------------------

    fun open(app: String, path: String? = null) {
        if (current != null) return
        val pane = apps[app] ?: when (app) {
            "anikku" -> AnikkuPane(this)
            "cinejoy" -> CinejoyPane(this)
            else -> return
        }.also { apps[app] = it }

        if (pane.web.parent == null) root.addView(pane.web, fill())
        when (pane) {
            is AnikkuPane -> pane.load(path)
            is CinejoyPane -> pane.load()
        }
        current = pane
        pane.resume()
        pane.web.visibility = View.VISIBLE
        pane.web.bringToFront()
        pane.web.alpha = 0f
        pane.web.scaleX = 0.96f
        pane.web.scaleY = 0.96f
        pane.web.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(260).withEndAction {
            // the picker's poster walls stop animating behind an app, so the GPU is all the app's
            if (current === pane) { picker.web.visibility = View.INVISIBLE; picker.pause() }
        }.start()
        pane.web.requestFocus()
    }

    fun closePane() {
        val pane = current ?: return
        current = null
        pane.pause()
        keepAwake(false)
        picker.web.visibility = View.VISIBLE
        picker.resume()
        picker.reset()
        pane.web.animate().alpha(0f).translationX(root.width * 0.12f).setDuration(220).withEndAction {
            if (current !== pane) pane.web.visibility = View.GONE
            pane.web.translationX = 0f
        }.start()
        picker.web.requestFocus()
    }

    // -- serving the bundled pages ------------------------------------------------------------------

    fun asset(path: String): String? =
        try { assets.open(path).bufferedReader().use { it.readText() } } catch (e: Exception) { null }

    /** One of the APK's pages as a response for its made-up https origin. */
    fun page(path: String): WebResourceResponse {
        val bytes = try { assets.open(path).use { it.readBytes() } } catch (e: Exception) {
            "<body style='background:#000;color:#fff;font:24px sans-serif;padding:40px'>Missing $path: build the APK with CI (see README).".toByteArray()
        }
        return WebResourceResponse("text/html", "utf-8", 200, "OK", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(bytes))
    }

    // -- the panel ----------------------------------------------------------------------------------

    fun keepAwake(on: Boolean) {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /**
     * Ask the TV for its largest output mode while a film is full screen. A Google TV runs its interface
     * at 1080p even on a 4K panel and the window inherits that; naming the largest Display.Mode moves the
     * output up for playback, and dropping the preference puts the set back afterwards.
     */
    fun preferLargestDisplayMode(on: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val params = window.attributes
        if (!on) {
            params.preferredDisplayModeId = 0
            window.attributes = params
            return
        }
        val display: Display? =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display
            else @Suppress("DEPRECATION") windowManager.defaultDisplay
        val best = display?.supportedModes?.maxWithOrNull(
            compareBy<Display.Mode>({ it.physicalWidth.toLong() * it.physicalHeight }, { it.refreshRate })) ?: return
        params.preferredDisplayModeId = best.modeId
        window.attributes = params
    }

    fun goImmersive(on: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val controller = window.insetsController ?: return
            if (on) controller.hide(android.view.WindowInsets.Type.systemBars())
            else controller.show(android.view.WindowInsets.Type.systemBars())
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = if (on) {
                View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            } else 0
        }
    }

    fun showKeyboard(view: View) {
        view.requestFocus()
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
    }

    fun hand(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            // a Google TV usually has no browser, so say so rather than dying silently
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_LONG).show()
        }
    }

    private fun fill() = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)

    override fun onPause() {
        super.onPause()
        (current ?: picker).pause()
        keepAwake(false)
        preferLargestDisplayMode(false)
    }

    override fun onResume() {
        super.onResume()
        (current ?: picker).resume()
    }

    override fun onDestroy() {
        apps.values.forEach { it.destroy() }
        picker.destroy()
        super.onDestroy()
    }
}
