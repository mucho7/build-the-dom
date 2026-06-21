-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'PLAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('RAIN', 'GROUND_CONDITION', 'FINE_DUST', 'OTHER');

-- CreateEnum
CREATE TYPE "WeatherSnapshotKind" AS ENUM ('FORECAST', 'OBSERVED');

-- CreateTable
CREATE TABLE "Stadium" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isDome" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stadium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "kboGameId" TEXT NOT NULL,
    "gameDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "stadiumId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL,
    "sourceText" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cancellation" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "reason" "CancellationReason" NOT NULL,
    "sourceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cancellation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "kind" "WeatherSnapshotKind" NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "forecastFor" TIMESTAMP(3) NOT NULL,
    "precipitationProbability" INTEGER,
    "precipitationAmountMm" DOUBLE PRECISION,
    "precipitationType" TEXT,
    "humidity" INTEGER,
    "temperature" DOUBLE PRECISION,
    "rainedBeforeGame" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "targetMonth" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stadium_name_key" ON "Stadium"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Game_kboGameId_key" ON "Game"("kboGameId");

-- CreateIndex
CREATE INDEX "Game_stadiumId_gameDate_idx" ON "Game"("stadiumId", "gameDate");

-- CreateIndex
CREATE INDEX "Game_status_gameDate_idx" ON "Game"("status", "gameDate");

-- CreateIndex
CREATE UNIQUE INDEX "Cancellation_gameId_key" ON "Cancellation"("gameId");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_gameId_issuedAt_idx" ON "WeatherSnapshot"("gameId", "issuedAt");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_forecastFor_idx" ON "WeatherSnapshot"("forecastFor");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherSnapshot_gameId_kind_forecastFor_issuedAt_key" ON "WeatherSnapshot"("gameId", "kind", "forecastFor", "issuedAt");

-- CreateIndex
CREATE INDEX "SyncRun_source_startedAt_idx" ON "SyncRun"("source", "startedAt");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_stadiumId_fkey" FOREIGN KEY ("stadiumId") REFERENCES "Stadium"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
