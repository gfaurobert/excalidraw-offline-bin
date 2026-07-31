#!/bin/sh
# Deno Desktop resolves payload.tar.xz next to argv[0]; a /usr/bin symlink breaks that.
exec /usr/lib/excalidraw-offline/excalidraw-offline "$@"
