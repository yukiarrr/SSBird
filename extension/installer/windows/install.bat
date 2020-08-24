@echo off

set install_dir=%LOCALAPPDATA%\MasterBird

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.yukiarrr.masterbird" /ve /t REG_SZ /d "%install_dir%\com.yukiarrr.masterbird.json" /f

xcopy /i /y .\host %install_dir%

echo Success!
