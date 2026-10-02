#define MyAppName "My POS"
#define MyAppVersion "1.0.1"
#define MyAppExeName "my_pos.exe"
#define MyAppPublisher "My POS"
; ISCC is 32-bit, so System32 would redirect to SysWOW64 (32-bit DLLs);
; Sysnative reaches the real 64-bit System32.
#define SystemDir GetEnv("SystemRoot") + "\Sysnative"

[Setup]
AppId={{59B65A57-D509-45CC-9722-BC2084355A51}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=MyPOS-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\windows\runner\resources\app_icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Flutter apps need the MSVC runtime; ship it app-locally so the installer
; works on a fresh till PC without the Visual C++ Redistributable.
Source: "{#SystemDir}\msvcp140.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SystemDir}\vcruntime140.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SystemDir}\vcruntime140_1.dll"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
