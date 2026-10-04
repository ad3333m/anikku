package com.ad3333m.ciname

import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * Ad, pop-under and tracker domains the website players pull in, answered with an empty response
 * before they reach the network. The same list as the iOS apps' content blocker (ios/Sources/AdBlocker.swift).
 */
object AdBlock {
    private val domains = listOf(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "google-analytics.com", "googletagmanager.com",
        "adservice.google.com", "adnxs.com", "adsterra.com", "adsterratech.com", "highperformanceformat.com", "profitablecpmrate.com",
        "profitablegatecpm.com", "propellerads.com", "propellerclick.com", "onclickads.net", "onclckmn.com", "popads.net", "popcash.net",
        "exoclick.com", "exosrv.com", "juicyads.com", "trafficjunky.net", "hilltopads.net", "hilltopads.com", "a-ads.com",
        "monetag.com", "mc.yandex.ru", "an.yandex.ru", "statlytic.net", "clickadu.com", "clickaine.com",
        "galaksion.com", "adcash.com", "admaven.com", "ad-maven.com", "realsrv.com", "rtmark.net", "tsyndicate.com",
        "bidgear.com", "pubfuture.com", "vdo.ai", "aclib.net", "acscdn.com", "dtscout.com", "dtscdn.com",
        "histats.com", "whos.amung.us", "disqusads.com", "s.pubmine.com", "adskeeper.com", "mgid.com", "lijit.com",
        // MegaPlay's Monetag "iclick" pop-unders and its trackers
        "nekostream.site", "llvpn.com", "luugy.com", "plausible.io", "jwpltx.com",
    )

    fun blocks(host: String?): Boolean {
        val h = host?.lowercase() ?: return false
        return domains.any { h == it || h.endsWith(".$it") }
    }

    fun empty(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", 204, "No Content", emptyMap(), ByteArrayInputStream(ByteArray(0)))
}
