LocAR GPS Router Info - v4

NOVEDADES
- Incluye router.glb dentro de public/models.
- Router aumentado: desiredSize = 22.
- Orientación inicial del router: Y = 90 grados.
- Etiqueta flotante sobre el router:
    ROUTER DE RED
    IP: 192.168.1.1
    Estado: ACTIVO
    24 puertos
    Infraestructura de red
- El estado ACTIVO se muestra en verde.
- La etiqueta usa Sprite y mira siempre hacia la cámara.
- Se mantiene iluminación para el modelo GLB.

VERCEL
Framework: Vite
Build command: npm run build
Output directory: dist

AJUSTES RÁPIDOS
Tamaño router:
  src/main.js -> const desiredSize = 22;

Altura etiqueta:
  sprite.position.set(0, 28, 0);

Tamaño etiqueta:
  sprite.scale.set(24, 14, 1);

Rotación router:
  model.rotation.y = THREE.MathUtils.degToRad(90);

Coordenada objetivo:
  lat -2.299114
  lon -78.118125
