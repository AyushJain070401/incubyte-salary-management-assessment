-- CreateTable
CREATE TABLE "employee_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "field" VARCHAR(60) NOT NULL,
    "old_value" VARCHAR(500),
    "new_value" VARCHAR(500),
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500),

    CONSTRAINT "employee_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_changes_history_idx" ON "employee_changes"("employee_id", "changed_at" DESC);

-- AddForeignKey
ALTER TABLE "employee_changes" ADD CONSTRAINT "employee_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
