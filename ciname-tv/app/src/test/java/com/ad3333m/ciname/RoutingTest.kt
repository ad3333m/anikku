package com.ad3333m.ciname

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The same cases the Windows and iOS builds assert, so the three shells cannot
 * quietly drift apart. Plain JVM tests: no emulator, no Robolectric.
 */
class RoutingTest {

    @Test
    fun `stays in the app`() {
        listOf(
            "https://cinejoy.pk/",
            "https://cinejoy.pk/movie/tt0111161",
            "https://cinejoy.pk/tv/1396/season/1/episode/3",
            "https://cinejoy.pk/search?q=dune",
            "http://cinejoy.pk/",
            "https://www.cinejoy.pk/",
            "https://api.cinejoy.pk/v1/list",
            "https://cinejoy.to/",
            "about:blank",
            "data:text/html,hello",
        ).forEach { assertEquals(it, Route.IN_APP, Routing.decide(it)) }
    }

    @Test
    fun `host matching ignores case`() {
        assertEquals(Route.IN_APP, Routing.decide("HTTPS://CINEJOY.PK/Browse"))
    }

    @Test
    fun `handed to the system`() {
        listOf(
            "https://www.themoviedb.org/movie/278",
            "https://image.tmdb.org/t/p/w500/poster.jpg",
            "https://discord.gg/example",
            "mailto:someone@example.com",
            "magnet:?xt=urn:btih:0123456789abcdef",
        ).forEach { assertEquals(it, Route.EXTERNAL, Routing.decide(it)) }
    }

    @Test
    fun `lookalike hosts are not ours`() {
        listOf(
            "https://notcinejoy.pk/",
            "https://cinejoy.pk.evil.example/",
            "https://evil.example/?next=cinejoy.pk",
            "https://cinejoy.pk.co/",
            "https://cinejoy.pk@evil.example/",
        ).forEach { assertEquals(it, Route.EXTERNAL, Routing.decide(it)) }
    }

    @Test
    fun `refused outright`() {
        listOf(
            "file:///sdcard/x",
            "javascript:alert(1)",
            "vbscript:msgbox(1)",
            "intent://open#Intent;scheme=http;end",
            "content://media/external/file/1",
        ).forEach { assertEquals(it, Route.BLOCK, Routing.decide(it)) }
    }

    @Test
    fun `empty input is refused`() {
        assertEquals(Route.BLOCK, Routing.decide(null))
        assertEquals(Route.BLOCK, Routing.decide(""))
        assertEquals(Route.BLOCK, Routing.decide("   "))
        assertEquals(Route.BLOCK, Routing.decide("not a url"))
    }

    @Test
    fun `own origin`() {
        assertTrue(Routing.isOwnOrigin("https://cinejoy.pk"))
        assertTrue(Routing.isOwnOrigin("https://player.cinejoy.pk"))
        assertFalse(Routing.isOwnOrigin("https://ads.example"))
        assertFalse(Routing.isOwnOrigin(""))
        assertFalse(Routing.isOwnOrigin(null))
    }

    @Test
    fun `popup policy`() {
        assertEquals(Popup.IN_APP, Popups.decide(Route.IN_APP, blocking = true, allowOnce = false))
        assertEquals(Popup.IN_APP, Popups.decide(Route.IN_APP, blocking = false, allowOnce = false))
        assertEquals(Popup.DROP, Popups.decide(Route.EXTERNAL, blocking = true, allowOnce = false))
        assertEquals(Popup.BROWSER, Popups.decide(Route.EXTERNAL, blocking = true, allowOnce = true))
        assertEquals(Popup.BROWSER, Popups.decide(Route.EXTERNAL, blocking = false, allowOnce = false))
        assertEquals(Popup.DROP, Popups.decide(Route.BLOCK, blocking = true, allowOnce = false))
        assertEquals(Popup.DROP, Popups.decide(Route.BLOCK, blocking = true, allowOnce = true))
        assertEquals(Popup.DROP, Popups.decide(Route.BLOCK, blocking = false, allowOnce = false))
    }
}
