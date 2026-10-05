package com.ad3333m.ciname

import android.os.Message
import android.view.KeyEvent
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Cinejoy: cinejoy.pk, as in Cinejoy for Google TV (ad3333m/cinejoy-android). Routing.kt decides where
 * links go, pop-ups are dropped, and while a film is full screen the remote drives its transport bar.
 * Added here: the shared ad blocker, and player frames load in place instead of being sent elsewhere.
 */
class CinejoyPane(activity: MainActivity) : Pane(activity, "#95FF50") {

    private companion object {
        const val HOME = "https://cinejoy.pk/"
        /** A 1080p TV viewed from a sofa wants this site a size up. */
        const val TV_SCALE = 125
        const val SEEK_SECONDS = 10
    }

    /** Mirrors the page's own state, so Back can act without waiting on JS. */
    private var barHidden = false
    private var loaded = false

    init {
        web.settings.javaScriptCanOpenWindowsAutomatically = true
        web.settings.setSupportMultipleWindows(true)
        if (Device.tv) web.setInitialScale(TV_SCALE)

        // On a phone, Cinejoy's Home gets the same back arrow to the picker as on iPhone
        // (ciname/Injected/back-button.js, next to the site's logo).
        if (!Device.tv && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            activity.asset("cinejoy/back-button.js")?.let {
                WebViewCompat.addDocumentStartJavaScript(web, it, setOf("https://cinejoy.pk", "https://cinejoy.to"))
            }
            web.addJavascriptInterface(ExitBridge(), Device.bridge)
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (AdBlock.blocks(request.url.host)) AdBlock.empty() else null

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url?.toString()
                return when (Routing.decide(url)) {
                    Route.IN_APP -> false
                    // the players are frames from other sites: they load in place
                    Route.EXTERNAL -> {
                        if (!request.isForMainFrame) return false
                        if (request.hasGesture()) activity.hand(request.url!!)
                        true
                    }
                    Route.BLOCK -> true
                }
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) { navReady = false }
            override fun onPageFinished(view: WebView, url: String?) = injectNavigator()
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) = showCustomView(view, callback)
            override fun onHideCustomView() = hideCustomView()
            override fun onPermissionRequest(request: PermissionRequest) = request.deny()

            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                // The URL is not known until the window navigates, so the policy is applied to the
                // first navigation the pop-up attempts.
                val popup = WebView(activity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                        val url = req.url?.toString()
                        when (Popups.decide(Routing.decide(url), true, false)) {
                            Popup.IN_APP -> web.loadUrl(url!!)
                            Popup.BROWSER -> activity.hand(req.url!!)
                            Popup.DROP -> Toast.makeText(activity, R.string.popup_blocked, Toast.LENGTH_SHORT).show()
                        }
                        v.destroy()
                        return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }
        }
    }

    fun load() {
        if (loaded) return
        loaded = true
        web.loadUrl(HOME)
    }

    override fun atStart(where: String) = where.substringBefore('#') == "/"
    override fun leaveFromStart() = activity.closePane()

    override fun onFullscreen(on: Boolean) {
        barHidden = false
        js(if (on) "TvNav.enterPlayer()" else "TvNav.leavePlayer()")
    }

    override fun back() {
        // Back is how the transport bar comes back, so it is checked before leaving full screen
        if (customView != null && barHidden) { showBar(); return }
        super.back()
    }

    override fun onKey(event: KeyEvent): Boolean {
        if (!Device.tv || customView == null) return super.onKey(event)
        if (Pane.keyName(event.keyCode) == null) return false
        if (event.action == KeyEvent.ACTION_DOWN) playerKey(event.keyCode)
        return true
    }

    /**
     * While a film is full screen the remote drives the player, not the page behind it.
     *  - bar showing: the D-pad walks the player's own controls and OK presses the one under the ring;
     *  - bar hidden: left and right seek, up or down brings the bar back, and OK is play/pause.
     */
    private fun playerKey(code: Int) {
        when (code) {
            KeyEvent.KEYCODE_DPAD_LEFT -> if (barHidden) js("TvNav.seek(-$SEEK_SECONDS)") else js("TvNav.move('left')")
            KeyEvent.KEYCODE_DPAD_RIGHT -> if (barHidden) js("TvNav.seek($SEEK_SECONDS)") else js("TvNav.move('right')")
            KeyEvent.KEYCODE_DPAD_UP -> if (barHidden) showBar() else js("TvNav.move('up')")
            KeyEvent.KEYCODE_DPAD_DOWN -> if (barHidden) showBar() else js("TvNav.move('down')")
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER, KeyEvent.KEYCODE_BUTTON_A ->
                web.evaluateJavascript("TvNav.okInPlayer()") { result ->
                    if (result?.contains("bar") == true) barHidden = !barHidden
                }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE,
            KeyEvent.KEYCODE_SPACE -> js("TvNav.playPause()")
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> js("TvNav.seek($SEEK_SECONDS)")
            KeyEvent.KEYCODE_MEDIA_REWIND -> js("TvNav.seek(-$SEEK_SECONDS)")
        }
    }

    private inner class ExitBridge {
        @JavascriptInterface
        fun exit() {
            activity.runOnUiThread { activity.closePane() }
        }
    }

    private fun showBar() {
        barHidden = false
        js("TvBar.show()")
    }
}
