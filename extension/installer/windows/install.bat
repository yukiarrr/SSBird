@echo off

set install_dir=%LOCALAPPDATA%\SSBird

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.yukiarrr.ssbird" /ve /t REG_SZ /d "%install_dir%\com.yukiarrr.ssbird.json" /f

xcopy /i /y .\host %install_dir%

echo Success!
