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

## Conectar Spotify

VYREX integra Spotify mediante OAuth con PKCE y el Web Playback SDK. El **Client ID** público ya está configurado en [`js/spotify.js`](js/spotify.js); no se incluye ni se necesita un Client Secret en esta web estática.

1. En tu aplicación de Spotify for Developers, conserva este Redirect URI exacto: `https://juanffx3-beep.github.io/VYREX` (sin `/` final).
2. Activa **Web API** y **Web Playback SDK**.
3. Inicia sesión en VYREX, abre **Cuenta** y selecciona **Conectar Spotify**.
4. Busca música desde **Buscar**. El catálogo se consulta directamente en Spotify y el audio nunca se copia o se aloja en VYREX.

La reproducción dentro del navegador depende de una cuenta de Spotify elegible para el [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk), normalmente Spotify Premium. El plan VIP de VYREX no cambia los requisitos ni la suscripción de Spotify.

## Publicación

VYREX está publicado en GitHub Pages desde la rama `main` y la carpeta raíz:

`https://juanffx3-beep.github.io/VYREX/`

## Créditos

Las pistas de audio son enlaces de demostración de SoundHelix. Las imágenes de portada se generan con Picsum Photos y solo se usan como contenido visual de demostración.
