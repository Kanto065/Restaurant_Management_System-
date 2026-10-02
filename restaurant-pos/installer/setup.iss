#define MyAppName "Restaurant POS"
#define MyAppVersion "2.0.0"
#define MyAppExeName "my_pos.exe"
#define MyAppPublisher "Restaurant POS"
; ISCC is 32-bit, so System32 would redirect to SysWOW64 (32-bit DLLs);
; Sysnative reaches the real 64-bit System32.
#define SystemDir GetEnv("SystemRoot") + "\Sysnative"

[Setup]
; Same AppId as the old "My POS" installer, so 2.0 upgrades it in place (same folder).
AppId={{59B65A57-D509-45CC-9722-BC2084355A51}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=RestaurantPOS-Setup-{#MyAppVersion}
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
; Waiter tablets reach the main till on TCP 8787 (lib/hub/lan_server.dart). Private and domain
; networks only, never a public network profile. Delete first so a reinstall doesn't stack rules.
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Restaurant POS tablets"""; Flags: runhidden waituntilterminated
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Restaurant POS tablets"" dir=in action=allow protocol=TCP localport=8787 profile=private,domain program=""{app}\{#MyAppExeName}"""; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Restaurant POS tablets"""; Flags: runhidden; RunOnceId: "RemoveFirewallRule"
