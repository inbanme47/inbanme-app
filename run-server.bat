@echo off
title Server In Ban Me
cd /d "%~dp0"

if exist "server.js" (
    node server.js
) else if exist "backend\server.js" (
    cd backend
    node server.js
) else (
    echo [LOI] Khong tim thay file server.js!
    echo Vui long kiem tra lai vi tri dat file.
)

pause