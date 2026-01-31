FROM postgres:15

ENV POSTGRES_DB=createrington_db
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres

COPY ./schema/init-docker.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY ./data/test-data.sql /docker-entrypoint-initdb.d/02-test-data.sql
COPY ./pg_hba.conf /etc/postgresql/pg_hba.conf

CMD ["postgres", "-c", "hba_file=/etc/postgresql/pg_hba.conf"]

EXPOSE 5432