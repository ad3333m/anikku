package com.ad3333m.ciname

import android.annotation.SuppressLint
import android.graphics.Color
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout

/**
 * One full-screen WebView: the picker, Anikku or Cinejoy. The Activity hands every remote key to the
 * pane on screen, and the pane hands it to res/raw/tv_nav.js (TvNav), which moves a focus ring by
 * geometry rather than DOM order. Back goes back a page, and on an app's Home it returns to the picker.
 */
@SuppressLint("SetJavaScriptEnabled")
abstract class Pane(protected val activity: MainActivity, private val accent: String) {

    val web: WebView = WebView(activity)
    @Volatile protected var navReady = false

    /** The view a player hands over when it goes full screen. */
    protected var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    init {
        web.setBackgroundColor(Color.parseColor("#060608"))
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // the players are third-party frames and not all of them are https
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            // the pages switch to their TV layout when they see this
            userAgentString = "$userAgentString CinameTV/1.0"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
    }

    /** Where the app's Home is: Back from there leaves for the picker. `where` is path + hash. */
    protected abstract fun atStart(where: String): Boolean
    protected abstract fun leaveFromStart()

    open fun pause() = web.onPause()
    open fun resume() = web.onResume()

    fun js(expression: String) {
        if (navReady) web.evaluateJavascript(expression, null)
    }

    protected fun injectNavigator() {
        web.evaluateJavascript("window.TvNavConfig={accent:'$accent'};\n" + activity.navScript) {
            navReady = true
        }
    }

    // -- the remote -------------------------------------------------------------------------------

    /** Every key the remote sends while this pane is on screen. True when it was used here. */
    open fun onKey(event: KeyEvent): Boolean {
        val name = keyName(event.keyCode) ?: return false
        // the matching key-ups are swallowed too, or the WebView sees half a press and moves on its own
        if (event.action == KeyEvent.ACTION_DOWN) send(name)
        return true
    }

    protected fun send(name: String) {
        if (!navReady) return
        web.evaluateJavascript("TvNav.key('$name')") { raw ->
            val result = raw?.trim('"') ?: ""
            when {
                // nothing further that way: page the view instead, so a long screen still ends
                result == "edge" && (name == "up" || name == "down") -> js("TvNav.scroll('$name')")
                // OK on a text field: bring up the TV's keyboard
                result == "input" -> activity.showKeyboard(web)
            }
        }
    }

    open fun back() {
        if (customView != null) { hideCustomView(); return }
        if (!navReady) {
            if (web.canGoBack()) web.goBack() else leaveFromStart()
            return
        }
        val probe = "(function(){var r=window.TvNav?TvNav.key('back'):'none';return r+'|'+location.pathname+location.hash})()"
        web.evaluateJavascript(probe) { raw ->
            val result = raw?.trim('"') ?: ""
            if (result.substringBefore('|') == "handled") return@evaluateJavascript   // e.g. a player menu closed
            val where = result.substringAfter('|', "")
            if (atStart(where) || !web.canGoBack()) leaveFromStart() else web.goBack()
        }
    }

    // -- full screen (a player's own full-screen button) --------------------------------------------

    protected fun showCustomView(view: View, callback: WebChromeClient.CustomViewCallback) {
        if (customView != null) { callback.onCustomViewHidden(); return }
        customView = view
        customViewCallback = callback
        view.setBackgroundColor(Color.BLACK)
        activity.root.addView(view, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web.visibility = View.INVISIBLE
        activity.keepAwake(true)
        activity.goImmersive(true)
        activity.preferLargestDisplayMode(true)
        onFullscreen(true)
    }

    protected fun hideCustomView() {
        val view = customView ?: return
        activity.root.removeView(view)
        customView = null
        web.visibility = View.VISIBLE
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        activity.keepAwake(false)
        activity.goImmersive(false)
        activity.preferLargestDisplayMode(false)
        onFullscreen(false)
    }

    protected open fun onFullscreen(on: Boolean) {}

    open fun destroy() {
        hideCustomView()
        web.destroy()
    }

    companion object {
        fun keyName(code: Int): String? = when (code) {
            KeyEvent.KEYCODE_DPAD_UP -> "up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "down"
            KeyEvent.KEYCODE_DPAD_LEFT -> "left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER,
            KeyEvent.KEYCODE_BUTTON_A -> "ok"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE,
            KeyEvent.KEYCODE_SPACE -> "playpause"
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "ff"
            KeyEvent.KEYCODE_MEDIA_REWIND -> "rw"
            KeyEvent.KEYCODE_MEDIA_NEXT -> "next"
            KeyEvent.KEYCODE_MENU -> "menu"
            KeyEvent.KEYCODE_CAPTIONS -> "captions"
            else -> null
        }
    }
}
