package com.ad3333m.ciname

/**
 * The two builds of this app: `tv` (Google TV, remote only, landscape, 10-foot pages) and `phone`
 * (touch, any orientation, the pages' phone layouts). Everything that differs is decided here.
 */
object Device {
    val tv: Boolean = BuildConfig.TV

    /** The name the pages see the app under (window.CinameTV / window.CinameAndroid). */
    val bridge: String = if (tv) "CinameTV" else "CinameAndroid"

    /** Added to the user agent; "CinameTV" switches the pages to their TV layout. */
    val agent: String = if (tv) " CinameTV/1.0" else " CinameAndroid/1.0"
}
