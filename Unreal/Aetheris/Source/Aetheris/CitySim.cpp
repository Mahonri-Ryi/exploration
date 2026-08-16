#include "CitySim.h"

FCitySim::FCitySim(int32 InSize)
	: Size(InSize)
{
	Tiles.Reserve(Size * Size);
	for (int32 Y = 0; Y < Size; ++Y)
	{
		for (int32 X = 0; X < Size; ++X)
		{
			FCityTile Tile;
			Tile.X = X;
			Tile.Y = Y;
			Tile.bWater = AetherisCatalog::IsWaterTile(X, Y, Size);
			Tiles.Add(Tile);
		}
	}
}

FCityTile* FCitySim::Get(int32 X, int32 Y)
{
	if (X < 0 || Y < 0 || X >= Size || Y >= Size) return nullptr;
	return &Tiles[Y * Size + X];
}

const FCityTile* FCitySim::Get(int32 X, int32 Y) const
{
	if (X < 0 || Y < 0 || X >= Size || Y >= Size) return nullptr;
	return &Tiles[Y * Size + X];
}

void FCitySim::Neighbors4(int32 X, int32 Y, TArray<FCityTile*>& Out)
{
	Out.Reset();
	if (FCityTile* T = Get(X + 1, Y)) Out.Add(T);
	if (FCityTile* T = Get(X - 1, Y)) Out.Add(T);
	if (FCityTile* T = Get(X, Y + 1)) Out.Add(T);
	if (FCityTile* T = Get(X, Y - 1)) Out.Add(T);
}

void FCitySim::Neighbors4Const(int32 X, int32 Y, TArray<const FCityTile*>& Out) const
{
	Out.Reset();
	if (const FCityTile* T = Get(X + 1, Y)) Out.Add(T);
	if (const FCityTile* T = Get(X - 1, Y)) Out.Add(T);
	if (const FCityTile* T = Get(X, Y + 1)) Out.Add(T);
	if (const FCityTile* T = Get(X, Y - 1)) Out.Add(T);
}

bool FCitySim::HasRoadAccess(int32 X, int32 Y) const
{
	const FCityTile* Tile = Get(X, Y);
	if (!Tile) return false;
	if (Tile->bRoad) return true;
	TArray<const FCityTile*> N;
	Neighbors4Const(X, Y, N);
	for (const FCityTile* T : N)
	{
		if (T->bRoad) return true;
	}
	return false;
}

bool FCitySim::Operating(const FCityTile& Tile, const FBuildingDef& Def) const
{
	if (Def.bRoad) return true;
	if (!HasRoadAccess(Tile.X, Tile.Y)) return false;
	if (Def.PowerUse > 0 && !Tile.bPowered) return false;
	if (Def.WaterUse > 0 && !Tile.bWatered) return false;
	return true;
}

bool FCitySim::CanPlace(FName Id, int32 X, int32 Y, FString& Reason) const
{
	const FCityTile* Tile = Get(X, Y);
	const FBuildingDef* Def = AetherisCatalog::Find(Id);
	if (!Tile || !Def)
	{
		Reason = TEXT("Invalid tile.");
		return false;
	}
	if (Tile->bRoad || !Tile->BuildingId.IsNone())
	{
		Reason = TEXT("Tile is occupied.");
		return false;
	}
	if (Tile->bWater && !Def->bRoad)
	{
		Reason = TEXT("Cannot build on water.");
		return false;
	}
	if (Def->bWaterfront)
	{
		TArray<const FCityTile*> N;
		Neighbors4Const(X, Y, N);
		bool bFace = false;
		for (const FCityTile* T : N)
		{
			if (T->bWater) bFace = true;
		}
		if (!bFace)
		{
			Reason = TEXT("Docks must face the river.");
			return false;
		}
	}
	if (Money < Def->Cost)
	{
		Reason = TEXT("The treasury cannot afford this.");
		return false;
	}
	if (Def->bUnique)
	{
		for (const FCityTile& T : Tiles)
		{
			if (T.BuildingId == Def->Id)
			{
				Reason = FString::Printf(TEXT("Only one %s may stand."), *Def->Name);
				return false;
			}
		}
	}
	if (Population() < Def->UnlockPop)
	{
		Reason = FString::Printf(TEXT("Unlocks at %d citizens."), Def->UnlockPop);
		return false;
	}
	return true;
}

bool FCitySim::Place(FName Id, int32 X, int32 Y)
{
	FString Reason;
	if (!CanPlace(Id, X, Y, Reason)) return false;
	const FBuildingDef* Def = AetherisCatalog::Find(Id);
	FCityTile* Tile = Get(X, Y);
	if (!Def || !Tile) return false;
	Money -= Def->Cost;
	if (Def->bRoad)
	{
		Tile->bRoad = true;
		Tile->BuildingId = TEXT("road");
	}
	else
	{
		Tile->BuildingId = Def->Id;
	}
	FloodUtilities();
	return true;
}

bool FCitySim::Demolish(int32 X, int32 Y, int32& Refund)
{
	FCityTile* Tile = Get(X, Y);
	if (!Tile || (Tile->BuildingId.IsNone() && !Tile->bRoad))
	{
		Refund = 0;
		return false;
	}
	const FBuildingDef* Def = AetherisCatalog::Find(Tile->bRoad ? FName(TEXT("road")) : Tile->BuildingId);
	Refund = Def ? Def->Cost * 4 / 10 : 0;
	Tile->BuildingId = NAME_None;
	Tile->bRoad = false;
	Tile->Residents = 0;
	Tile->Workers = 0;
	Tile->bPowered = false;
	Tile->bWatered = false;
	Money += Refund;
	FloodUtilities();
	return true;
}

void FCitySim::FloodUtilities()
{
	for (FCityTile& T : Tiles)
	{
		T.bPowered = false;
		T.bWatered = false;
	}

	auto Flood = [&](bool bPower)
	{
		TArray<FCityTile*> Q;
		for (FCityTile& T : Tiles)
		{
			if (T.BuildingId.IsNone()) continue;
			const FBuildingDef* D = AetherisCatalog::Find(T.BuildingId);
			if (!D) continue;
			if (bPower ? D->PowerGen > 0 : D->WaterGen > 0)
			{
				if (bPower) T.bPowered = true;
				else T.bWatered = true;
				Q.Add(&T);
			}
		}
		while (Q.Num())
		{
			FCityTile* Cur = Q.Pop();
			TArray<FCityTile*> N;
			Neighbors4(Cur->X, Cur->Y, N);
			for (FCityTile* Next : N)
			{
				const bool bAlready = bPower ? Next->bPowered : Next->bWatered;
				if (bAlready || Next->bWater) continue;
				if (!Next->bRoad && Next->BuildingId.IsNone()) continue;
				if (bPower) Next->bPowered = true;
				else Next->bWatered = true;
				Q.Add(Next);
			}
		}
		for (FCityTile& Src : Tiles)
		{
			if (Src.BuildingId.IsNone()) continue;
			const FBuildingDef* D = AetherisCatalog::Find(Src.BuildingId);
			if (!D) continue;
			if (bPower ? D->PowerGen <= 0 : D->WaterGen <= 0) continue;
			for (FCityTile& T : Tiles)
			{
				if (FMath::Abs(T.X - Src.X) + FMath::Abs(T.Y - Src.Y) > 12) continue;
				if (!T.bRoad && T.BuildingId.IsNone()) continue;
				if (bPower) T.bPowered = true;
				else T.bWatered = true;
			}
		}
	};

	Flood(true);
	Flood(false);
}

int32 FCitySim::Population() const
{
	int32 Pop = 0;
	for (const FCityTile& T : Tiles) Pop += T.Residents;
	return Pop;
}

void FCitySim::Tick()
{
	++TickCount;
	FloodUtilities();

	int32 Expenses = 0;
	for (FCityTile& Tile : Tiles)
	{
		if (Tile.BuildingId.IsNone()) continue;
		const FBuildingDef* Def = AetherisCatalog::Find(Tile.BuildingId);
		if (!Def) continue;
		Expenses += Def->Upkeep;
		if (Def->Residents > 0)
		{
			if (Operating(Tile, *Def))
			{
				if (Tile.Residents == 0) Tile.Residents = FMath::Max(2, Def->Residents / 3);
				else Tile.Residents = FMath::Min(Def->Residents, Tile.Residents + 2);
			}
			else
			{
				Tile.Residents = FMath::Max(0, Tile.Residents - 1);
			}
		}
	}

	const int32 Pop = Population();
	const int32 Income = FMath::RoundToInt(Pop * 1.6f * TaxRate * 10.f);
	Money += Income - Expenses;
}

FCityStats FCitySim::Stats() const
{
	FCityStats S;
	S.Money = Money;
	S.Population = Population();
	for (const FCityTile& T : Tiles)
	{
		if (T.BuildingId.IsNone()) continue;
		const FBuildingDef* D = AetherisCatalog::Find(T.BuildingId);
		if (!D) continue;
		S.Jobs += D->Jobs;
		S.PowerSupply += D->PowerGen;
		S.WaterSupply += D->WaterGen;
		S.PowerDemand += D->PowerUse;
		S.WaterDemand += D->WaterUse;
		S.Expenses += D->Upkeep;
	}
	S.Income = FMath::RoundToInt(S.Population * 1.6f * TaxRate * 10.f);
	if (S.Population >= 800) S.Era = TEXT("Metropolis");
	else if (S.Population >= 400) S.Era = TEXT("City");
	else if (S.Population >= 120) S.Era = TEXT("Town");
	else if (S.Population >= 40) S.Era = TEXT("Village");
	else S.Era = TEXT("Hamlet");
	return S;
}
