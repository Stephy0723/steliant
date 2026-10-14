#!/usr/bin/env bash
# Genera sl-abogados/index.html (un solo archivo) a partir de src/
cd "$(dirname "$0")/src"
{
echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
echo '<title>SL Abogados</title><meta name="description" content="Salvador López de la Rosa · Abogados y consultoría jurídica en República Dominicana">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap">'
echo '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}'; cat style.css; echo '</style></head><body>'
cat shell.html
echo '<script>'; cat data.js; echo '(function(){'; cat app.js ext.js crm.js boot.js; echo '})();'; echo '</script></body></html>'
} > ../index.html
