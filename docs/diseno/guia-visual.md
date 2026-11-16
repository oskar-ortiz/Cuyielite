# Guía visual de CuyiElite

## Dirección

- Azul institucional como color principal; fondos neutros y superficies claras.
- Verde, ámbar y rojo solo para estados semánticos, siempre con texto.
- Tipografía de sistema, disponible sin conexión.
- Radios discretos, sombras suaves y espaciado uniforme.
- Modo oscuro mediante `.ion-palette-dark`, con tokens propios por tema.

## Tokens

Definidos en `client/src/theme/variables.css` y patrones en `client/src/theme/app.css`:

- Color: `--ion-color-primary`, `--ion-color-success`, `--ion-color-warning`, `--ion-color-danger`, `--ion-color-medium`.
- Superficie: `--app-surface`, `--app-surface-subtle`, `--app-border`, `--app-text`, `--app-text-muted`.
- Espaciado: `--app-space-1` a `--app-space-10`.
- Radios: `--app-radius-sm`, `--app-radius-md`, `--app-radius-lg`.
- Anchos: `--app-content-width` (1200px), `--app-form-width` (760px).

## Componentes compartidos

`client/src/components/AppUi.tsx`:

- `PageFrame`: contenedor centrado y responsivo.
- `PageIntro`: encabezado de página con título, descripción y acciones.
- `SectionCard`: sección agrupada con título y cuerpo.
- `StatusChip`: estado con color y texto.
- `PageState`: carga, vacío, error o sin conexión.
- `InlineNotice`: aviso contextual.
- `FormActions`: acciones de formulario con bloqueo de doble envío.

## Estados

- Carga: spinner y texto.
- Vacío: mensaje y acción principal cuando aplica.
- Error: detalle legible, sin rutas internas.
- Sin conexión: chip y aviso.
- Pendiente/conflicto: chips con conteo.
- Evaluación: chips de clase y estado, nunca solo color.

## Accesibilidad

- Controles principales con mínimo 48 × 48 CSS px.
- Etiquetas persistentes en formularios.
- Errores junto al campo.
- Foco visible y orden de tabulación.
- `aria-live` para sincronización y estados.
- Reducción de movimiento respetada.

## Límites

- RF, RAG y ETL reales no están disponibles.
- No se simulan resultados de negocio en la UI.