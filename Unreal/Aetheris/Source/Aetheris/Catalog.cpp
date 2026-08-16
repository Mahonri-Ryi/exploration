#include "Catalog.h"

namespace
{
	TArray<FBuildingDef> MakeCatalog()
	{
		TArray<FBuildingDef> Out;
		auto Add = [&](FBuildingDef D) { Out.Add(MoveTemp(D)); };

		Add({ TEXT("road"), TEXT("Avenue"), 25, 1, 0, 0, 0, 0, 0, 0, 0, 20.f, FLinearColor(0.08f, 0.09f, 0.1f), true });
		Add({ TEXT("cottage"), TEXT("Cottage"), 220, 4, 8, 0, 2, 2, 0, 0, 0, 280.f, FLinearColor(0.72f, 0.58f, 0.38f) });
		Add({ TEXT("villa"), TEXT("Villa"), 900, 12, 18, 0, 4, 4, 0, 0, 40, 380.f, FLinearColor(0.82f, 0.72f, 0.55f) });
		Add({ TEXT("apartments"), TEXT("Apartments"), 2800, 28, 60, 0, 10, 10, 0, 0, 120, 1100.f, FLinearColor(0.45f, 0.35f, 0.24f) });
		Add({ TEXT("tower"), TEXT("Tower"), 9000, 70, 140, 0, 22, 22, 0, 0, 220, 2200.f, FLinearColor(0.55f, 0.62f, 0.68f) });
		Add({ TEXT("shop"), TEXT("Boutique"), 480, 8, 0, 6, 3, 2, 0, 0, 0, 260.f, FLinearColor(0.7f, 0.28f, 0.22f) });
		Add({ TEXT("inn"), TEXT("Hearth Inn"), 1600, 18, 0, 10, 5, 4, 0, 0, 25, 340.f, FLinearColor(0.62f, 0.32f, 0.2f) });
		Add({ TEXT("workshop"), TEXT("Workshop"), 900, 14, 0, 10, 6, 3, 0, 0, 0, 300.f, FLinearColor(0.35f, 0.3f, 0.26f) });
		Add({ TEXT("park"), TEXT("Park"), 350, 3, 0, 0, 0, 1, 0, 0, 0, 40.f, FLinearColor(0.18f, 0.42f, 0.16f) });
		Add({ TEXT("mill"), TEXT("Windmill"), 1600, 12, 0, 4, 0, 0, 48, 0, 0, 900.f, FLinearColor(0.78f, 0.74f, 0.66f) });
		Add({ TEXT("power"), TEXT("Power Plant"), 4500, 55, 0, 12, 0, 4, 160, 0, 0, 860.f, FLinearColor(0.15f, 0.38f, 0.36f) });
		Add({ TEXT("water"), TEXT("Water Tower"), 2800, 30, 0, 6, 4, 0, 0, 140, 0, 1100.f, FLinearColor(0.2f, 0.38f, 0.48f) });
		Add({ TEXT("dock"), TEXT("River Dock"), 1200, 10, 0, 8, 2, 1, 0, 0, 0, 80.f, FLinearColor(0.42f, 0.28f, 0.16f), false, true });
		Add({ TEXT("fire"), TEXT("Fire Hall"), 3200, 40, 0, 8, 4, 4, 0, 0, 20, 420.f, FLinearColor(0.72f, 0.18f, 0.12f) });
		Add({ TEXT("cityhall"), TEXT("City Hall"), 8000, 60, 0, 16, 8, 8, 0, 0, 80, 700.f, FLinearColor(0.78f, 0.72f, 0.58f), false, false, true });
		Add({ TEXT("beacon"), TEXT("Beacon"), 6500, 28, 0, 4, 6, 2, 12, 0, 60, 1400.f, FLinearColor(0.2f, 0.72f, 0.7f), false, false, true });
		Add({ TEXT("observatory"), TEXT("Observatory"), 9000, 40, 0, 6, 8, 4, 0, 0, 100, 900.f, FLinearColor(0.55f, 0.5f, 0.72f), false, false, true });
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
	for (const FBuildingDef& Def : All())
	{
		if (Def.Id == Id)
		{
			return &Def;
		}
	}
	return nullptr;
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
