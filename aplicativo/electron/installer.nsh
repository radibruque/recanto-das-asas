; Keep the stable installation identity and the encrypted user database on upgrades.
; We deliberately do not remove $APPDATA\RecantoDasAsas during uninstall.
!macro customInstall
  DetailPrint "Os registros privados ficam na pasta de dados do usuário. Preserve seus backups."
!macroend
