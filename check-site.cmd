@echo off
rem Double-click to serve the site locally and open the Site Readiness tool.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" %*
