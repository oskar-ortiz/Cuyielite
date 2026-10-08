#!/bin/sh
# Ejecutar una vez después de clonar: activa los hooks del repositorio.
git config core.hooksPath .githooks
chmod +x .githooks/pre-push
echo "Hooks activados. El push directo a main queda bloqueado."
