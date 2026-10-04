import UIKit
import WebKit

/// Full-screen web view showing the Anikku app, which ships inside the bundle (index.html, built from
/// docs/ by ios/bundle_web.py). Website players run in frames, so the shell keeps them in check: no
/// pop-ups, no redirects of the app, frames limited to the player sites, ad domains blocked, and
/// Anikku's player skin injected into the player frames.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    /// The bundled page gets this https origin: storage persists, AniList allows it, players see a referrer.
    static let origin = URL(string: "https://app.anikku.local/")!
    private let appHosts: Set<String> = ["app.anikku.local"]
    private let playerHosts = ["megaplay.buzz", "megaplay-1.buzz"]
    private let externalHosts: Set<String> = ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com", "anilist.co"]

    private var webView: WKWebView!

    /// Set by Ciname before the view loads: the page's back button on Home leaves Anikku through this.
    var onExit: (() -> Void)?
    var canGoBack: Bool { webView?.canGoBack ?? false }

    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var prefersStatusBarHidden: Bool { view.bounds.width > view.bounds.height }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .pad ? .all : .allButUpsideDown
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = true
        config.allowsAirPlayForMediaPlayback = true
        if #available(iOS 15.4, *) { config.preferences.isElementFullscreenEnabled = true }
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.applicationNameForUserAgent = "AnikkuApp/1.0 Mobile/15E148 Safari/604.1"

        let scripts = WKUserContentController()
        scripts.addUserScript(WKUserScript(source: "try{window.open=function(){return null}}catch(e){}",
                                           injectionTime: .atDocumentStart, forMainFrameOnly: false))
        scripts.addUserScript(WKUserScript(source: Self.skinSource(), injectionTime: .atDocumentStart, forMainFrameOnly: false))
        if onExit != nil {
            scripts.add(ExitHandler { [weak self] in self?.onExit?() }, name: "ciname")
        }
        config.userContentController = scripts

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view.addSubview(webView)

        AdBlocker.install(into: config.userContentController) { [weak self] in self?.loadStart() }
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { _ in self.setNeedsStatusBarAppearanceUpdate() })
    }

    func pauseMedia() {
        webView?.pauseAllMediaPlayback(completionHandler: nil)
    }

    private static let page: String = {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html"),
              let html = try? String(contentsOf: url, encoding: .utf8) else { return "<h1>Anikku is missing its page</h1>" }
        return html
    }()

    private func loadStart(fragment: String? = nil) {
        var hash = fragment ?? ""
        // "-startPath #/watch/97940/1" opens a specific screen (used by the simulator test)
        let args = ProcessInfo.processInfo.arguments
        if fragment == nil, let i = args.firstIndex(of: "-startPath"), i + 1 < args.count { hash = args[i + 1] }
        let base = URL(string: Self.origin.absoluteString + hash) ?? Self.origin
        webView.loadHTMLString(Self.page, baseURL: base)
    }

    // MARK: skin

    private static func skinSource() -> String {
        guard let url = Bundle.main.url(forResource: "skin", withExtension: "js"),
              let skin = try? String(contentsOf: url, encoding: .utf8) else { return "" }
        return skin
    }

    private func isPlayer(_ host: String) -> Bool {
        playerHosts.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    // MARK: navigation policy

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let scheme = url.scheme?.lowercased() ?? ""
        if ["about", "blob", "data", "javascript"].contains(scheme) { return decisionHandler(.allow) }
        guard let frame = action.targetFrame else { return decisionHandler(.cancel) }  // pop-up window
        let host = url.host?.lowercased() ?? ""
        // frames may only be the video players: ad frames inside them never load
        if !frame.isMainFrame { return decisionHandler(isPlayer(host) ? .allow : .cancel) }
        if appHosts.contains(host) {
            // the page has no server behind it: a reload means "show the bundled page again"
            if action.navigationType == .reload {
                loadStart(fragment: url.fragment.map { "#" + $0 } ?? "")
                return decisionHandler(.cancel)
            }
            return decisionHandler(.allow)
        }
        // a tapped trailer or AniList link opens outside; anything else is an ad trying to take over
        if action.navigationType == .linkActivated, externalHosts.contains(host) {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadStart(fragment: webView.url?.fragment.map { "#" + $0 } ?? "")
    }

    // MARK: JavaScript dialogs (the site uses confirm() before clearing data)

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard frame.isMainFrame else { return completionHandler() }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard frame.isMainFrame else { return completionHandler(false) }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}

/// The page calls window.webkit.messageHandlers.ciname.postMessage(...) to leave Anikku inside Ciname.
private final class ExitHandler: NSObject, WKScriptMessageHandler {
    private let action: () -> Void
    init(_ action: @escaping () -> Void) { self.action = action }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) { action() }
}
