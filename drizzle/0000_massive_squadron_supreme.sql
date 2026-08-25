-- gen_random_uuid() is native since PG13; the extension is declared
-- explicitly for portability to older hosts (REQ-CLIENTE-05).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"telefono" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_email_unique" UNIQUE("email")
);
