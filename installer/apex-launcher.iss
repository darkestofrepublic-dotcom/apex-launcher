; Installateur Inno Setup — Apex Launcher (ApexDevlabs)
; Génère ApexLauncher-Setup-x64.exe depuis release\win-unpacked (produit par electron-builder --dir).
; Usage : ISCC.exe /DAppVersion=1.0.0 installer\apex-launcher.iss
; Ou : npm run installer (vérifie et compile automatiquement).

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{A3F1B2C4-7D8E-4A5B-9C0D-APEXLAUNCHER1}
AppName=Apex Launcher
AppVersion={#AppVersion}
AppVerName=Apex Launcher {#AppVersion}
AppPublisher=ApexDevlabs
AppPublisherURL=https://github.com/apexdevlabs/apex-launcher
AppSupportURL=https://github.com/apexdevlabs/apex-launcher
AppUpdatesURL=https://github.com/apexdevlabs/apex-launcher
DefaultDirName={autopf}\Apex Launcher
DefaultGroupName=Apex Launcher
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=ApexLauncher-Setup-x64
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
PrivilegesRequired=lowest
ShowLanguageDialog=no
UninstallDisplayName=Apex Launcher
VersionInfoVersion={#AppVersion}
VersionInfoCompany=ApexDevlabs
VersionInfoDescription=Installeur Apex Launcher — client Minecraft moderne
VersionInfoProductName=Apex Launcher
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\Apex Launcher.exe
WizardStyle=modern

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
french.LaunchNow=Lancer Apex Launcher maintenant
french.DesktopIcon=Créer un raccourci sur le bureau
french.KeepData=Vos mondes, instances, sauvegardes et paramètres sont conservés.
english.LaunchNow=Launch Apex Launcher now
english.DesktopIcon=Create a desktop shortcut
english.KeepData=Your worlds, instances, backups and settings are kept.

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Fichiers réellement compilés de l'application.
; Si win-unpacked est absent, la compilation échoue explicitement (pas d'installateur vide).
Source: "..\release\win-unpacked\Apex Launcher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Apex Launcher"; Filename: "{app}\Apex Launcher.exe"
Name: "{autodesktop}\Apex Launcher"; Filename: "{app}\Apex Launcher.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Apex Launcher.exe"; Description: "{cm:LaunchNow}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Ne JAMAIS supprimer les données utilisateur (mondes, instances, sauvegardes, paramètres).
; Seuls les fichiers de l'installation sont retirés ; %APPDATA%\ApexLauncher est conservé.

[Code]
function InitializeSetup(): Boolean;
begin
  if not IsWin64 then
  begin
    MsgBox('Apex Launcher nécessite Windows 10 ou 11 64 bits.', mbError, MB_OK);
    Result := False;
  end
  else
    Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { Message uniquement en mode interactif : ne jamais bloquer une désinstallation silencieuse. }
  if (CurUninstallStep = usPostUninstall) and not UninstallSilent then
    MsgBox(ExpandConstant('{cm:KeepData}'), mbInformation, MB_OK);
end;
