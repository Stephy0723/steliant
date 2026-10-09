cd "$(dirname "$0")/src"
{
echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Steliant · Portafolio</title>'
echo '<meta name="description" content="Steliant — webs, tiendas, reservas, CRMs y bots para negocios en República Dominicana.">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
echo '<style>'; cat style.css; echo '</style></head><body>'
cat body.html
echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>'
echo '<script>'; cat data.js i18n.js app.js; echo '</script></body></html>'
} > ../index.html
