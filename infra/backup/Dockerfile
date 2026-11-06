# Image de sauvegarde de la base : pg_dump avec le script de rotation.
# Le script est copié dans l'image (Coolify ne monte pas les fichiers du dépôt).
FROM pgvector/pgvector:pg17
COPY infra/backup.sh /backup.sh
ENTRYPOINT ["/bin/bash", "/backup.sh"]
