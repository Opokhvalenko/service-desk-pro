-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "breachedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedTotalMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolveDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "firstResponseHours" INTEGER NOT NULL,
    "resolveHours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_priority_key" ON "sla_policies"("priority");

-- CreateIndex
CREATE INDEX "tickets_resolveDueAt_idx" ON "tickets"("resolveDueAt");

-- CreateIndex
CREATE INDEX "tickets_breachedAt_idx" ON "tickets"("breachedAt");
