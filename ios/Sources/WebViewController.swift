import UIKit
import WebKit

/// Full-screen web view around the Anikku site. Website players run inside it, so the shell keeps them
/// in check: no pop-ups, no redirects of the app itself, ad domains blocked, and Anikku's player skin
/// injected into the player frames.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let site = URL(string: "https://ad3333m.github.io/anikku/")!
    static let skinURL = URL(string: "https://ad3333m.github.io/anikku/player/skin.js")!
    private let appHosts: Set<String> = ["ad3333m.github.io"]
    private let externalHosts: Set<String> = ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com", "anilist.co"]

    private var webView: WKWebView!
    private let offline = UIView()

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
        buildOfflineView()

        AdBlocker.install(into: config.userContentController) { [weak self] in self?.loadStart() }
        Self.refreshSkin()
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { _ in self.setNeedsStatusBarAppearanceUpdate() })
    }

    private func loadStart() {
        var url = Self.site
        // "-startPath #/watch/97940/1" opens a specific screen (used by the simulator test)
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-startPath"), i + 1 < args.count,
           let deep = URL(string: Self.site.absoluteString + args[i + 1]) {
            url = deep
        }
        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
    }

    // MARK: skin

    /// Latest skin from the site (cached from the previous launch), else the copy inside the app.
    private static func skinSource() -> String {
        if let cached = try? String(contentsOf: cachedSkin, encoding: .utf8), cached.contains("__anikkuSkin") {
            return cached
        }
        if let url = Bundle.main.url(forResource: "skin", withExtension: "js"),
           let bundled = try? String(contentsOf: url, encoding: .utf8) {
            return bundled
        }
        return ""
    }

    private static var cachedSkin: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("skin.js")
    }

    private static func refreshSkin() {
        var req = URLRequest(url: skinURL)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        URLSession.shared.dataTask(with: req) { data, response, _ in
            guard let data, (response as? HTTPURLResponse)?.statusCode == 200,
                  let text = String(data: data, encoding: .utf8), text.contains("__anikkuSkin") else { return }
            try? text.write(to: cachedSkin, atomically: true, encoding: .utf8)
        }.resume()
    }

    // MARK: navigation policy

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        let scheme = url.scheme?.lowercased() ?? ""
        if ["about", "blob", "data", "javascript"].contains(scheme) { return decisionHandler(.allow) }
        guard let frame = action.targetFrame else { return decisionHandler(.cancel) }  // pop-up window
        if !frame.isMainFrame { return decisionHandler(.allow) }                      // player frames
        let host = url.host?.lowercased() ?? ""
        if appHosts.contains(host) { return decisionHandler(.allow) }
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

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        offline.isHidden = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled { return }
        offline.isHidden = false
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
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

    // MARK: offline

    private func buildOfflineView() {
        offline.backgroundColor = .black
        offline.isHidden = true
        offline.frame = view.bounds
        offline.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let title = UILabel()
        title.text = "You're offline"
        title.font = .systemFont(ofSize: 22, weight: .bold)
        title.textColor = .white
        let body = UILabel()
        body.text = "Anikku needs an internet connection."
        body.font = .systemFont(ofSize: 15)
        body.textColor = UIColor(white: 0.65, alpha: 1)
        var button = UIButton.Configuration.filled()
        button.title = "Try again"
        button.baseBackgroundColor = UIColor(red: 1, green: 0.48, blue: 0.1, alpha: 1)
        button.baseForegroundColor = .black
        button.cornerStyle = .capsule
        let retry = UIButton(configuration: button, primaryAction: UIAction { [weak self] _ in
            self?.offline.isHidden = true
            self?.loadStart()
        })
        let stack = UIStackView(arrangedSubviews: [title, body, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.setCustomSpacing(22, after: body)
        stack.translatesAutoresizingMaskIntoConstraints = false
        offline.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: offline.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offline.centerYAnchor),
        ])
        view.addSubview(offline)
    }
}
