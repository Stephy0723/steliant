cd "$(dirname "$0")/src"
{
echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vitrina · Catálogo</title>'
echo '<meta name="description" content="Vitrina — catálogo con precios y stock en vivo, y panel del vendedor.">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">'
echo '<style>'; cat style.css; echo '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}::view-transition-new(root){z-index:9999}'; echo '</style></head><body>'
cat body.html
echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>'
echo '<script>'; cat data.js i18n.js app.js crm.js; echo '</script></body></html>'
} > ../index.html
