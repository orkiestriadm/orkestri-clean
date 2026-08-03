#!/bin/bash
ssh -o StrictHostKeyChecking=no planner@10.192.4.123 "cd /home/planner/orkestri && docker compose exec -T api sh -c \"psql \\\"\\\$DATABASE_URL\\\" -c \\\"DELETE FROM project_members WHERE project_id NOT IN (SELECT id FROM projects);\\\"\""

