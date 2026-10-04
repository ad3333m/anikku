import UIKit
import WebKit

/// Ciname opens on a picker (Launcher/launcher.html) with two apps: Anikku, the bundled site in
/// WebViewController, and Cinejoy, the cinejoy.pk shell. An app keeps running once it's open, so going
/// back to the picker and in again lands where you left off. The way back out is the back button on each
/// app's Home screen, or a swipe in from the left edge once there's no page left to go back to.
final class RootViewController: UIViewController {
    enum App: String { case anikku, cinejoy }

    private static let launcherOrigin = URL(string: "https://ciname.local/")!
    private static let recede = CGAffineTransform(scaleX: 0.94, y: 0.94)

    private var launcher: WKWebView!
    private let dim = UIView()
    private var edge: UIScreenEdgePanGestureRecognizer!
    private var apps: [App: UIViewController] = [:]
    private var current: UIViewController?

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var childForStatusBarStyle: UIViewController? { current }
    override var childForStatusBarHidden: UIViewController? { current }
    override var childForHomeIndicatorAutoHidden: UIViewController? { current }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .pad ? .all : .allButUpsideDown
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let config = WKWebViewConfiguration()
        config.userContentController.add(WeakMessageHandler(self), name: "ciname")
        launcher = WKWebView(frame: view.bounds, configuration: config)
        launcher.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        launcher.isOpaque = false
        launcher.backgroundColor = .black
        launcher.scrollView.isScrollEnabled = false
        launcher.scrollView.contentInsetAdjustmentBehavior = .never
        launcher.navigationDelegate = self
        view.addSubview(launcher)

        dim.frame = view.bounds
        dim.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        dim.backgroundColor = .black
        dim.alpha = 0
        dim.isUserInteractionEnabled = false
        view.addSubview(dim)

        edge = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(edgePan(_:)))
        edge.edges = .left
        edge.delegate = self
        view.addGestureRecognizer(edge)

        loadLauncher()

        // "-cinameOpen anikku" opens an app straight away (the simulator test uses it)
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-cinameOpen"), i + 1 < args.count, let app = App(rawValue: args[i + 1]) {
            open(app, animated: false)
        }
    }

    private func loadLauncher() {
        guard let url = Bundle.main.url(forResource: "launcher", withExtension: "html"),
              let html = try? String(contentsOf: url, encoding: .utf8) else { return }
        launcher.loadHTMLString(html, baseURL: Self.launcherOrigin)
    }

    func wentToBackground() {
        (apps[.cinejoy] as? CinejoyViewController)?.sceneWentAway()
    }

    // MARK: opening and leaving an app

    private func make(_ app: App) -> UIViewController {
        switch app {
        case .anikku:
            let vc = WebViewController()
            vc.onExit = { [weak self] in self?.close() }
            return vc
        case .cinejoy:
            let vc = CinejoyViewController()
            vc.onExit = { [weak self] in self?.close() }
            return vc
        }
    }

    private func open(_ app: App, animated: Bool) {
        guard current == nil else { return }
        let vc = apps[app] ?? make(app)
        apps[app] = vc
        addChild(vc)
        vc.view.transform = .identity
        vc.view.frame = view.bounds
        vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(vc.view)
        vc.didMove(toParent: self)
        current = vc
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
        vc.becomeFirstResponder()   // Cinejoy's iPad keyboard shortcuts

        guard animated else {
            dim.alpha = 0.6
            launcher.transform = Self.recede
            return
        }
        vc.view.alpha = 0
        vc.view.transform = CGAffineTransform(scaleX: 0.9, y: 0.9)
        UIView.animate(withDuration: 0.5, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.4,
                       options: [.allowUserInteraction], animations: {
            vc.view.alpha = 1
            vc.view.transform = .identity
            self.dim.alpha = 0.6
            self.launcher.transform = Self.recede
        }, completion: nil)
    }

    /// Back to the picker. The app is paused and kept for next time.
    private func close() {
        guard let vc = current else { return }
        current = nil
        (vc as? WebViewController)?.pauseMedia()
        (vc as? CinejoyViewController)?.pauseMedia()
        launcher.evaluateJavaScript("window.cinameReset && cinameReset()", completionHandler: nil)
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()

        UIView.animate(withDuration: 0.34, delay: 0, options: [.curveEaseOut]) {
            vc.view.transform = CGAffineTransform(translationX: self.view.bounds.width, y: 0)
            self.dim.alpha = 0
            self.launcher.transform = .identity
        } completion: { _ in
            vc.willMove(toParent: nil)
            vc.view.removeFromSuperview()
            vc.removeFromParent()
            vc.view.transform = .identity
            vc.view.layer.shadowOpacity = 0
        }
    }

    // MARK: swipe back to the picker

    @objc private func edgePan(_ g: UIScreenEdgePanGestureRecognizer) {
        guard let vc = current else { return }
        let width = view.bounds.width
        let x = max(0, g.translation(in: view).x)
        let progress = min(1, x / width)
        switch g.state {
        case .began:
            vc.view.layer.shadowColor = UIColor.black.cgColor
            vc.view.layer.shadowOpacity = 0.6
            vc.view.layer.shadowRadius = 24
            vc.view.layer.shadowOffset = CGSize(width: -8, height: 0)
            vc.view.layer.shadowPath = UIBezierPath(rect: vc.view.bounds).cgPath
        case .changed:
            vc.view.transform = CGAffineTransform(translationX: x, y: 0)
            dim.alpha = 0.6 * (1 - progress)
            let s = 0.94 + 0.06 * progress
            launcher.transform = CGAffineTransform(scaleX: s, y: s)
        case .ended where x > width * 0.35 || g.velocity(in: view).x > 700:
            close()
        default:
            UIView.animate(withDuration: 0.28, delay: 0, options: [.curveEaseOut]) {
                vc.view.transform = .identity
                self.dim.alpha = 0.6
                self.launcher.transform = Self.recede
            } completion: { _ in vc.view.layer.shadowOpacity = 0 }
        }
    }
}

extension RootViewController: UIGestureRecognizerDelegate {
    /// While the app has pages to go back through, the web view's own back swipe gets the edge.
    func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
        guard g === edge, let vc = current else { return false }
        if let anikku = vc as? WebViewController { return !anikku.canGoBack }
        if let cinejoy = vc as? CinejoyViewController { return !cinejoy.canGoBack }
        return false
    }

    func gestureRecognizer(_ g: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}

extension RootViewController: WKScriptMessageHandler, WKNavigationDelegate {
    /// The picker posts {open: "anikku" | "cinejoy"}.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let name = body["open"] as? String,
              let app = App(rawValue: name) else { return }
        open(app, animated: true)
    }

    /// The picker never navigates anywhere: it is one page.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = action.request.url
        decisionHandler(url?.host == Self.launcherOrigin.host || url?.scheme == "about" ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadLauncher()
    }
}
