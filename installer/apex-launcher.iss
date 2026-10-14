; Installateur Inno Setup — Apex Launcher (ApexDevlabs)
; Expérience personnalisée : choix de la langue (FR/EN), installation
; complète / minimale / personnalisée, assistant sombre aux couleurs de l'app.
; Génère ApexLauncher-Setup-x64.exe depuis release\win-unpacked (electron-builder --dir).
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
; Choix explicite de la langue (détection auto sans dialogue sinon).
ShowLanguageDialog=yes
UninstallDisplayName=Apex Launcher
VersionInfoVersion={#AppVersion}
VersionInfoCompany=ApexDevlabs
VersionInfoDescription=Installeur Apex Launcher — client Minecraft moderne
VersionInfoProductName=Apex Launcher
SetupIconFile=..\assets\icon.ico
WizardImageFile=..\assets\wizard.bmp
WizardSmallImageFile=..\assets\wizard-small.bmp
UninstallDisplayIcon={app}\Apex Launcher.exe
WizardStyle=modern
; Fenêtre d'arrière-plan sombre aux couleurs de l'app.
WindowVisible=yes
WindowShowCaption=no
BackColor=$0E0E12
BackColor2=$17171C
BackColorDirection=lefttoright
DisableWelcomePage=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
french.WelcomeLabel1=Bienvenue dans l'assistant Apex Launcher
french.WelcomeLabel2=Cet assistant va installer [name/ver] sur votre ordinateur.%n%nFermez de préférence les autres applications avant de continuer.
english.WelcomeLabel1=Welcome to the Apex Launcher Setup Wizard
english.WelcomeLabel2=This will install [name/ver] on your computer.%n%nPlease close all other applications before continuing.

[Types]
Name: "full"; Description: "{cm:TypeFull}"
Name: "minimal"; Description: "{cm:TypeMinimal}"
Name: "custom"; Description: "{cm:TypeCustom}"; Flags: iscustom

[Components]
Name: "core"; Description: "{cm:CompCore}"; Types: full minimal custom; Flags: fixed
Name: "shortcuts"; Description: "{cm:CompShortcuts}"; Types: full

[CustomMessages]
french.TypeFull=Installation complète (recommandée)
french.TypeMinimal=Installation minimale (application seule)
french.TypeCustom=Installation personnalisée
french.CompCore=Apex Launcher (fichiers requis)
french.CompShortcuts=Raccourcis (menu Démarrer et bureau)
french.LaunchNow=Lancer Apex Launcher maintenant
french.KeepData=Vos mondes, instances, sauvegardes et paramètres sont conservés.
english.TypeFull=Full installation (recommended)
english.TypeMinimal=Minimal installation (application only)
english.TypeCustom=Custom installation
english.CompCore=Apex Launcher (required files)
english.CompShortcuts=Shortcuts (Start Menu and Desktop)
english.LaunchNow=Launch Apex Launcher now
english.KeepData=Your worlds, instances, backups and settings are kept.

[Files]
; Fichiers réellement compilés de l'application.
; Si win-unpacked est absent, la compilation échoue explicitement (pas d'installateur vide).
Source: "..\release\win-unpacked\Apex Launcher.exe"; DestDir: "{app}"; Flags: ignoreversion; Components: core
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: core

[Icons]
Name: "{autoprograms}\Apex Launcher"; Filename: "{app}\Apex Launcher.exe"; Components: shortcuts
Name: "{autodesktop}\Apex Launcher"; Filename: "{app}\Apex Launcher.exe"; Components: shortcuts

[Run]
Filename: "{app}\Apex Launcher.exe"; Description: "{cm:LaunchNow}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Ne JAMAIS supprimer les données utilisateur (mondes, instances, sauvegardes, paramètres).
; Seuls les fichiers de l'installation sont retirés ; %APPDATA%\ApexLauncher est conservé.

[Code]
const
  DarkOuter = $0E0E12;
  DarkInner = $17171C;
  DarkText = $EEF1F8;
  DarkMuted = $9AA5BD;

procedure PaintLabel(Lbl: TObject; Color: Integer);
begin
  if Lbl is TLabel then
    TLabel(Lbl).Font.Color := Color;
  if Lbl is TNewStaticText then
    TNewStaticText(Lbl).Font.Color := Color;
end;

procedure StyleWizard();
begin
  WizardForm.Color := DarkOuter;
  { Panneau principal et pages : TPanel / contrôles standard, noms documentés. }
  try
    WizardForm.MainPanel.Color := DarkInner;
  except
  end;
  try
    WizardForm.InnerPage.Color := DarkInner;
  except
  end;
  PaintLabel(WizardForm.WelcomeLabel1, DarkText);
  PaintLabel(WizardForm.WelcomeLabel2, DarkMuted);
  PaintLabel(WizardForm.FinishedHeadingLabel, DarkText);
  PaintLabel(WizardForm.FinishedLabel, DarkMuted);
  PaintLabel(WizardForm.ReadyLabel, DarkMuted);
  PaintLabel(WizardForm.StatusLabel, DarkMuted);
  PaintLabel(WizardForm.DiskSpaceLabel, DarkMuted);
  PaintLabel(WizardForm.ComponentsDiskSpaceLabel, DarkMuted);
  PaintLabel(WizardForm.TypesCombo, DarkText);
end;

procedure InitializeWizard();
begin
  StyleWizard();
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  { Réapplique le style à chaque page (certaines recréent leurs contrôles). }
  StyleWizard();
end;

function InitializeSetup(): Boolean;
begin
  if not IsWin64 then
  begin
    MsgBox('Apex Launcher requires 64-bit Windows 10 or 11. / Apex Launcher nécessite Windows 10 ou 11 64 bits.', mbError, MB_OK);
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
