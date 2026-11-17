import { isMlHttpError } from './ml.transport.js';

export function predictionErrorMessage(error: unknown): string {
  if (isMlHttpError(error)) {
    if (error.status === 404) {
      return 'El animal no existe en el servidor central. Si lo creaste o editaste solo localmente, todavía no se publicó: el envío de animales sigue pendiente.';
    }
    if (error.status === 401) return 'Token ausente o inválido. La consulta no se ejecutó.';
    if (error.status === 422) return 'El servidor no puede evaluar este animal con los datos actuales.';
    if (error.status === 503) return 'El servicio de predicción no está disponible en este momento.';
  }
  return 'No se pudo contactar al servidor. Revisa la conexión y vuelve a intentarlo.';
}

export function assistantErrorMessage(error: unknown): string {
  if (isMlHttpError(error)) {
    if (error.status === 401) return 'Token ausente o inválido. La pregunta no se envió.';
    if (error.status === 503) return 'El asistente no está disponible en este momento.';
    if (error.status === 422) return 'La pregunta no cumple el formato permitido.';
  }
  return 'No se pudo contactar al asistente. Revisa la conexión y vuelve a intentarlo.';
}
