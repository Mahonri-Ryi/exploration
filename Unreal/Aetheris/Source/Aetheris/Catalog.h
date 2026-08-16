#pragma once

#include "CoreMinimal.h"

struct FBuildingDef
{
	FName Id;
	FString Name;
	int32 Cost = 0;
	int32 Upkeep = 0;
	int32 Residents = 0;
	int32 Jobs = 0;
	int32 PowerUse = 0;
	int32 WaterUse = 0;
	int32 PowerGen = 0;
	int32 WaterGen = 0;
	int32 UnlockPop = 0;
	float Height = 200.f;
	FLinearColor Color = FLinearColor::White;
	bool bRoad = false;
	bool bWaterfront = false;
	bool bUnique = false;
};

namespace AetherisCatalog
{
	const TArray<FBuildingDef>& All();
	const FBuildingDef* Find(FName Id);
	bool IsWaterTile(int32 X, int32 Y, int32 Size);
}
