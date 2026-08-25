!macro NSIS_HOOK_POSTINSTALL
  # Use PowerShell to assign the correct AppUserModelID to the created shortcuts
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$wshell = New-Object -ComObject WScript.Shell; $paths = @(\"$SMPROGRAMS\\CHECKPOINT.lnk\", \"$SMPROGRAMS\\CHECKPOINT\\CHECKPOINT.lnk\", \"$DESKTOP\\CHECKPOINT.lnk\"); foreach ($p in $paths) { if (Test-Path $p) { $shortcut = $wshell.CreateShortcut($p); $shortcut.Properties.System.AppUserModel.ID = \"com.checkpoint.app\"; $shortcut.Save() } }"'
!macroend
