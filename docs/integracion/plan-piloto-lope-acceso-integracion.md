# Plan de cierre del piloto: acceso, integración y resultados

Actualización: 2026-11-15. Plan recomendado por Codex a partir de respuestas de Oskar y Diery. Los requisitos de uso están confirmados por Oskar; las soluciones técnicas y la nueva política de predicciones siguen siendo propuestas hasta su decisión explícita. Este documento no acredita implementación ni carga real.

## Estado de implementación al 2026-11-15

| Paso | Estado real | Evidencia / límite |
| --- | --- | --- |
| 1. Contrato de acceso | **Implementado en laboratorio** con ajustes admin/viewer, equipos compartidos y sesión por instalación | ADR 0007 y `acceso-piloto-integracion.md`; aprobación de Oskar/Diery pendiente |
| 2. Implementar acceso | **Implementado y verificado en Windows y Android** | Backend/cliente, 124 pruebas backend, 223 cliente, APK; flujo admin/viewer sobre Pixel_36 |
| 3. Integración de entregas | **ETL sintético integrado**; RF/RAG reales no disponibles | `test_promote` 9 passed; sin artefacto RF ni corpus autorizado |
| 4. Evaluación persistente | **Bloqueado por política de Diery** | `contrato-evaluacion-alertas-piloto.md`; no se cambiaron reglas ni DTO |
| 5. Lectura de alertas y UI | **Pendiente**, depende de 4 | No se muestran alertas como sincronizadas |
| 6. Ensayo integral y operación | **Parcial**: acceso verificado en Windows y Android; operación real pendiente | No hay VPS/TLS público ni carga real |

La tabla anterior es una fotografía histórica del 2026-11-15 y queda sustituida por el estado posterior a #145 que sigue. El acceso piloto, la evaluación persistente y la UI de alertas ya se fusionaron en `dev`; esto no significa aprobación para producción ni cierre del piloto.


## 0. Estado posterior a #145 (2026-11-16)

HECHO: acceso admin/viewer, evaluación oficial/provisional con evidencia revisable, feed derivado v3 de solo lectura, UI de ficha y evaluación, herramienta de alertas antiguas. PR #144 corrigió la aplicación del estado provisional; #145 actualizó el inventario y reconstruyó la app Windows, restaurando el perfil original. Windows y el ETL de manifiestos sintéticos están verificados.

PENDIENTE: recorrido Android (último ensayo bloqueado por mismatch de ámbito, falta de JDK 21 y memoria; el usuario `LabCuyi` solo debe limpiarse en una ventana segura), confirmar la fuente y modalidad del ETL de Diery, artefacto RF, corpus/configuración RAG y despliegue. No se autorizó cargar datos reales. Ver [cierre de integración en laboratorio](../verificaciones/cierre-integracion-laboratorio.md).

## 1. Base que se conserva

Conservar PostgreSQL central, SQLite de Trabajo, Demo separada, publicación D1, sincronización v1/v2, cursores independientes, outbox/inbox, referencias, recibos y resolución explícita de conflictos. Oskar confirmó los merges hasta #132; no se volvieron a auditar.

No reiniciar las fases D1–D7, sustituir el ETL de Diery, cambiar UUID por chapa, editar checksums históricos ni borrar bases para facilitar pruebas. Incorporar cambios mediante migraciones nuevas y contratos compatibles. La evidencia nativa de sincronización no acredita todavía integración del ETL, RF y RAG reales.

## 2. Uso confirmado y diseño recomendado

| Tema | Confirmado por Oskar | Consecuencia recomendada |
| --- | --- | --- |
| Ámbito | Un Centro Lope, ambos galpones; sin otros centros | Un ámbito de negocio. El UUID concreto se aprovisiona, no se inventa ni reutiliza desde un laboratorio |
| Administrador | Administra, registra, edita y consulta | Rol admin del Centro Lope; no implica administrador global de infraestructura |
| Usuario | Solo visualiza | Rol viewer, sin escritura de negocio, envío de outbox ni resolución de conflictos |
| Equipos | Mismo teléfono y computador compartidos | Cuentas personales recomendadas, una sesión activa por instalación; cambiar sesión no cambia dataset/device/scope |
| ETL | Automático, a cargo de Diery | Identidad técnica acotada y separada; Diery conserva orquestación y transacción, Oskar integra permisos/publicación |

La frase inicial sobre usuarios autorizados se interpreta según la aclaración repetida de Oskar: administrador con escritura y usuario con consulta. No se requiere un tercer rol operator para este piloto.

### Acceso sin perder trabajo

- Ajustar la [propuesta de autenticación](../decisiones/0007-autenticacion-piloto.md) antes de programar. FastAPI propio sigue propuesto; OIDC de producción y contratación de VPS no son requisitos para probar localmente.
- Separar la identidad de instalación del usuario autenticado. Conservar device_id para el mismo dataset autorizado; no convertir datos sintéticos en registros del piloto.
- Viewer puede descargar/consultar, pero una sincronización de consulta no debe enviar pendientes creados por un admin. Conservar esos pendientes y su autoría; reanudar envío solo con permisos válidos. No modificar cuerpos ya congelados ni recibos para cambiar de usuario.
- Recomendar login/cambio de cuenta con conexión en el primer alcance. Una sesión local previamente habilitada puede trabajar offline según su rol y una vigencia definida en el contrato; logout bloquea Trabajo y elimina credenciales de sesión, sin borrar la base ni outbox. Definir esa vigencia antes de implementar; no prometer revocación instantánea offline.
- Aplicar permisos en backend y operaciones locales/nativas, además de botones/rutas. El primer administrador se aprovisiona con un procedimiento explícito; no hay registro público ni credenciales compartidas por defecto.
- Precisar refresh rotatorio, concurrencia y recuperación ante pérdida de respuesta. Android Keystore protege claves para cifrar el secreto; Electron usa almacenamiento nativo compatible. Token de acceso solo en memoria. TLS para acceso fuera del laboratorio loopback.
- La identidad técnica ETL depende de su conexión real: no imponer un login humano o refresh de usuario al orquestador que trabaja con una conexión PostgreSQL prestada. Mantener permisos mínimos y ámbito autorizado.

Referencia de permisos: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), validación por operación y privilegios mínimos.

## 3. Diferencias que deben resolverse en el contrato de predicción

Inspección del checkout local, no del estado remoto de Diery:

- [Handoff ML](../../ml/handoff/PARA_OSKAR.md) y [funciones](../../ml/prediccion.py) devuelven NORMAL con REVISAR ante faltantes. El handoff exige destete a los 15 días **y empadre entre 900 y 1000 g** para confirmar ELITE.
- [DTO HTTP actual](../../backend/app/schemas/ml.py) exige una clase no nula. La propuesta nueva de DATOS_INSUFICIENTES sin clase cambia ese contrato; no basta cambiar una etiqueta en pantalla.
- [Publicación D1](../../backend/app/services/publication.py) incluye categoria_ml en el snapshot de cuyes. El cliente la trata como derivada del servidor; debe continuar así.
- El checkout contiene migraciones centrales 0001–0004; 0005 no está en este checkout. Su existencia remota no fue verificada en esta tarea. No recrearla ni reservar otra numeración por suposición.
- El [orquestador](../../tools/lope_import/promote.py) existe y expone promote_batch con publicador D1 y dry_run. Su presencia no acredita todavía el recorrido integrado ni disponibilidad del mapeador completo.

Diery debe actualizar su handoff, reglas y ejemplos para precisar si destete es condición necesaria o suficiente, y si el empadre sigue requerido. Oskar adapta API/UI y persistencia a esa misma versión. No inventar umbrales, infertilidad ni causas de descarte desde la plataforma.

Recomendar un contrato versionado de evaluación: estado de evaluación, clase nullable, campos faltantes, motivos, etapa, versión de reglas y apoyo_modelo separado. Elegir el mecanismo de compatibilidad antes de cambiar las rutas existentes; conservar clientes anteriores hasta una actualización coordinada. Un resultado exploratorio del RF al nacimiento no equivale a una clasificación definitiva.

## 4. Política de persistencia recomendada, aún no implementada

| Situación | Comportamiento propuesto |
| --- | --- |
| Clase definitiva válida | Persistir solo clase de reglas; cambio efectivo de categoria_ml mediante publicar_cambios, en la transacción exterior |
| Misma clase | No aumentar versión del animal por el mismo valor. Evaluar de todas formas cambios de causas/alertas |
| Datos insuficientes | No asignar NORMAL ni crear alerta. Conservar una clase anterior solo como histórica, indicando que la evaluación actual no la confirma |
| NO_APLICA | No convertirlo en NORMAL; no generar recomendación automática. Diferenciar falta de datos de sexo/etapa no aplicable |
| Corrección que invalida una causa | Cerrar como obsoleta la alerta correspondiente, conservando trazabilidad |
| Faltantes al reevaluar | No cerrar una alerta previa como si se hubiera demostrado falsa; indicar falta de evaluación actual |
| RF | Apoyo separado, nunca escribe categoria_ml ni altera la decisión de reglas |

La persistencia debe calcularse con datos centrales autorizados y procedencia/versiones verificadas. Los campos editables de una consulta exploratoria HTTP no autorizan sobreescribir la clasificación oficial. Impedir que una evaluación antigua sobrescriba una corrección reciente; registrar versión de reglas e identidad de los datos evaluados.

Alertas propuestas: tipo DESCARTE_REPRODUCTORA; identidad estable por ámbito + animal + tipo + regla + evento causal. Definir regla/episodio también cuando falte un evento identificable; no deducirlo de texto libre. Garantizar unicidad de alerta activa en base y concurrencia, sin depender solo de una consulta previa. Los reintentos exactos no deben duplicar alertas ni generar publicaciones sin cambio semántico.

Categoría, alerta e historial de publicación se confirman o revierten juntos cuando corresponden a una evaluación. La fecha técnica de última evaluación no debe producir versiones del animal en cada reintento. Conservar motivos y procedencia requiere diseñar almacenamiento explícito, pues el esquema actual de alertas no contiene toda esa información.

El criterio del cuarto parto, problema repetido y fecha de parto +20 días se registra como propuesta de dominio de Diery; requiere ejemplos y regla concreta de su entrega. No se inventa fecha si falta la del parto ni se convierte DESCARTE recomendado en descarte ejecutado.

**Alertas no forman parte de las entidades sincronizables actuales.** Antes de mostrarlas tras sync, definir DTO, ámbito/versiones, migraciones central/local, descarga y compatibilidad de clientes/cursores. Proponerlas de solo lectura en el cliente inicialmente; no añadir escritura o atención de alertas sin un flujo acordado. Una clase sincronizada no transporta automáticamente sus motivos ni sus alertas.

## 5. Orden de trabajo y aceptación

| Paso | Responsable y trabajo | Termina cuando |
| --- | --- | --- |
| 1. Contrato de acceso | Oskar: ajustar ADR al uso confirmado, permisos offline, cambio de cuenta, identidad de instalación y ETL técnico | Matriz admin/viewer y transición laboratorio/piloto concretas, diseño decidido sin cuentas/servicios reales aún |
| 2. Implementar acceso | Oskar: migraciones nuevas, backend, sesión nativa y UI integrada | Admin escribe; viewer no escribe ni envía pendientes ajenos; cambio de cuenta/logout/reapertura conservan datos, recibos y cursores; rechazo por API y capa local |
| 3. Integración de entregas | Diery entrega componentes/artefactos/corpus; Oskar conecta y verifica. Los ensayos aislados pueden avanzar antes del paso 2 | ETL real con lote sintético: dry-run sin cambios, rollback, conteos y replay; RF real identificado y opcional; RAG real con fuentes y abstención/fallback; segunda corrida de migraciones no-op |
| 4. Evaluación persistente | Diery alinea reglas/handoff; Oskar implementa contrato compatible, datos centrales, categorías, alertas y publicación | Faltantes sin NORMAL artificial; evaluación vieja rechazada; clase igual sin versión inútil; alertas concurrentes/reintentos sin duplicación y cierre por corrección |
| 5. Lectura de alertas y UI | Oskar: extensión de descarga/local y ficha existente | Motivos/calidad y apoyo RF separados; alertas visibles offline tras sync; clientes antiguos no pierden registros; decisión recomendada no ejecuta descarte |
| 6. Ensayo integral y operación | Ambos: acceso → carga → sync → evaluación → alertas → reapertura; respaldos/restauración y guía local | Evidencia Windows/Android secuencial y prueba de recuperación; carga real solo en entorno autorizado con respaldo y revisión de conteos |

Diery puede preparar en paralelo reglas versionadas, manifiestos, artefacto RF y corpus mientras Oskar implementa acceso. No esperar todos los recursos para probar contratos sintéticos; no llamar integración real a pruebas con dobles.

RAG: probar pipeline real con corpus autorizado, documento/página, abstención fuera del corpus y fallback extractivo cuando Ollama esté apagado. Falta de base/embeddings no equivale a Ollama apagado; no inventar fuentes. RF: registrar versión/hash del artefacto y resultado real; ausencia permitida con apoyo_modelo=null, sin declarar RF verificado.

## 6. Instrucciones para Codex/OpenCode al continuar

1. Leer este plan, ADR de acceso y handoff actualizado. Preparar una sola vez la base de trabajo desde dev; respetar cambios locales. No repetir auditorías de PRs que Oskar confirmó fusionados.
2. Completar el paso elegido con código, pruebas relevantes y evidencia; corregir fallos demostrados. No ampliar el rol de Oskar a limpiar Excel, reentrenar RF o reimplementar RAG.
3. Usar laboratorio y datos sintéticos primero. No autoriza carga real, despliegue público ni gasto. No incluir secretos, artefactos de modelo, corpus privado o datos reales en Git.
4. Verificar builds y suites secuencialmente antes del emulador por memoria limitada. Proteger Pixel_36 y perfiles reales. Registrar límites, sin arreglar cursores manualmente para acreditar compatibilidad.
5. Ramas profesionales; commits revisables con pruebas/evidencia; PR hacia dev. Si se apilan, preparar integración final explícita hacia dev. OpenCode publica cuando el encargo lo autorice; Oskar revisa y fusiona.

**Primer corte recomendado:** actualizar y decidir el contrato de acceso del paso 1; después implementar paso 2. En paralelo enviar a Diery las diferencias concretas de la sección 3. El presente cambio es documental, sin implementación, commit, push ni PR nuevos.
