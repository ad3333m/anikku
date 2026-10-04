import WebKit

/// Blocks ad, pop-under and tracker domains that website players pull in, using WebKit's
/// content-blocker engine (the same one Safari content blockers use).
enum AdBlocker {
    private static let domains = [
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "google-analytics.com", "googletagmanager.com",
        "adservice.google.com", "adnxs.com", "adsterra.com", "adsterratech.com", "highperformanceformat.com", "profitablecpmrate.com",
        "profitablegatecpm.com", "propellerads.com", "propellerclick.com", "onclickads.net", "onclckmn.com", "popads.net", "popcash.net",
        "exoclick.com", "exosrv.com", "juicyads.com", "trafficjunky.net", "hilltopads.net", "hilltopads.com", "a-ads.com",
        "monetag.com", "mc.yandex.ru", "an.yandex.ru", "yandex.ru/ads", "statlytic.net", "clickadu.com", "clickaine.com",
        "galaksion.com", "adcash.com", "admaven.com", "ad-maven.com", "realsrv.com", "rtmark.net", "tsyndicate.com",
        "bidgear.com", "pubfuture.com", "vdo.ai", "aclib.net", "acscdn.com", "stopadsnow", "dtscout.com", "dtscdn.com",
        "histats.com", "whos.amung.us", "disqusads.com", "s.pubmine.com", "adskeeper.com", "mgid.com", "lijit.com",
        // MegaPlay's Monetag "iclick" pop-unders and its trackers
        "nekostream.site", "llvpn.com", "luugy.com", "plausible.io", "jwpltx.com",
    ]

    static func install(into controller: WKUserContentController, then done: @escaping () -> Void) {
        let rules = domains.map { domain -> [String: Any] in
            let escaped = NSRegularExpression.escapedPattern(for: domain)
            return [
                "trigger": ["url-filter": "^https?://([^/]*\\.)?\(escaped)", "load-type": ["third-party"]],
                "action": ["type": "block"],
            ]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: rules),
              let json = String(data: data, encoding: .utf8) else { return done() }
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "anikku-adblock-v2", encodedContentRuleList: json) { list, _ in
            DispatchQueue.main.async {
                if let list { controller.add(list) }
                done()
            }
        }
    }
}
