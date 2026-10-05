// Ciname for Windows: Anikku and Cinejoy in one window, behind a picker.
//
// A WinForms window holding three Edge WebView2 views stacked on top of each other: the picker
// (ciname/Launcher/launcher.html), Anikku (docs/, bundled into one page by ios/bundle_web.py) and
// Cinejoy (cinejoy.pk). The pages the app ships are embedded in the exe and served from made-up
// https origins. Anikku's player skin goes into the MegaPlay frame, pop-ups are refused, ad domains
// get an empty answer, and each app's Home has a back arrow to the picker (Alt+Home works anywhere).
//
// Built with the .NET Framework compiler (C# 5).

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Ciname")]
[assembly: AssemblyProduct("Ciname")]
[assembly: AssemblyDescription("Anikku and Cinejoy in one app")]
[assembly: AssemblyVersion("1.0.4.0")]
[assembly: AssemblyFileVersion("1.0.4.0")]
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8")]

namespace CinameApp
{
    internal static class Program
    {
        internal const string AppName = "Ciname";
        internal const string RuntimeUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

        [STAThread]
        private static void Main(string[] argv)
        {
            AppDomain.CurrentDomain.AssemblyResolve += Embedded.Resolve;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e)
            {
                MessageBox.Show(e.Exception.Message, AppName + " hit a problem", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            };
            Launch(argv);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void Launch(string[] argv)
        {
            using (Mutex gate = new Mutex(false, "Local\\CinameDesktop.SingleInstance"))
            {
                bool owned;
                try { owned = gate.WaitOne(0); }
                catch (AbandonedMutexException) { owned = true; }

                if (!owned)
                {
                    // already open: bring that window forward instead
                    Native.AllowSetForegroundWindow(-1);
                    Native.PostMessage(Native.HwndBroadcast, Native.ActivateMessage, IntPtr.Zero, IntPtr.Zero);
                    return;
                }
                try
                {
                    Embedded.UnpackNativeLoader();
                    Application.Run(new MainForm(argv));
                }
                finally
                {
                    try { gate.ReleaseMutex(); }
                    catch { }
                }
            }
        }

        /// <summary>"--open anikku" style arguments (used to open an app straight away when testing).</summary>
        internal static string Arg(string[] argv, string name)
        {
            for (int i = 0; i + 1 < argv.Length; i++)
                if (string.Equals(argv[i], name, StringComparison.OrdinalIgnoreCase)) return argv[i + 1];
            return null;
        }

        // Only web links ever reach the shell.
        internal static void OpenExternally(string target)
        {
            Uri u;
            if (!Uri.TryCreate(target ?? "", UriKind.Absolute, out u)) return;
            if (u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeHttp) return;
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(u.AbsoluteUri);
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            catch { }
        }
    }

    internal static class Paths
    {
        internal static string DataDir
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), Program.AppName); }
        }
        internal static string BrowserData { get { return Path.Combine(DataDir, "WebView2"); } }
        internal static string NativeDir { get { return Path.Combine(DataDir, "bin"); } }
        internal static string WindowFile { get { return Path.Combine(DataDir, "window.cfg"); } }
    }

    internal static class Embedded
    {
        internal static Assembly Resolve(object sender, ResolveEventArgs args)
        {
            string name = new AssemblyName(args.Name).Name;
            if (name.IndexOf("Microsoft.Web.WebView2", StringComparison.OrdinalIgnoreCase) < 0) return null;
            byte[] raw = Read(name + ".dll");
            return raw == null ? null : Assembly.Load(raw);
        }

        // The WebView2 managed core P/Invokes WebView2Loader.dll by bare name. Unpacking it and
        // LoadLibrary-ing the full path puts it in the process module list, so that lookup resolves.
        internal static void UnpackNativeLoader()
        {
            try
            {
                byte[] raw = Read("WebView2Loader.dll");
                if (raw == null) return;
                Directory.CreateDirectory(Paths.NativeDir);
                string path = Path.Combine(Paths.NativeDir, "WebView2Loader.dll");
                FileInfo fi = new FileInfo(path);
                if (!fi.Exists || fi.Length != raw.Length) File.WriteAllBytes(path, raw);
                Native.LoadLibrary(path);
            }
            catch
            {
                // Non-fatal: if the runtime can find its own loader we are fine.
            }
        }

        internal static byte[] Read(string resource)
        {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
            {
                if (s == null) return null;
                byte[] buf = new byte[s.Length];
                int done = 0;
                while (done < buf.Length)
                {
                    int n = s.Read(buf, done, buf.Length - done);
                    if (n <= 0) break;
                    done += n;
                }
                return buf;
            }
        }

        internal static string ReadText(string resource)
        {
            byte[] raw = Read(resource);
            return raw == null ? null : Encoding.UTF8.GetString(raw).TrimStart('﻿');
        }
    }

    /// <summary>
    /// Which hosts belong where. Free of WebView2 types so tests/RouteTests.cs can check it on its own.
    /// </summary>
    internal static class Routes
    {
        internal const string PickerHost = "ciname.local";
        internal const string AnikkuHost = "app.anikku.local";

        internal static readonly string[] PlayerHosts = { "megaplay.buzz", "megaplay-1.buzz" };
        internal static readonly string[] CinejoyHosts = { "cinejoy.pk", "cinejoy.to" };
        /// <summary>Off-site links a click may open in the real browser (trailers, AniList).</summary>
        internal static readonly string[] HandOffHosts = { "youtube.com", "youtu.be", "anilist.co" };

        /// <summary>The same list as the iOS and Android apps' blockers.</summary>
        internal static readonly string[] AdDomains =
        {
            "doubleclick.net", "googlesyndication.com", "googleadservices.com", "google-analytics.com", "googletagmanager.com",
            "adservice.google.com", "adnxs.com", "adsterra.com", "adsterratech.com", "highperformanceformat.com", "profitablecpmrate.com",
            "profitablegatecpm.com", "propellerads.com", "propellerclick.com", "onclickads.net", "onclckmn.com", "popads.net", "popcash.net",
            "exoclick.com", "exosrv.com", "juicyads.com", "trafficjunky.net", "hilltopads.net", "hilltopads.com", "a-ads.com",
            "monetag.com", "mc.yandex.ru", "an.yandex.ru", "statlytic.net", "clickadu.com", "clickaine.com",
            "galaksion.com", "adcash.com", "admaven.com", "ad-maven.com", "realsrv.com", "rtmark.net", "tsyndicate.com",
            "bidgear.com", "pubfuture.com", "vdo.ai", "aclib.net", "acscdn.com", "dtscout.com", "dtscdn.com",
            "histats.com", "whos.amung.us", "disqusads.com", "s.pubmine.com", "adskeeper.com", "mgid.com", "lijit.com",
            "nekostream.site", "llvpn.com", "luugy.com", "plausible.io", "jwpltx.com",
        };

        internal static string HostOf(string url)
        {
            Uri u;
            return Uri.TryCreate(url ?? "", UriKind.Absolute, out u) && !string.IsNullOrEmpty(u.Host) ? u.Host.ToLowerInvariant() : "";
        }

        internal static bool Under(string host, string[] list)
        {
            if (string.IsNullOrEmpty(host)) return false;
            foreach (string d in list)
                if (host == d || host.EndsWith("." + d, StringComparison.Ordinal)) return true;
            return false;
        }

        /// <summary>Things a web view resolves by itself: blank frames, data and blob URLs.</summary>
        internal static bool IsPassThrough(string url)
        {
            string u = (url ?? "").TrimStart().ToLowerInvariant();
            return u.StartsWith("about:") || u.StartsWith("data:") || u.StartsWith("blob:");
        }

        internal static bool IsAd(string url) { return Under(HostOf(url), AdDomains); }
        internal static bool IsPlayer(string url) { return Under(HostOf(url), PlayerHosts); }
        internal static bool IsCinejoy(string url) { return Under(HostOf(url), CinejoyHosts); }
        internal static bool IsHandOff(string url) { return Under(HostOf(url), HandOffHosts); }
        internal static bool IsAnikku(string url) { return HostOf(url) == AnikkuHost; }
        internal static bool IsPicker(string url) { return HostOf(url) == PickerHost; }

        /// <summary>Which embedded page a request for one of the app's own origins gets, or null.</summary>
        internal static string PageFor(string url)
        {
            Uri u;
            if (!Uri.TryCreate(url ?? "", UriKind.Absolute, out u) || u.Scheme != Uri.UriSchemeHttps) return null;
            if (u.AbsolutePath != "/" && u.AbsolutePath != "/index.html") return null;
            string host = u.Host.ToLowerInvariant();
            if (host == PickerHost) return "launcher.html";
            if (host == AnikkuHost) return "index.html";
            return null;
        }
    }

    internal sealed class MainForm : Form
    {
        private enum Pane { Picker, Anikku, Cinejoy }

        private static readonly Color Page = Color.FromArgb(6, 6, 8);

        private readonly string[] _argv;
        private CoreWebView2Environment _env;
        private WebView2 _picker, _anikku, _cinejoy;
        private Pane _current = Pane.Picker;
        private bool _opening;

        private bool _fullscreen;
        private FormWindowState _restoreState;
        private Rectangle _restoreBounds;

        public MainForm(string[] argv)
        {
            _argv = argv;
            Text = Program.AppName;
            BackColor = Page;
            MinimumSize = new Size(900, 560);
            KeyPreview = true;
            try
            {
                byte[] ico = Embedded.Read("ciname.ico");
                if (ico != null) Icon = new Icon(new MemoryStream(ico));
            }
            catch { }
            RestoreWindow();
        }

        // -- window ---------------------------------------------------------------------------------

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Native.StyleCaption(Handle, Page, Color.FromArgb(236, 236, 240), Color.FromArgb(28, 28, 34));
        }

        protected override async void OnShown(EventArgs e)
        {
            base.OnShown(e);
            await StartUp();
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == Native.ActivateMessage)
            {
                if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                Activate();
                return;
            }
            base.WndProc(ref m);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.F11) { SetFullscreen(!_fullscreen); return true; }
            if (keyData == (Keys.Alt | Keys.Home)) { ShowPicker(); return true; }
            if (keyData == Keys.Escape && _fullscreen && !PageIsFullscreen()) { SetFullscreen(false); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        private void RestoreWindow()
        {
            StartPosition = FormStartPosition.Manual;
            Rectangle work = Screen.PrimaryScreen.WorkingArea;
            Size size = new Size(Math.Min(1360, work.Width - 80), Math.Min(860, work.Height - 60));
            Bounds = new Rectangle(work.Left + (work.Width - size.Width) / 2, work.Top + (work.Height - size.Height) / 2, size.Width, size.Height);
            try
            {
                string[] p = File.ReadAllText(Paths.WindowFile).Trim().Split(',');
                Rectangle r = new Rectangle(int.Parse(p[0], CultureInfo.InvariantCulture), int.Parse(p[1], CultureInfo.InvariantCulture),
                                            int.Parse(p[2], CultureInfo.InvariantCulture), int.Parse(p[3], CultureInfo.InvariantCulture));
                foreach (Screen s in Screen.AllScreens)
                    if (s.WorkingArea.IntersectsWith(r) && r.Width >= MinimumSize.Width && r.Height >= MinimumSize.Height) { Bounds = r; break; }
                if (p.Length > 4 && p[4] == "max") WindowState = FormWindowState.Maximized;
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            try
            {
                Rectangle r = _fullscreen ? _restoreBounds : (WindowState == FormWindowState.Normal ? Bounds : RestoreBounds);
                bool max = _fullscreen ? _restoreState == FormWindowState.Maximized : WindowState == FormWindowState.Maximized;
                Directory.CreateDirectory(Paths.DataDir);
                File.WriteAllText(Paths.WindowFile, string.Format(CultureInfo.InvariantCulture, "{0},{1},{2},{3},{4}",
                    r.X, r.Y, r.Width, r.Height, max ? "max" : "normal"));
            }
            catch { }
            Native.KeepAwake(false);
            base.OnFormClosing(e);
        }

        /// <summary>Full screen for a player's own full-screen button, or F11.</summary>
        private void SetFullscreen(bool on)
        {
            if (on == _fullscreen) return;
            _fullscreen = on;
            if (on)
            {
                _restoreState = WindowState;
                if (WindowState == FormWindowState.Maximized) WindowState = FormWindowState.Normal;
                _restoreBounds = Bounds;
                FormBorderStyle = FormBorderStyle.None;
                Bounds = Screen.FromControl(this).Bounds;
            }
            else
            {
                FormBorderStyle = FormBorderStyle.Sizable;
                Bounds = _restoreBounds;
                WindowState = _restoreState;
                Native.StyleCaption(Handle, Page, Color.FromArgb(236, 236, 240), Color.FromArgb(28, 28, 34));
            }
        }

        private bool PageIsFullscreen()
        {
            WebView2 w = ViewOf(_current);
            try { return w != null && w.CoreWebView2 != null && w.CoreWebView2.ContainsFullScreenElement; }
            catch { return false; }
        }

        // -- start ----------------------------------------------------------------------------------

        private async Task StartUp()
        {
            Exception last = null;
            for (int attempt = 0; attempt < 4 && _env == null; attempt++)
            {
                try
                {
                    CoreWebView2EnvironmentOptions opts = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required");
                    _env = await CoreWebView2Environment.CreateAsync(null, Paths.BrowserData, opts);
                }
                catch (Exception ex) { last = ex; }
                if (_env == null) await Task.Delay(600);
            }
            if (_env == null)
            {
                if (MessageBox.Show("Ciname needs the Microsoft Edge WebView2 runtime, which is missing or failed to start.\r\n\r\n" +
                        (last != null ? last.Message + "\r\n\r\n" : "") + "Open Microsoft's download page now?",
                        Program.AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
                    Program.OpenExternally(Program.RuntimeUrl);
                Close();
                return;
            }

            _picker = await MakeView();
            CoreWebView2 core = _picker.CoreWebView2;
            core.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
            {
                if (!Routes.IsPicker(e.Uri) && !Routes.IsPassThrough(e.Uri)) e.Cancel = true;
            };
            core.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.WebMessageReceived += delegate(object s, CoreWebView2WebMessageReceivedEventArgs e)
            {
                string json = e.WebMessageAsJson ?? "";
                if (json.Contains("\"anikku\"")) Open(Pane.Anikku, null);
                else if (json.Contains("\"cinejoy\"")) Open(Pane.Cinejoy, null);
            };
            core.Navigate("https://" + Routes.PickerHost + "/");
            ShowPane(Pane.Picker);

            string open = Program.Arg(_argv, "--open");
            if (open == "anikku") Open(Pane.Anikku, Program.Arg(_argv, "--path"));
            else if (open == "cinejoy") Open(Pane.Cinejoy, null);
        }

        private async Task<WebView2> MakeView()
        {
            WebView2 w = new WebView2();
            w.Dock = DockStyle.Fill;
            w.DefaultBackgroundColor = Page;
            Controls.Add(w);
            await w.EnsureCoreWebView2Async(_env);

            CoreWebView2 core = w.CoreWebView2;
            core.Settings.UserAgent = core.Settings.UserAgent + " CinameDesktop/1.0";
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            // feels like an app: no Ctrl+/pinch zoom and no right-click copy/paste menu (selection is off in the CSS)
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            try { core.Settings.IsPinchZoomEnabled = false; }
            catch { }
            try
            {
                core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Profile.PreferredColorScheme = CoreWebView2PreferredColorScheme.Dark;
            }
            catch { }

            core.ContainsFullScreenElementChanged += delegate { SetFullscreen(core.ContainsFullScreenElement); };
            core.IsDocumentPlayingAudioChanged += delegate { UpdateKeepAwake(); };
            core.ProcessFailed += delegate(object s, CoreWebView2ProcessFailedEventArgs e)
            {
                if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited ||
                    e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                    try { core.Reload(); } catch { }
            };

            // the app's own pages, and an empty answer for ad domains - in every frame, not just the page
            try { core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All); }
            catch { core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All); }
            core.WebResourceRequested += OnResource;
            return w;
        }

        private void OnResource(object sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            string url = e.Request.Uri;
            string page = Routes.PageFor(url);
            if (page != null)
            {
                byte[] raw = Embedded.Read(page) ?? Encoding.UTF8.GetBytes("<body style='background:#000;color:#fff'>Missing " + page);
                e.Response = _env.CreateWebResourceResponse(new MemoryStream(raw), 200, "OK",
                    "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store");
                return;
            }
            if (Routes.IsAd(url))
                e.Response = _env.CreateWebResourceResponse(null, 204, "No Content", "");
        }

        // -- the two apps ---------------------------------------------------------------------------

        private async void Open(Pane pane, string path)
        {
            if (_opening || pane == Pane.Picker) return;
            _opening = true;
            try
            {
                if (pane == Pane.Anikku)
                {
                    if (_anikku == null)
                    {
                        _anikku = await MakeView();
                        await SetUpAnikku(_anikku.CoreWebView2);
                        _anikku.CoreWebView2.Navigate("https://" + Routes.AnikkuHost + "/" + (path ?? "#/"));
                    }
                    else if (path != null) _anikku.CoreWebView2.Navigate("https://" + Routes.AnikkuHost + "/" + path);
                }
                else if (_cinejoy == null)
                {
                    _cinejoy = await MakeView();
                    await SetUpCinejoy(_cinejoy.CoreWebView2);
                    _cinejoy.CoreWebView2.Navigate("https://cinejoy.pk/");
                }
                ShowPane(pane);
            }
            finally { _opening = false; }
        }

        private async Task SetUpAnikku(CoreWebView2 core)
        {
            // These run in every frame before its own scripts. skin.js only acts inside the MegaPlay
            // player frame: Anikku's controls, and its strict mode (no new tabs, only the player's scripts).
            await core.AddScriptToExecuteOnDocumentCreatedAsync("try{window.open=function(){return null}}catch(e){}");
            string skin = Embedded.ReadText("skin.js");
            if (skin != null) await core.AddScriptToExecuteOnDocumentCreatedAsync(skin);

            core.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
            {
                if (Routes.IsAnikku(e.Uri) || Routes.IsPassThrough(e.Uri)) return;
                // the app never leaves its page: a trailer goes to the browser, anything else is an ad
                e.Cancel = true;
                if (e.IsUserInitiated && Routes.IsHandOff(e.Uri)) Program.OpenExternally(e.Uri);
            };
            // frames may only be the video players: ad frames inside them never load
            core.FrameNavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
            {
                if (!Routes.IsPlayer(e.Uri) && !Routes.IsPassThrough(e.Uri)) e.Cancel = true;
            };
            core.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e)
            {
                e.Handled = true;
                if (e.IsUserInitiated && Routes.IsHandOff(e.Uri)) Program.OpenExternally(e.Uri);
            };
            core.WebMessageReceived += OnAppMessage;
        }

        private async Task SetUpCinejoy(CoreWebView2 core)
        {
            // Ciname's back arrow in the site's own top bar, on its home page (ciname/Injected/back-button.js)
            string back = Embedded.ReadText("back-button.js");
            if (back != null) await core.AddScriptToExecuteOnDocumentCreatedAsync(back);
            string feel = Embedded.ReadText("app-feel.js");          // no selection or copy menu on the site
            if (feel != null) await core.AddScriptToExecuteOnDocumentCreatedAsync(feel);

            core.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
            {
                if (Routes.IsCinejoy(e.Uri) || Routes.IsPassThrough(e.Uri)) return;
                // off-site links you click go to the real browser; redirects without a click are ads
                e.Cancel = true;
                if (e.IsUserInitiated) Program.OpenExternally(e.Uri);
            };
            core.FrameNavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e)
            {
                if (Routes.IsAd(e.Uri)) e.Cancel = true;      // the players themselves are other sites' frames
            };
            core.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e)
            {
                // one window: Cinejoy's own links open in place, pop-ups go nowhere
                e.Handled = true;
                if (Routes.IsCinejoy(e.Uri)) core.Navigate(e.Uri);
            };
            core.WebMessageReceived += OnAppMessage;
        }

        /// <summary>An app's back arrow on its Home posts "exit".</summary>
        private void OnAppMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string text = null;
            try { text = e.TryGetWebMessageAsString(); }
            catch { }
            if (text == "exit") ShowPicker();
        }

        private WebView2 ViewOf(Pane pane)
        {
            return pane == Pane.Anikku ? _anikku : pane == Pane.Cinejoy ? _cinejoy : _picker;
        }

        private void ShowPane(Pane pane)
        {
            WebView2 shown = ViewOf(pane);
            if (shown == null) return;
            _current = pane;
            shown.Visible = true;
            shown.BringToFront();
            foreach (WebView2 w in new[] { _picker, _anikku, _cinejoy })
            {
                if (w == null || w == shown) continue;
                w.Visible = false;   // hidden views stop painting, so the one on screen has the machine
            }
            try { shown.CoreWebView2.IsMuted = false; }
            catch { }
            shown.Focus();
            Text = pane == Pane.Picker ? Program.AppName : Program.AppName + " · " + (pane == Pane.Anikku ? "Anikku" : "Cinejoy");
            if (pane == Pane.Picker) ExecuteSafe(_picker, "window.cinameReset && cinameReset()");
        }

        /// <summary>Back to the picker. The app is paused, muted and kept for next time.</summary>
        private void ShowPicker()
        {
            if (_current == Pane.Picker || _picker == null) return;
            if (_fullscreen) SetFullscreen(false);
            WebView2 app = ViewOf(_current);
            if (app != null && app.CoreWebView2 != null)
            {
                ExecuteSafe(app, "try{document.querySelectorAll('video,audio').forEach(function(v){v.pause()});" +
                                 "document.querySelectorAll('iframe').forEach(function(f){f.contentWindow.postMessage({anikkuCmd:'key',key:'pause'},'*')})}catch(e){}");
                try { app.CoreWebView2.IsMuted = true; }
                catch { }
            }
            ShowPane(Pane.Picker);
            UpdateKeepAwake();
        }

        private static void ExecuteSafe(WebView2 w, string script)
        {
            try { if (w != null && w.CoreWebView2 != null) w.CoreWebView2.ExecuteScriptAsync(script); }
            catch { }
        }

        /// <summary>Hold off sleep and the screen saver while an episode or film is playing.</summary>
        private void UpdateKeepAwake()
        {
            bool playing = false;
            foreach (WebView2 w in new[] { _anikku, _cinejoy })
            {
                try { if (w != null && w.Visible && w.CoreWebView2 != null && w.CoreWebView2.IsDocumentPlayingAudio) playing = true; }
                catch { }
            }
            Native.KeepAwake(playing);
        }
    }

    internal static class Native
    {
        internal static readonly IntPtr HwndBroadcast = new IntPtr(0xffff);
        internal static readonly int ActivateMessage = RegisterWindowMessage("CinameDesktop.Activate");

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern IntPtr LoadLibrary(string path);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int RegisterWindowMessage(string name);

        [DllImport("user32.dll")]
        internal static extern bool PostMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        internal static extern bool AllowSetForegroundWindow(int processId);

        [DllImport("kernel32.dll")]
        private static extern uint SetThreadExecutionState(uint flags);

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hWnd, int attribute, ref int value, int size);

        internal static void KeepAwake(bool on)
        {
            const uint Continuous = 0x80000000, SystemRequired = 0x00000001, DisplayRequired = 0x00000002;
            try { SetThreadExecutionState(on ? Continuous | SystemRequired | DisplayRequired : Continuous); }
            catch { }
        }

        private static int ColorRef(Color c) { return c.R | (c.G << 8) | (c.B << 16); }

        /// <summary>Dark title bar in the app's own colours (Windows 11; dark mode only on Windows 10).</summary>
        internal static void StyleCaption(IntPtr hWnd, Color caption, Color text, Color border)
        {
            try
            {
                int on = 1;
                if (DwmSetWindowAttribute(hWnd, 20, ref on, sizeof(int)) != 0) DwmSetWindowAttribute(hWnd, 19, ref on, sizeof(int));
                int c = ColorRef(caption), t = ColorRef(text), b = ColorRef(border);
                DwmSetWindowAttribute(hWnd, 35, ref c, sizeof(int));
                DwmSetWindowAttribute(hWnd, 36, ref t, sizeof(int));
                DwmSetWindowAttribute(hWnd, 34, ref b, sizeof(int));
            }
            catch { }
        }
    }
}
