# VYREX

VYREX es una interfaz de streaming musical moderna, construida como una experiencia independiente inspirada en las apps de música. Incluye un reproductor funcional, biblioteca, buscador, cuentas locales y planes **Free** y **VIP**.

## Funciones

- Reproductor con reproducción, pausa, progreso, volumen, aleatorio, repetición y controles multimedia.
- Catálogo de demostración: canciones, artistas, playlists y búsqueda en tiempo real.
- Modo **Free**: anuncios simulados, límite de saltos y calidad normal.
- Modo **VIP**: sin anuncios, saltos ilimitados, descargas simuladas, calidad alta y playlists exclusivas.
- Registro/inicio de sesión por correo y contraseña, con credenciales locales protegidas mediante PBKDF2.
- Inicio con Google preparado para Firebase.
- Diseño responsive para escritorio y móvil.

## Ejecutar localmente

No requiere instalar paquetes. Sirve esta carpeta con cualquier servidor estático; por ejemplo:

```powershell
python -m http.server 8080
```

Después abre `http://localhost:8080`.

> No abras `index.html` directamente como `file://`, porque los módulos JavaScript y el login con Google requieren un servidor HTTP.

## Activar Google y autenticación real

El registro local funciona sin configuración. Para habilitar Google y autenticar contra Firebase:

1. Crea un proyecto en [Firebase](https://console.firebase.google.com/).
2. En **Authentication → Sign-in method**, habilita **Google** y **Correo electrónico/contraseña**.
3. En **Authentication → Settings → Authorized domains**, añade `juanffx3-beep.github.io`.
4. Copia la configuración de tu app web a [`js/firebase-config.js`](js/firebase-config.js).

## Publicación

Este repositorio está preparado para GitHub Pages. Tras habilitar Pages desde la rama `main` y la carpeta raíz, estará disponible en:

`https://juanffx3-beep.github.io/VYREX/`

## Catálogo de música

VYREX reproduce música real de dos fuentes:

- **Catálogo propio de demostración:** artistas y playlists de VYREX con pistas de muestra.
- **Catálogo abierto en línea:** búsqueda y tendencias de música de artistas independientes publicada con licencias abiertas, servida a través de la API pública de Audius y reproducida íntegramente con el reproductor de VYREX (sin cuentas externas ni marcas de terceros en la interfaz).
- **Videos y música de YouTube (opcional):** al configurar una clave de YouTube Data API v3 en [`js/youtube-config.js`](js/youtube-config.js), el buscador muestra resultados de YouTube y los reproduce con el reproductor embebido oficial de YouTube dentro de VYREX. VYREX no descarga ni re-aloja ese contenido.

Las reglas del plan Free (anuncios simulados, límite de saltos) y VIP se aplican a todo el catálogo.

## Créditos

Las pistas de demostración local son enlaces de SoundHelix. Las imágenes de portada de demostración se generan con Picsum Photos. El catálogo en línea y sus carátulas pertenecen a sus respectivos artistas, publicados en Audius con licencias abiertas.
