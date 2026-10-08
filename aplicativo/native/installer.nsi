Unicode true
!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!include "MUI2.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
Name "Recanto das Asas"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\RecantoDasAsas"
InstallDirRegKey HKCU "Software\RecantoDasAsas" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
Function .onInit
 ${IfNot} ${AtLeastWin10}
  MessageBox MB_OK|MB_ICONSTOP "Este aplicativo requer Windows 10 ou superior."
  Abort
 ${EndIf}
 ${IfNot} ${RunningX64}
  MessageBox MB_OK|MB_ICONSTOP "Este instalador requer Windows de 64 bits."
  Abort
 ${EndIf}
 MessageBox MB_OKCANCEL "Antes de instalar ou atualizar, feche o Recanto das Asas e guarde um backup verificado. Os registros da pasta de dados serão preservados." IDOK proceed
 Abort
 proceed:
FunctionEnd
Section "Instalar"
 SetOutPath "$INSTDIR"
 File /r "${APP_DIR}\*"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\Recanto das Asas"
 CreateShortCut "$SMPROGRAMS\Recanto das Asas\Recanto das Asas.lnk" "$INSTDIR\Recanto das Asas.exe"
 CreateShortCut "$DESKTOP\Recanto das Asas.lnk" "$INSTDIR\Recanto das Asas.exe"
 WriteRegStr HKCU "Software\RecantoDasAsas" "InstallDir" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\br.com.recantodasasas.app" "DisplayName" "Recanto das Asas"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\br.com.recantodasasas.app" "DisplayVersion" "${APP_VERSION}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\br.com.recantodasasas.app" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\br.com.recantodasasas.app" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\br.com.recantodasasas.app" "NoRepair" 1
SectionEnd
Section "Uninstall"
 Delete "$DESKTOP\Recanto das Asas.lnk"
 Delete "$SMPROGRAMS\Recanto das Asas\Recanto das Asas.lnk"
 RMDir "$SMPROGRAMS\Recanto das Asas"
 RMDir /r "$INSTDIR"
 DeleteRegKey HKCU "Software\RecantoDasAsas"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\br.com.recantodasasas.app"
 ; Intentionally retain $APPDATA\RecantoDasAsas with the private encrypted vault.
SectionEnd
