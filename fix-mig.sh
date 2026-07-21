docker exec orkestri_postgres psql -U orkestri -d orkestri -c "UPDATE _prisma_migrations SET finished_at = NOW() WHERE migration_name = '20260721000000_reserva_veiculo';"
