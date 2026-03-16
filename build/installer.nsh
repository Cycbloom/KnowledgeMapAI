!macro customHeader
  !system "echo 'Custom NSIS Header'"
!macroend

!macro customInstall
  ; Create custom registry entries
  WriteRegStr HKLM "Software\KnowledgeMap" "InstallPath" "$INSTDIR"
!macroend

!macro customUnInstall
  ; Remove custom registry entries
  DeleteRegKey HKLM "Software\KnowledgeMap"
!macroend
