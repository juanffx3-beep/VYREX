// Configuración de Firebase para el inicio de sesión con Google y correo/contraseña.
// 1. Crea un proyecto en https://console.firebase.google.com
// 2. Authentication > Sign-in method: activa "Google" y "Correo electrónico/contraseña"
// 3. Authentication > Settings > Authorized domains: agrega juanffx3-beep.github.io
// 4. Configuración del proyecto > Tus apps > Web: copia los valores aquí.
//
// Mientras apiKey esté vacío, VYREX usa cuentas locales guardadas en este navegador
// (solo correo/contraseña). Estos valores no son secretos: es normal que estén en el cliente.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};
