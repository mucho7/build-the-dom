-- CreateTable
CREATE TABLE "HistoricalRainout" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "forecastIssuedAt" TIMESTAMP(3) NOT NULL,
    "similarGames" INTEGER NOT NULL,
    "similarRainCancelledGames" INTEGER NOT NULL,
    "precipitationAmountBand" TEXT NOT NULL,
    "rainedBeforeGame" BOOLEAN NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalRainout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalRainout_gameId_key" ON "HistoricalRainout"("gameId");

-- CreateIndex
CREATE INDEX "HistoricalRainout_forecastIssuedAt_idx" ON "HistoricalRainout"("forecastIssuedAt");

-- AddForeignKey
ALTER TABLE "HistoricalRainout" ADD CONSTRAINT "HistoricalRainout_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
