package com.ad3333m.ciname

import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

/** The "What are we watching?" screen: Anikku or Cinejoy (ciname/Launcher/launcher.html). */
class PickerPane(activity: MainActivity) : Pane(activity, "#FF9A2E") {

    private companion object {
        /** A made-up https origin, served from the APK's assets, so the poster walls can fetch. */
        const val HOST = "ciname.local"
    }

    init {
        web.addJavascriptInterface(Bridge(), Device.bridge)
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (request.url.host == HOST) activity.page("picker/launcher.html") else null

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = request.url.host != HOST

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) { navReady = false }
            override fun onPageFinished(view: WebView, url: String?) = injectNavigator()
        }
    }

    fun load() = web.loadUrl("https://$HOST/")

    /** Shown again after an app: undo the card's opening animation. */
    fun reset() = js("window.cinameReset && cinameReset()")

    override fun atStart(where: String) = true
    override fun leaveFromStart() = activity.finish()

    private inner class Bridge {
        @JavascriptInterface
        fun open(app: String) {
            activity.runOnUiThread { activity.open(app) }
        }
    }
}
