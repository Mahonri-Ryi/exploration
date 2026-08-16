#pragma once

#include "CoreMinimal.h"
#include "Catalog.h"

struct FCityTile
{
	int32 X = 0;
	int32 Y = 0;
	bool bWater = false;
	bool bRoad = false;
	bool bPowered = false;
	bool bWatered = false;
	FName BuildingId;
	int32 Residents = 0;
	int32 Workers = 0;
};

struct FCityStats
{
	int32 Money = 75000;
	int32 Population = 0;
	int32 Jobs = 0;
	int32 PowerSupply = 0;
	int32 PowerDemand = 0;
	int32 WaterSupply = 0;
	int32 WaterDemand = 0;
	int32 Income = 0;
	int32 Expenses = 0;
	FString Era = TEXT("Hamlet");
};

class FCitySim
{
public:
	explicit FCitySim(int32 InSize = 40);

	int32 Size = 40;
	FString Name = TEXT("Aetheris");
	int32 Money = 75000;
	float TaxRate = 0.09f;
	int32 TickCount = 0;
	TArray<FCityTile> Tiles;

	FCityTile* Get(int32 X, int32 Y);
	const FCityTile* Get(int32 X, int32 Y) const;
	bool CanPlace(FName Id, int32 X, int32 Y, FString& Reason) const;
	bool Place(FName Id, int32 X, int32 Y);
	bool Demolish(int32 X, int32 Y, int32& Refund);
	void Tick();
	FCityStats Stats() const;
	int32 Population() const;
	void FloodUtilities();

private:
	bool HasRoadAccess(int32 X, int32 Y) const;
	bool Operating(const FCityTile& Tile, const FBuildingDef& Def) const;
	void Neighbors4(int32 X, int32 Y, TArray<FCityTile*>& Out);
	void Neighbors4Const(int32 X, int32 Y, TArray<const FCityTile*>& Out) const;
};
