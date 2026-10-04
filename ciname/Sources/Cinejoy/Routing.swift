// Where a URL goes, and what happens to a pop-up the page asks for.
//
// This is a straight port of Urls/Popups from the Windows shell
// (cinejoy-desktop/src/Program.cs; the original iOS app is ad3333m/cinejoy-ios) so the two builds make the same calls. It
// deliberately imports nothing but Foundation: the tests run on a plain macOS
// toolchain, with no simulator involved.

import Foundation

public enum Route: Equatable {
    case inApp
    case external
    case block
}

public enum Popup: Equatable {
    case inApp
    case browser
    case drop
}

public enum Routing {
    /// cinejoy.to is the site's other domain; it currently redirects to .pk,
    /// so following it in the app keeps a bookmark or an old link working.
    public static let inAppHosts = ["cinejoy.pk", "cinejoy.to"]

    /// Schemes the web view resolves by itself, with no network of ours.
    public static let passThroughSchemes: Set<String> = ["about", "data", "blob"]

    /// Schemes handed to iOS, which knows which app owns them.
    public static let externalSchemes: Set<String> = [
        "mailto", "tel", "sms", "facetime", "magnet", "ftp",
        "tg", "irc", "ircs", "itms-apps", "itms-appss",
    ]

    public static func decide(_ url: URL) -> Route {
        guard let scheme = url.scheme?.lowercased() else { return .block }

        if scheme == "http" || scheme == "https" {
            guard let host = url.host?.lowercased() else { return .external }
            for allowed in inAppHosts where host == allowed || host.hasSuffix("." + allowed) {
                return .inApp
            }
            return .external
        }

        if passThroughSchemes.contains(scheme) { return .inApp }
        if externalSchemes.contains(scheme) { return .external }
        return .block
    }

    public static func decide(_ string: String) -> Route {
        guard let url = URL(string: string) else { return .block }
        return decide(url)
    }

    /// Whether an origin is one of the site's own, used to decide if a frame is
    /// allowed to hand a URL off to another app.
    public static func isOwnOrigin(_ origin: String?) -> Bool {
        guard let origin = origin, !origin.isEmpty,
              let url = URL(string: origin) else { return false }
        return decide(url) == .inApp
    }

    public static func isOwnOrigin(scheme: String?, host: String?) -> Bool {
        guard let scheme = scheme, let host = host, !host.isEmpty else { return false }
        return isOwnOrigin("\(scheme)://\(host)")
    }
}

public enum Popups {
    /// A free streaming site's players earn their keep through pop-unders, and
    /// they fire on a real tap, so "was the user involved" cannot tell an ad
    /// from a link. Off-site pop-ups are dropped unless the user has turned
    /// blocking off, or has asked for this one explicitly.
    public static func decide(route: Route, blocking: Bool, allowOnce: Bool) -> Popup {
        if route == .inApp { return .inApp }
        if route != .external { return .drop }
        return (blocking && !allowOnce) ? .drop : .browser
    }
}
