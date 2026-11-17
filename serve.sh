#!/usr/bin/env bash
# Serve Wikiponia on your local network so a phone on the same Wi-Fi can open it.
cd "$(dirname "$0")"
PORT="${1:-8000}"
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo "Wikiponia is open at:"
echo "  this computer: http://localhost:$PORT"
[ -n "$IP" ] && echo "  your phone:    http://$IP:$PORT   (same Wi-Fi)"
exec python3 tools/serve.py "$PORT"
