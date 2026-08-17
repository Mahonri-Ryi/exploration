#include "Catalog.h"

namespace
{
	FBuildingDef Def(
		const TCHAR* Id, const TCHAR* Name, int32 Cost, int32 Upkeep, int32 Residents, int32 Jobs,
		int32 PowerUse, int32 WaterUse, int32 PowerGen, int32 WaterGen, int32 Unlock, float Height,
		FLinearColor Color, const TCHAR* Category, int32 Hotkey,
		bool bRoad = false, bool bWaterfront = false, bool bUnique = false)
	{
		FBuildingDef D;
		D.Id = Id;
		D.Name = Name;
		D.Cost = Cost;
		D.Upkeep = Upkeep;
		D.Residents = Residents;
		D.Jobs = Jobs;
		D.PowerUse = PowerUse;
		D.WaterUse = WaterUse;
		D.PowerGen = PowerGen;
		D.WaterGen = WaterGen;
		D.UnlockPop = Unlock;
		D.Height = Height;
		D.Color = Color;
		D.Category = Category;
		D.Hotkey = Hotkey;
		D.bRoad = bRoad;
		D.bWaterfront = bWaterfront;
		D.bUnique = bUnique;
		return D;
	}

	TArray<FBuildingDef> MakeCatalog()
	{
		TArray<FBuildingDef> Out;
		Out.Add(Def(TEXT("road"), TEXT("Avenue"), 25, 1, 0, 0, 0, 0, 0, 0, 0, 20.f, FLinearColor(0.08f, 0.09f, 0.1f), TEXT("roads"), 1, true));
		Out.Add(Def(TEXT("cottage"), TEXT("Cottage"), 220, 4, 8, 0, 2, 2, 0, 0, 0, 280.f, FLinearColor(0.72f, 0.58f, 0.38f), TEXT("homes"), 2));
		Out.Add(Def(TEXT("villa"), TEXT("Villa"), 900, 12, 18, 0, 4, 4, 0, 0, 40, 380.f, FLinearColor(0.82f, 0.72f, 0.55f), TEXT("homes"), 0));
		Out.Add(Def(TEXT("apartments"), TEXT("Apartments"), 2800, 28, 60, 0, 10, 10, 0, 0, 120, 1100.f, FLinearColor(0.45f, 0.35f, 0.24f), TEXT("homes"), 0));
		Out.Add(Def(TEXT("tower"), TEXT("Tower"), 9000, 70, 140, 0, 22, 22, 0, 0, 220, 2200.f, FLinearColor(0.55f, 0.62f, 0.68f), TEXT("homes"), 0));
		Out.Add(Def(TEXT("shop"), TEXT("Boutique"), 480, 8, 0, 6, 3, 2, 0, 0, 0, 260.f, FLinearColor(0.7f, 0.28f, 0.22f), TEXT("shops"), 5));
		Out.Add(Def(TEXT("inn"), TEXT("Hearth Inn"), 1600, 18, 0, 10, 5, 4, 0, 0, 25, 340.f, FLinearColor(0.62f, 0.32f, 0.2f), TEXT("shops"), 0));
		Out.Add(Def(TEXT("workshop"), TEXT("Workshop"), 900, 14, 0, 10, 6, 3, 0, 0, 0, 300.f, FLinearColor(0.35f, 0.3f, 0.26f), TEXT("works"), 7));
		Out.Add(Def(TEXT("park"), TEXT("Park"), 350, 3, 0, 0, 0, 1, 0, 0, 0, 40.f, FLinearColor(0.18f, 0.42f, 0.16f), TEXT("parks"), 6));
		Out.Add(Def(TEXT("mill"), TEXT("Windmill"), 1600, 12, 0, 4, 0, 0, 48, 0, 0, 900.f, FLinearColor(0.78f, 0.74f, 0.66f), TEXT("grid"), 3));
		Out.Add(Def(TEXT("power"), TEXT("Power Plant"), 4500, 55, 0, 12, 0, 4, 160, 0, 0, 860.f, FLinearColor(0.15f, 0.38f, 0.36f), TEXT("grid"), 0));
		Out.Add(Def(TEXT("water"), TEXT("Water Tower"), 2800, 30, 0, 6, 4, 0, 0, 140, 0, 1100.f, FLinearColor(0.2f, 0.38f, 0.48f), TEXT("grid"), 4));
		Out.Add(Def(TEXT("dock"), TEXT("River Dock"), 1200, 10, 0, 8, 2, 1, 0, 0, 0, 80.f, FLinearColor(0.42f, 0.28f, 0.16f), TEXT("shops"), 0, false, true));
		Out.Add(Def(TEXT("fire"), TEXT("Fire Hall"), 3200, 40, 0, 8, 4, 4, 0, 0, 20, 420.f, FLinearColor(0.72f, 0.18f, 0.12f), TEXT("civic"), 0));
		Out.Add(Def(TEXT("cityhall"), TEXT("City Hall"), 8000, 60, 0, 16, 8, 8, 0, 0, 80, 700.f, FLinearColor(0.78f, 0.72f, 0.58f), TEXT("wonders"), 0, false, false, true));
		Out.Add(Def(TEXT("beacon"), TEXT("Beacon"), 6500, 28, 0, 4, 6, 2, 12, 0, 60, 1400.f, FLinearColor(0.2f, 0.72f, 0.7f), TEXT("wonders"), 0, false, false, true));
		Out.Add(Def(TEXT("observatory"), TEXT("Observatory"), 9000, 40, 0, 6, 8, 4, 0, 0, 100, 900.f, FLinearColor(0.55f, 0.5f, 0.72f), TEXT("wonders"), 0, false, false, true));
		return Out;
	}
}

const TArray<FBuildingDef>& AetherisCatalog::All()
{
	static const TArray<FBuildingDef> Catalog = MakeCatalog();
	return Catalog;
}

const FBuildingDef* AetherisCatalog::Find(FName Id)
{
	for (const FBuildingDef& Item : All())
	{
		if (Item.Id == Id) return &Item;
	}
	return nullptr;
}

const TArray<FToolCategory>& AetherisCatalog::Categories()
{
	static TArray<FToolCategory> Cats;
	if (!Cats.Num())
	{
		auto Add = [](const TCHAR* Id, const TCHAR* Label, const TArray<FName>& Tools)
		{
			FToolCategory C;
			C.Id = Id;
			C.Label = Label;
			C.Tools = Tools;
			Cats.Add(C);
		};
		Add(TEXT("roads"), TEXT("Roads"), { TEXT("road") });
		Add(TEXT("homes"), TEXT("Homes"), { TEXT("cottage"), TEXT("villa"), TEXT("apartments"), TEXT("tower") });
		Add(TEXT("shops"), TEXT("Shops"), { TEXT("shop"), TEXT("inn"), TEXT("dock") });
		Add(TEXT("works"), TEXT("Works"), { TEXT("workshop") });
		Add(TEXT("parks"), TEXT("Parks"), { TEXT("park") });
		Add(TEXT("grid"), TEXT("Grid"), { TEXT("mill"), TEXT("water"), TEXT("power") });
		Add(TEXT("civic"), TEXT("Civic"), { TEXT("fire") });
		Add(TEXT("wonders"), TEXT("Wonders"), { TEXT("cityhall"), TEXT("beacon"), TEXT("observatory") });
		Add(TEXT("raze"), TEXT("Raze"), { TEXT("bulldoze") });
	}
	return Cats;
}

bool AetherisCatalog::IsWaterTile(int32 X, int32 Y, int32 Size)
{
	const float NX = X / FMath::Max(1.f, Size - 1.f);
	const float NY = Y / FMath::Max(1.f, Size - 1.f);
	const bool bRiver = FMath::Abs(NY - (0.44f + 0.11f * FMath::Sin(NX * PI * 2.15f))) < 0.048f;
	const float DX = X - Size * 0.78f;
	const float DY = Y - Size * 0.2f;
	const bool bLake = DX * DX + DY * DY < FMath::Square(Size * 0.085f);
	return bRiver || bLake;
}
