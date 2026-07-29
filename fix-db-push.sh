#!/bin/bash
ssh -o StrictHostKeyChecking=no planner@10.192.4.123 "cd /home/planner/orkestri && docker compose exec -T api npx prisma db push --accept-data-loss"

