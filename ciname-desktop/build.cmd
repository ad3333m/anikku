@echo off
rem Builds dist\Ciname.exe - one self-contained exe, no SDK required.
rem The pages come from the rest of the repo: Anikku's site (docs\, bundled into one page by
rem ios\bundle_web.py, which needs Node for esbuild), the picker (ciname\Launcher) and Cinejoy's
rem back arrow (ciname\Injected). They are embedded into the exe with the WebView2 libraries.
setlocal
cd /d "%~dp0"

set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo Cannot find the .NET Framework compiler at "%CSC%".
  exit /b 1
)

if not exist web mkdir web
python ..\ios\bundle_web.py web || (echo Bundling Anikku failed. & exit /b 1)
python ..\ciname\tools\inline_launcher.py web || (echo Bundling the picker failed. & exit /b 1)
copy /y ..\ciname\Injected\back-button.js web\back-button.js >nul
copy /y ..\ciname\Injected\app-feel.js web\app-feel.js >nul

if not exist dist mkdir dist
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /warn:4 /codepage:65001 ^
  /out:dist\Ciname.exe ^
  /win32icon:assets\ciname.ico ^
  /win32manifest:src\app.manifest ^
  /reference:System.dll ^
  /reference:System.Core.dll ^
  /reference:System.Drawing.dll ^
  /reference:System.Windows.Forms.dll ^
  /reference:lib\Microsoft.Web.WebView2.Core.dll ^
  /reference:lib\Microsoft.Web.WebView2.WinForms.dll ^
  /resource:lib\Microsoft.Web.WebView2.Core.dll,Microsoft.Web.WebView2.Core.dll ^
  /resource:lib\Microsoft.Web.WebView2.WinForms.dll,Microsoft.Web.WebView2.WinForms.dll ^
  /resource:lib\WebView2Loader.dll,WebView2Loader.dll ^
  /resource:assets\ciname.ico,ciname.ico ^
  /resource:web\launcher.html,launcher.html ^
  /resource:web\index.html,index.html ^
  /resource:web\skin.js,skin.js ^
  /resource:web\back-button.js,back-button.js ^
  /resource:web\app-feel.js,app-feel.js ^
  src\Program.cs

if errorlevel 1 (
  echo Build failed.
  exit /b 1
)
echo Built dist\Ciname.exe
endlocal
