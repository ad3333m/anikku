package com.ad3333m.ciname

import android.net.Uri

/**
 * Where a URL goes, and what happens to a pop-up the page asks for.
 *
 * A port of the same rules the Windows shell keeps in Program.cs and the iOS
 * shell in Routing.swift, asserted by the same cases in RoutingTest so the
 * three builds cannot quietly drift apart.
 *
 * Uri is parsed rather than URL so this stays testable on the JVM without an
 * emulator - Robolectric is not needed because android.net.Uri parsing is
 * reimplemented here for the host/scheme split we actually rely on.
 */
enum class Route { IN_APP, EXTERNAL, BLOCK }

enum class Popup { IN_APP, BROWSER, DROP }

object Routing {

    /** cinejoy.to is the site's other domain; it currently redirects to .pk. */
    val inAppHosts = listOf("cinejoy.pk", "cinejoy.to")

    /** Schemes the web view resolves by itself, with no network of ours. */
    val passThroughSchemes = setOf("about", "data", "blob")

    /** Schemes handed to whatever app on the TV claims them. */
    val externalSchemes = setOf(
        "mailto", "tel", "sms", "magnet", "ftp", "tg", "irc", "ircs", "market",
    )

    fun decide(url: String?): Route {
        if (url.isNullOrBlank()) return Route.BLOCK

        val scheme = schemeOf(url)?.lowercase() ?: return Route.BLOCK

        if (scheme == "http" || scheme == "https") {
            val host = hostOf(url)?.lowercase() ?: return Route.EXTERNAL
            for (allowed in inAppHosts) {
                if (host == allowed || host.endsWith(".$allowed")) return Route.IN_APP
            }
            return Route.EXTERNAL
        }

        if (scheme in passThroughSchemes) return Route.IN_APP
        if (scheme in externalSchemes) return Route.EXTERNAL
        return Route.BLOCK
    }

    fun isOwnOrigin(origin: String?): Boolean =
        !origin.isNullOrBlank() && decide(origin) == Route.IN_APP

    // -- parsing -------------------------------------------------------------
    // Deliberately hand-rolled: android.net.Uri is a stub on the JVM, and the
    // unit tests are worth more than the few lines this saves.

    private fun schemeOf(url: String): String? {
        val colon = url.indexOf(':')
        if (colon <= 0) return null
        val scheme = url.substring(0, colon)
        if (!scheme.all { it.isLetterOrDigit() || it == '+' || it == '-' || it == '.' }) return null
        if (!scheme.first().isLetter()) return null
        return scheme
    }

    private fun hostOf(url: String): String? {
        val mark = url.indexOf("://")
        if (mark < 0) return null

        var rest = url.substring(mark + 3)
        // Strip anything that cannot be part of the authority.
        rest = rest.substringBefore('/').substringBefore('?').substringBefore('#')
        // userinfo@host:port
        rest = rest.substringAfterLast('@')
        if (rest.startsWith("[")) return rest.substringAfter('[').substringBefore(']')
        rest = rest.substringBefore(':')
        return rest.ifBlank { null }
    }
}

object Popups {
    /**
     * A free streaming site's players earn their keep through pop-unders, and
     * they fire on a real click, so "was the user involved" cannot tell an ad
     * from a link. Off-site pop-ups are dropped unless blocking is off.
     *
     * This matters more on a TV than anywhere else: there is usually no browser
     * to fall back to, so an unwanted pop-up is a dead end with no way back.
     */
    fun decide(route: Route, blocking: Boolean, allowOnce: Boolean): Popup = when {
        route == Route.IN_APP -> Popup.IN_APP
        route != Route.EXTERNAL -> Popup.DROP
        blocking && !allowOnce -> Popup.DROP
        else -> Popup.BROWSER
    }
}

/** Kept out of Routing so the parsing above stays free of Android types. */
fun Uri.route(): Route = Routing.decide(this.toString())
