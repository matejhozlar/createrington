#!/bin/bash
# Kill all processes on ports 3000-3005 and 5000-5005

PORTS=(3000 3001 3002 3003 3004 3005 5000 5001 5002 5003 5004 5005)
KILLED=0

for PORT in "${PORTS[@]}"; do
  PIDS=$(netstat -ano 2>/dev/null | grep ":${PORT} " | grep LISTENING | awk '{print $5}' | sort -u)
  for PID in $PIDS; do
    if [ -n "$PID" ] && [ "$PID" != "0" ]; then
      taskkill //PID "$PID" //F > /dev/null 2>&1
      if [ $? -eq 0 ]; then
        echo "Killed PID $PID on port $PORT"
        KILLED=$((KILLED + 1))
      fi
    fi
  done
done

if [ "$KILLED" -eq 0 ]; then
  echo "No processes found on ports 3000-3005, 5000-5005"
else
  echo "Killed $KILLED process(es)"
fi
