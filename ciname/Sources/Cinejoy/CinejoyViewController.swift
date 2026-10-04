import UIKit
import WebKit

/// Cinejoy inside Ciname: the browser shell from ad3333m/cinejoy-ios around cinejoy.pk. Routing.swift decides
/// where links go and what happens to pop-ups, the same calls the Windows build makes. Added here: Anikku's
/// ad-domain blocker, and a way back out to the Ciname picker.
final class CinejoyViewController: UIViewController {

    private enum Const {
        static let home = URL(string: "https://cinejoy.pk/")!
        static let mediaHandler = "media"
        static let exitHandler = "ciname"
    }

    /// Set by Ciname: leaves Cinejoy for the picker.
    var onExit: (() -> Void)?
    var canGoBack: Bool { webView?.canGoBack ?? false }

    private var webView: WKWebView!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let toast = ToastView()
    private let fault = FaultView()
    private let refresh = UIRefreshControl()

    private var progressObservation: NSKeyValueObservation?
    private var playing = 0
    private var lastGoodURL = Const.home

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Palette.page

        buildWebView()
        buildChrome()

        // ad and pop-under domains are blocked before the first page asks for them
        AdBlocker.install(into: webView.configuration.userContentController) { [weak self] in
            guard let self = self else { return }
            self.load(self.startURL())
        }
    }

    deinit {
        webView?.configuration.userContentController
            .removeScriptMessageHandler(forName: Const.mediaHandler)
        webView?.configuration.userContentController
            .removeScriptMessageHandler(forName: Const.exitHandler)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    /// Hide the home indicator once something is playing, so it does not sit
    /// over the picture.
    override var prefersHomeIndicatorAutoHidden: Bool { playing > 0 }

    private func startURL() -> URL {
        guard CinejoySettings.restoreLastPage,
              let saved = CinejoySettings.lastPage,
              let url = URL(string: saved),
              Routing.decide(url) == .inApp else { return Const.home }
        return url
    }

    func pauseMedia() {
        webView?.pauseAllMediaPlayback(completionHandler: nil)
        sceneWentAway()
    }

    // MARK: - Building

    private func buildWebView() {
        let config = WKWebViewConfiguration()

        // A film the user opened on purpose should not need a second tap
        // inside the page, and it should play in place rather than being
        // thrown into the system player.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = true
        config.websiteDataStore = .default()          // keep the login and the watch list
        config.preferences.javaScriptCanOpenWindowsAutomatically = false

        // The player's own full-screen button needs the HTML Fullscreen API.
        if #available(iOS 15.4, *) { config.preferences.isElementFullscreenEnabled = true }

        config.userContentController.addUserScript(Self.mediaWatcherScript())
        config.userContentController.add(WeakMessageHandler(self), name: Const.mediaHandler)

        // Ciname's back button, placed in the site's own top bar (ciname/Injected/back-button.js)
        if onExit != nil, let url = Bundle.main.url(forResource: "back-button", withExtension: "js"),
           let js = try? String(contentsOf: url, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd,
                                                                    forMainFrameOnly: true))
            config.userContentController.add(WeakMessageHandler(self), name: Const.exitHandler)
        }

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = Palette.page
        webView.scrollView.backgroundColor = Palette.page
        webView.scrollView.indicatorStyle = .white

        // An edge swipe goes back a page; with no page left to go back to, Ciname
        // takes the same swipe and returns to the picker (as does the back button on Home).
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = true

        refresh.tintColor = Palette.accent
        refresh.addTarget(self, action: #selector(pulled), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] web, _ in
            guard let self = self else { return }
            self.progress.progress = Float(web.estimatedProgress)
            self.progress.isHidden = web.estimatedProgress >= 1
        }
    }

    private func buildChrome() {
        progress.progressTintColor = Palette.accent
        progress.trackTintColor = .clear
        progress.isHidden = true
        progress.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(progress)

        fault.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(fault)

        toast.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toast)

        NSLayoutConstraint.activate([
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.heightAnchor.constraint(equalToConstant: 2),

            fault.topAnchor.constraint(equalTo: view.topAnchor),
            fault.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            fault.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            fault.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            toast.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toast.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            toast.leadingAnchor.constraint(greaterThanOrEqualTo: view.layoutMarginsGuide.leadingAnchor),
            toast.trailingAnchor.constraint(lessThanOrEqualTo: view.layoutMarginsGuide.trailingAnchor),
        ])
    }

    // MARK: - Navigation

    private func load(_ url: URL) {
        lastGoodURL = url
        fault.isHidden = true
        webView.load(URLRequest(url: url))
    }

    private var currentURL: URL { webView.url ?? lastGoodURL }

    @objc private func pulled() {
        webView.reload()
    }

    @objc private func goBack() { if webView.canGoBack { webView.goBack() } }
    @objc private func goForward() { if webView.canGoForward { webView.goForward() } }
    @objc private func goHome() { load(Const.home) }
    @objc private func reload() { webView.reload() }
    @objc private func leave() { onExit?() }

    @objc private func copyLink() {
        UIPasteboard.general.string = currentURL.absoluteString
        toast.show("Link copied")
    }

    @objc private func openInBrowser() {
        UIApplication.shared.open(currentURL)
    }

    @objc private func togglePopups() {
        CinejoySettings.blockPopups.toggle()
        toast.show(CinejoySettings.blockPopups
                   ? "Pop-ups blocked"
                   : "Pop-ups allowed  ·  off-site ones open in Safari")
    }

    private func hand(toSystem url: URL) {
        UIApplication.shared.open(url, options: [:]) { [weak self] ok in
            if !ok { self?.toast.show("Nothing on this device opens that link") }
        }
    }

    // MARK: - Keeping the screen on

    /// Nothing here touches the screen during a film, so iOS would dim and lock
    /// partway through. Hold that off while a player is actually running.
    private func setPlaying(_ delta: Int) {
        playing = max(0, playing + delta)
        UIApplication.shared.isIdleTimerDisabled = playing > 0
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }

    func sceneWentAway() {
        playing = 0
        UIApplication.shared.isIdleTimerDisabled = false
    }

    /// Injected into every frame, so a player inside an iframe counts too.
    private static func mediaWatcherScript() -> WKUserScript {
        let source = """
        (function () {
          function post(what) {
            try { window.webkit.messageHandlers.\(Const.mediaHandler).postMessage(what); } catch (e) {}
          }
          document.addEventListener('play', function () { post('play'); }, true);
          document.addEventListener('pause', function () { post('pause'); }, true);
          document.addEventListener('ended', function () { post('pause'); }, true);
          window.addEventListener('pagehide', function () { post('gone'); });
        })();
        """
        return WKUserScript(source: source,
                            injectionTime: .atDocumentEnd,
                            forMainFrameOnly: false)
    }

    // MARK: - Hardware keyboard (the iPad's Magic Keyboard earns these)

    override var canBecomeFirstResponder: Bool { true }

    override var keyCommands: [UIKeyCommand]? {
        [
            UIKeyCommand(title: "Back", action: #selector(goBack),
                         input: "[", modifierFlags: .command),
            UIKeyCommand(title: "Forward", action: #selector(goForward),
                         input: "]", modifierFlags: .command),
            UIKeyCommand(title: "Back", action: #selector(goBack),
                         input: UIKeyCommand.inputLeftArrow, modifierFlags: .command),
            UIKeyCommand(title: "Forward", action: #selector(goForward),
                         input: UIKeyCommand.inputRightArrow, modifierFlags: .command),
            UIKeyCommand(title: "Home", action: #selector(goHome),
                         input: "H", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Reload", action: #selector(reload),
                         input: "R", modifierFlags: .command),
            UIKeyCommand(title: "Copy Link", action: #selector(copyLink),
                         input: "C", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Open in Safari", action: #selector(openInBrowser),
                         input: "O", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Toggle Pop-up Blocking", action: #selector(togglePopups),
                         input: "P", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Back to Ciname", action: #selector(leave),
                         input: "L", modifierFlags: [.command, .shift]),
        ]
    }
}

// MARK: - Navigation policy

extension CinejoyViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {

        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // sourceFrame is typed non-optional but can be nil (a load the app started), so read it safely
        let source = navigationAction.value(forKey: "sourceFrame") as? WKFrameInfo

        switch Routing.decide(url) {
        case .inApp:
            decisionHandler(.allow)

        case .external:
            // The players are frames from other sites, and they load in place.
            if let frame = navigationAction.targetFrame, !frame.isMainFrame {
                decisionHandler(.allow)
                return
            }
            decisionHandler(.cancel)
            // Only a link tapped on Cinejoy's own page goes to the real browser. A redirect, a tap
            // inside a player, or a new-window link while pop-ups are blocked is an ad: it goes nowhere.
            let tapped = navigationAction.navigationType == .linkActivated && (source?.isMainFrame ?? false)
            let newWindow = navigationAction.targetFrame == nil
            if tapped && (!newWindow || !CinejoySettings.blockPopups) {
                hand(toSystem: url)
            }

        case .block:
            // A player frame should not be able to fire off another app on its
            // own; the site's own pages keep the normal behaviour.
            decisionHandler(.cancel)
            if let origin = source?.securityOrigin, Routing.isOwnOrigin(scheme: origin.`protocol`, host: origin.host) {
                hand(toSystem: url)
            } else {
                toast.show("Blocked an app launch from an embedded frame")
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refresh.endRefreshing()
        progress.isHidden = true
        fault.isHidden = true

        if Routing.decide(currentURL) == .inApp {
            lastGoodURL = currentURL
            CinejoySettings.lastPage = currentURL.absoluteString
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showFault(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showFault(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        load(lastGoodURL)
    }

    private func showFault(_ error: Error) {
        refresh.endRefreshing()
        progress.isHidden = true

        // Cancelled loads are our own doing, when we send a link to Safari.
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return }
        if ns.domain == "WebKitErrorDomain" && ns.code == 102 { return }

        fault.present(
            title: "Cannot reach cinejoy.pk",
            body: "Check your connection, VPN or DNS filter, then try again.\n\n\(ns.localizedDescription)",
            primaryTitle: "Try again",
            primaryAction: { [weak self] in
                guard let self = self else { return }
                self.fault.isHidden = true
                self.load(self.lastGoodURL)
            },
            secondaryTitle: "Open in Safari",
            secondaryAction: { [weak self] in
                guard let self = self else { return }
                UIApplication.shared.open(self.lastGoodURL)
            })
    }
}

// MARK: - Pop-ups

extension CinejoyViewController: WKUIDelegate {

    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {

        guard let url = navigationAction.request.url else { return nil }

        switch Popups.decide(route: Routing.decide(url),
                             blocking: CinejoySettings.blockPopups,
                             allowOnce: false) {
        case .inApp:
            webView.load(URLRequest(url: url))
        case .browser:
            hand(toSystem: url)
        case .drop:
            toast.show("Pop-up blocked")
        }

        // Never hand back a second web view: this app is one window.
        return nil
    }

    // The site is the only thing running here, so its dialogs are safe to show
    // rather than to swallow. Frames (the players) get none: those are ad prompts.
    func webView(_ webView: WKWebView,
                 runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        guard frame.isMainFrame else { return completionHandler() }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView,
                 runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        guard frame.isMainFrame else { return completionHandler(false) }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}

// MARK: - Media messages

extension CinejoyViewController: WKScriptMessageHandler {

    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        if message.name == Const.exitHandler { onExit?(); return }
        guard message.name == Const.mediaHandler, let what = message.body as? String else { return }

        switch what {
        case "play": setPlaying(+1)
        case "pause": setPlaying(-1)
        default: sceneWentAway()
        }
    }
}

/// WKUserContentController retains its handlers, and the handler here is the
/// view controller that owns it. This breaks that ring.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

/// What the standalone app kept under Settings -> Cinejoy. Ciname has no Settings page of its own, so
/// these keep their defaults: pop-ups blocked, start on the home page. Cmd-Shift-P still flips blocking.
enum CinejoySettings {
    static let blockPopupsKey = "cinejoy.block_popups"
    static let restoreLastPageKey = "cinejoy.restore_last_page"
    static let lastPageKey = "cinejoy.last_page"

    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            blockPopupsKey: true,
            restoreLastPageKey: false,
        ])
    }

    static var blockPopups: Bool {
        get { UserDefaults.standard.bool(forKey: blockPopupsKey) }
        set { UserDefaults.standard.set(newValue, forKey: blockPopupsKey) }
    }

    static var restoreLastPage: Bool {
        UserDefaults.standard.bool(forKey: restoreLastPageKey)
    }

    static var lastPage: String? {
        get { UserDefaults.standard.string(forKey: lastPageKey) }
        set { UserDefaults.standard.set(newValue, forKey: lastPageKey) }
    }
}
