-- One database and one user per service. Each user owns only its own database,
-- and CONNECT is revoked from everyone else, so a service cannot even open another's database.
CREATE USER auth_user    WITH PASSWORD 'dev_auth_pw';
CREATE USER catalog_user WITH PASSWORD 'dev_catalog_pw';
CREATE USER order_user   WITH PASSWORD 'dev_order_pw';
CREATE USER payment_user WITH PASSWORD 'dev_payment_pw';

CREATE DATABASE authdb    OWNER auth_user;
CREATE DATABASE catalogdb OWNER catalog_user;
CREATE DATABASE orderdb   OWNER order_user;
CREATE DATABASE paymentdb OWNER payment_user;

REVOKE CONNECT ON DATABASE authdb    FROM PUBLIC;
REVOKE CONNECT ON DATABASE catalogdb FROM PUBLIC;
REVOKE CONNECT ON DATABASE orderdb   FROM PUBLIC;
REVOKE CONNECT ON DATABASE paymentdb FROM PUBLIC;
