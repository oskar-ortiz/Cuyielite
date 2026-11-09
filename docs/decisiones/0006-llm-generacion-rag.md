# ADR 0006: Generación local de respuestas RAG

- Estado: PROPUESTA aprobada por ambos 
- Fecha: 2026-11-08

## Contexto

La recuperación semántica ya entrega fragmentos del manual SENA con metadatos de
documento y página. El sistema requiere responder en lenguaje natural sin enviar
el corpus interno a proveedores externos.

## Decisión

- Mantener `LLM_PROVIDER=none` por defecto. Cuando se habilita generación, usar
  Ollama local mediante `POST /api/chat`, con `stream=false`.
- Modelo previsto: `qwen2.5:7b-instruct`, configurable mediante
  `OLLAMA_MODEL`. Ollama corre en la máquina del usuario y el corpus y sus
  fragmentos no se envían a una API externa.
- No usar APIs externas de generación: el corpus es de uso interno y no se
  autoriza su transferencia a terceros.
- Mantener una ruta extractiva ante proveedor desactivado, servicio caído,
  timeout o error de respuesta. Si recuperación no supera el umbral vigente, se
  abstiene antes de contactar al LLM.
- El código asigna índices a los fragmentos y resuelve las citas contra sus
  metadatos. Referencias a índices inexistentes se eliminan.

## Alternativas consideradas

- APIs externas: descartadas por privacidad del corpus y por el requisito de
  procesamiento local.
- Sin LLM (solo extractivo): se conserva como valor predeterminado y respaldo,
  pero no ofrece síntesis de varios fragmentos.

## Límites y consecuencias

- Un modelo de 7B puede requerir varios GB de RAM; consumo y latencia dependen
  de cuantización, hardware y carga. La configuración permite cambiar el modelo
  y timeout sin alterar la recuperación.
- La generación puede ser lenta en CPU. Un timeout de 60 segundos limita la
  espera por solicitud.
- La salida del modelo no se considera fuente de verdad: las citas válidas se
  construyen desde metadatos recuperados y el prompt restringe respuestas al
  contexto, pero la revisión humana sigue siendo necesaria.
- El informe de generación registra modo, tiempo y respuesta abreviada; la
  calificación manual queda vacía para revisión de Diery.
