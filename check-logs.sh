#!/bin/bash
ssh -o StrictHostKeyChecking=no planner@10.192.4.123 "cd /home/planner/orkestri && docker compose logs --tail=100 api"

