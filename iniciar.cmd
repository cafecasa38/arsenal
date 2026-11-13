@echo off
rem Abre o ARSENAL em http://localhost:5179
rem A porta precisa ser sempre a mesma: o navegador guarda os dados por endereco.
cd /d "%~dp0"
start "" "http://localhost:5179/#/painel"
python -m http.server 5179 --bind 127.0.0.1
