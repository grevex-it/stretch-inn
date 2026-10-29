# Módulo asistencia

Nivel: completo (dominio / aplicacion / infraestructura / http).
Ver docs/decisiones/0003-hexagonal-por-niveles.md.

## Alcance

Registra la asistencia a cada ocurrencia de clase, las ausencias avisadas, los
créditos de recuperación que generan y las reservas de recuperación.

## Fuera de alcance

- Horarios, clases y cupos: `agenda`.
- Si el alumno tiene el abono al día: `abonos` (se consulta por su index.ts).
- Avisos por WhatsApp: `mensajeria`, que escucha los eventos de este módulo.

## Depende de

- `@app/nucleo`, `@app/plataforma`
- `@app/agenda` (ocurrencias y cupo)
- `@app/abonos` (estado del abono)

## API pública (index.ts)

_Casos de uso exportados y sus tipos._

## Eventos

- Emite: `AusenciaAvisada`, `RecuperacionReservada`, `AsistenciaRegistrada`.
- Escucha: _ninguno por ahora_.

## Invariantes

- El cupo libre de una ocurrencia nunca es negativo.
- Un crédito se usa una sola vez y no se usa vencido.
- Una asistencia puede venir de distintos orígenes (manual, huella, cámara); el
  dominio no depende del origen.

## Glosario

- **Ocurrencia:** una fecha concreta de una clase semanal.
- **Crédito:** derecho a recuperar, generado por una ausencia avisada a tiempo.

## Configuración por centro

- `recuperarEnOtraSede` (por defecto: no).
- _Anticipación mínima del aviso y vigencia del crédito: a definir con el cliente._

## Pendientes

- _Reglas de recuperación de Stretch Inn._
