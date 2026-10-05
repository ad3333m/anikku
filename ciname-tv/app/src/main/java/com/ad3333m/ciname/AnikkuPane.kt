package com.ad3333m.ciname

import android.os.Message
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Anikku: the site in docs/, bundled into one page (ios/bundle_web.py) and served from the APK at a
 * made-up https origin. MegaPlay plays in a frame; Anikku's player skin is put into that frame before
 * its scripts run, so the episode gets Anikku's controls, no ads, and the remote (see skin.js).
 */
class AnikkuPane(activity: MainActivity) : Pane(activity, "#FF7A1A") {

    private companion object {
        const val HOST = "app.anikku.local"
        val PLAYER_ORIGINS = setOf("https://megaplay.buzz", "https://megaplay-1.buzz")
        /** Off-site links a tap may open in another app on the TV (trailers in YouTube). */
        val HAND_OFF = setOf("www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be")
    }

    init {
        web.settings.javaScriptCanOpenWindowsAutomatically = false
        web.settings.setSupportMultipleWindows(true)   // so a pop-up asks first, and is refused
        web.addJavascriptInterface(Bridge(), Device.bridge)

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, "try{window.open=function(){return null}}catch(e){}", setOf("*"))
            activity.asset("anikku/skin.js")?.let { WebViewCompat.addDocumentStartJavaScript(web, it, PLAYER_ORIGINS) }
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val host = request.url.host
                if (host == HOST) return activity.page("anikku/index.html")
                if (AdBlock.blocks(host)) return AdBlock.empty()
                return null
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val host = request.url.host
                if (host == HOST) return false
                // the app itself never leaves its page; a trailer goes to the YouTube app, anything else is an ad
                if (request.hasGesture() && host in HAND_OFF) activity.hand(request.url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) { navReady = false }
            override fun onPageFinished(view: WebView, url: String?) = injectNavigator()
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) = showCustomView(view, callback)
            override fun onHideCustomView() = hideCustomView()
            override fun onPermissionRequest(request: PermissionRequest) = request.deny()
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message) = false
        }
    }

    private var loaded = false

    /** `path` is an Anikku route such as "#/watch/97940/1"; null keeps the current screen. */
    fun load(path: String?) {
        if (loaded && path == null) return
        loaded = true
        web.loadUrl("https://$HOST/" + (path ?: "#/"))
    }

    override fun atStart(where: String): Boolean = where.substringAfter('#', "").trimEnd('/').isEmpty()
    override fun leaveFromStart() = activity.closePane()

    override fun pause() {
        js("try{document.querySelectorAll('iframe').forEach(function(f){f.contentWindow.postMessage({anikkuCmd:'key',key:'pause'},'*')})}catch(e){}")
        super.pause()
    }

    private inner class Bridge {
        /** The watch screen is open: keep the TV awake. */
        @JavascriptInterface
        fun watching(on: Boolean) {
            activity.runOnUiThread { activity.keepAwake(on) }
        }

        @JavascriptInterface
        fun exit() {
            activity.runOnUiThread { activity.closePane() }
        }
    }
}
