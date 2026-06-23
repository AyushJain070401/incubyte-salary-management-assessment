-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employee_code" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "country" CHAR(2) NOT NULL,
    "department" VARCHAR(120) NOT NULL,
    "role" VARCHAR(120) NOT NULL,
    "level" VARCHAR(120) NOT NULL,
    "hire_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "gender" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salaries" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "reason" VARCHAR(500),
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "as_of" DATE NOT NULL,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("base_currency","quote_currency","as_of")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_country_idx" ON "employees"("country");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "salaries_employee_history_idx" ON "salaries"("employee_id", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "fx_rates_latest_idx" ON "fx_rates"("base_currency", "quote_currency", "as_of" DESC);

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce the invariant "at most one current salary row per employee".
-- Prisma's schema language can't express a partial unique constraint, so
-- it's defined here in raw SQL. Without this, two concurrent give-raise
-- requests could each insert a row with effective_to = NULL and leave
-- the employee with two "current" salaries.
CREATE UNIQUE INDEX "salaries_current_uniq" ON "salaries" ("employee_id") WHERE "effective_to" IS NULL;
