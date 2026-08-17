#include "AetherisWorld.h"
#include "Aetheris.h"
#include "AetherisAssets.h"
#include "AetherisProp.h"
#include "Catalog.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/PostProcessVolume.h"
#include "Engine/SkyAtmosphere.h"
#include "Engine/SkyLight.h"
#include "Engine/StaticMesh.h"
#include "Engine/VolumetricCloud.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "ProceduralMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

AAetherisWorld::AAetherisWorld()
{
	PrimaryActorTick.bCanEverTick = true;
	Terrain = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Terrain"));
	SetRootComponent(Terrain);
	Water = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Water"));
	Water->SetupAttachment(Terrain);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cone(TEXT("/Engine/BasicShapes/Cone.Cone"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cyl(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	if (Cube.Succeeded()) CubeMesh = Cube.Object;
	if (Sphere.Succeeded()) SphereMesh = Sphere.Object;
	if (Cone.Succeeded()) ConeMesh = Cone.Object;
	if (Cyl.Succeeded()) CylinderMesh = Cyl.Object;
}

void AAetherisWorld::BeginPlay()
{
	Super::BeginPlay();
	FAetherisAssets::Get().Load();
	SpawnAtmosphere();
	BuildLandscape();
	SpawnWildTrees();
	HoverTile = GetWorld()->SpawnActor<AAetherisProp>(FVector::ZeroVector, FRotator::ZeroRotator);
	if (HoverTile)
	{
		AttachMesh(HoverTile, CubeMesh, FVector(0, 0, 8.f), FVector(3.55f, 3.55f, 0.12f), FLinearColor(0.2f, 0.85f, 0.75f, 0.35f), 0.25f, 0.f);
		HoverTile->SetActorHiddenInGame(true);
	}
	Audio.Init(GetWorld());
	GetWorldTimerManager().SetTimer(SimTimer, this, &AAetherisWorld::OnSimTick, 1.2f, true);
	LastMessage = TEXT("Found the vale. Pick a tool on the dock, then click and drag to build.");
	UE_LOG(LogAetheris, Log, TEXT("Aetheris native world ready (%d tiles)."), Sim.Tiles.Num());
}

void AAetherisWorld::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (ADirectionalLight* Sun = Cast<ADirectionalLight>(UGameplayStatics::GetActorOfClass(this, ADirectionalLight::StaticClass())))
	{
		const float Phase = FMath::Fmod(GetWorld()->GetTimeSeconds() * 0.012f + 0.35f, 1.f);
		const float Elev = FMath::Sin(Phase * 2.f * PI);
		const FVector Dir(-FMath::Cos(Phase * 2.f * PI), -0.35f, FMath::Max(0.15f, Elev));
		Sun->SetActorRotation(Dir.Rotation());
		Audio.SetDayNight(FMath::Clamp(1.f - Elev, 0.f, 1.f));
	}
}

void AAetherisWorld::SpawnAtmosphere()
{
	UWorld* World = GetWorld();
	if (!World) return;

	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	ADirectionalLight* Sun = World->SpawnActor<ADirectionalLight>(FVector(2000.f, -4000.f, 6000.f), FRotator(-50.f, -35.f, 0.f), P);
	if (Sun)
	{
		if (UDirectionalLightComponent* L = Cast<UDirectionalLightComponent>(Sun->GetLightComponent()))
		{
			L->SetAtmosphereSunLight(true);
			L->SetIntensity(12.f);
			L->SetLightColor(FLinearColor(1.f, 0.92f, 0.78f));
			L->SetDynamicShadowDistanceMovableLight(20000.f);
			L->bUseRayTracedDistanceFieldShadows = true;
			L->SetMobility(EComponentMobility::Movable);
			L->SetCastShadows(true);
		}
	}

	ASkyLight* Sky = World->SpawnActor<ASkyLight>(FVector::ZeroVector, FRotator::ZeroRotator, P);
	if (Sky)
	{
		if (USkyLightComponent* C = Sky->GetLightComponent())
		{
			C->bRealTimeCapture = true;
			C->SetIntensity(1.15f);
			C->SetMobility(EComponentMobility::Movable);
		}
	}

	World->SpawnActor<ASkyAtmosphere>(FVector::ZeroVector, FRotator::ZeroRotator, P);
	World->SpawnActor<AVolumetricCloud>(FVector::ZeroVector, FRotator::ZeroRotator, P);

	AExponentialHeightFog* Fog = World->SpawnActor<AExponentialHeightFog>(FVector(0.f, 0.f, 200.f), FRotator::ZeroRotator, P);
	if (Fog)
	{
		if (UExponentialHeightFogComponent* C = Fog->GetComponent())
		{
			C->SetFogDensity(0.008f);
			C->SetFogHeightFalloff(0.12f);
			C->SetFogInscatteringColor(FLinearColor(0.55f, 0.68f, 0.82f));
			C->bEnableVolumetricFog = true;
			C->VolumetricFogScatteringDistribution = 0.4f;
		}
	}

	APostProcessVolume* PP = World->SpawnActor<APostProcessVolume>(FVector::ZeroVector, FRotator::ZeroRotator, P);
	if (PP)
	{
		PP->bUnbound = true;
		PP->Settings.bOverride_AutoExposureBias = true;
		PP->Settings.AutoExposureBias = 0.35f;
		PP->Settings.bOverride_BloomIntensity = true;
		PP->Settings.BloomIntensity = 0.45f;
		PP->Settings.bOverride_VignetteIntensity = true;
		PP->Settings.VignetteIntensity = 0.28f;
		PP->Settings.bOverride_ColorGamma = true;
		PP->Settings.ColorGamma = FVector4(1.02f, 1.0f, 0.96f, 1.f);
	}
}

float AAetherisWorld::HeightAt(int32 X, int32 Y) const
{
	if (AetherisCatalog::IsWaterTile(X, Y, Sim.Size)) return -40.f;
	const float NX = X / FMath::Max(1.f, Sim.Size - 1.f);
	const float NY = Y / FMath::Max(1.f, Sim.Size - 1.f);
	float H = 20.f + FMath::Sin(NX * 5.2f + 0.3f) * FMath::Cos(NY * 4.1f) * 180.f + FMath::Sin(NX * 12.4f) * 30.f;
	const float RiverY = 0.44f + 0.11f * FMath::Sin(NX * PI * 2.15f);
	const float Dist = FMath::Abs(NY - RiverY);
	if (Dist < 0.14f) H *= Dist / 0.14f;
	return FMath::Max(0.f, H);
}

void AAetherisWorld::BuildLandscape()
{
	const int32 S = Sim.Size;
	TArray<FVector> Verts;
	TArray<int32> Tris;
	TArray<FVector> Normals;
	TArray<FVector2D> UV;
	TArray<FColor> Colors;
	TArray<FProcMeshTangent> Tangents;
	Verts.Reserve((S + 1) * (S + 1));
	for (int32 Y = 0; Y <= S; ++Y)
	{
		for (int32 X = 0; X <= S; ++X)
		{
			const FVector P = TileToWorld(X, Y, HeightAt(FMath::Min(X, S - 1), FMath::Min(Y, S - 1)));
			Verts.Add(P);
			UV.Add(FVector2D(X / float(S), Y / float(S)));
			const bool bWet = AetherisCatalog::IsWaterTile(FMath::Min(X, S - 1), FMath::Min(Y, S - 1), S);
			Colors.Add(bWet ? FColor(180, 160, 110) : FColor(70, 110, 48));
		}
	}
	for (int32 Y = 0; Y < S; ++Y)
	{
		for (int32 X = 0; X < S; ++X)
		{
			const int32 I = Y * (S + 1) + X;
			Tris.Append({ I, I + 1, I + S + 1, I + 1, I + S + 2, I + S + 1 });
		}
	}
	for (FVector2D& T : UV) T *= 8.f;
	Terrain->CreateMeshSection(0, Verts, Tris, Normals, UV, Colors, Tangents, true);
	Terrain->SetMaterial(0, FAetherisAssets::Get().MakeLit(this, FLinearColor(0.85f, 0.9f, 0.7f), 0.92f, 0.f, FAetherisAssets::Get().Tex(TEXT("grass"))));

	TArray<FVector> WVerts;
	TArray<int32> WTris;
	TArray<FVector2D> WUV;
	int32 W = 0;
	for (int32 Y = 0; Y < S; ++Y)
	{
		for (int32 X = 0; X < S; ++X)
		{
			if (!AetherisCatalog::IsWaterTile(X, Y, S)) continue;
			const FVector C = TileToWorld(X, Y, 8.f);
			const float H = TileSize * 0.52f;
			WVerts.Append({
				C + FVector(-H, -H, 0), C + FVector(H, -H, 0), C + FVector(H, H, 0), C + FVector(-H, H, 0)
			});
			WTris.Append({ W, W + 1, W + 2, W, W + 2, W + 3 });
			WUV.Append({ FVector2D(0, 0), FVector2D(1, 0), FVector2D(1, 1), FVector2D(0, 1) });
			W += 4;
		}
	}
	TArray<FVector> EmptyN;
	TArray<FColor> EmptyC;
	TArray<FProcMeshTangent> EmptyT;
	Water->CreateMeshSection(0, WVerts, WTris, EmptyN, WUV, EmptyC, EmptyT, false);
	Water->SetMaterial(0, FAetherisAssets::Get().MakeLit(this, FLinearColor(0.35f, 0.55f, 0.7f), 0.08f, 0.2f, FAetherisAssets::Get().Tex(TEXT("water"))));
}

void AAetherisWorld::SpawnWildTrees()
{
	if (!CylinderMesh || !ConeMesh) return;
	FRandomStream Rng(91);
	for (int32 I = 0; I < 180; ++I)
	{
		const int32 X = Rng.RandRange(0, Sim.Size - 1);
		const int32 Y = Rng.RandRange(0, Sim.Size - 1);
		const FCityTile* T = Sim.Get(X, Y);
		if (!T || T->bWater) continue;
		const bool bEdge = X < 3 || Y < 3 || X > Sim.Size - 4 || Y > Sim.Size - 4;
		if (!bEdge && Rng.FRand() > 0.08f) continue;
		AAetherisProp* Tree = GetWorld()->SpawnActor<AAetherisProp>(TileToWorld(X, Y, HeightAt(X, Y)), FRotator::ZeroRotator);
		if (!Tree) continue;
		const float S = 0.7f + Rng.FRand() * 0.8f;
		AttachMesh(Tree, CylinderMesh, FVector(0, 0, 80.f * S), FVector(0.18f, 0.18f, 1.6f) * S, FLinearColor(0.18f, 0.1f, 0.06f), 0.9f);
		AttachMesh(Tree, ConeMesh, FVector(0, 0, 220.f * S), FVector(1.1f, 1.1f, 1.6f) * S, FLinearColor(0.12f, 0.28f, 0.1f), 0.95f);
		AttachMesh(Tree, ConeMesh, FVector(0, 0, 340.f * S), FVector(0.7f, 0.7f, 1.1f) * S, FLinearColor(0.16f, 0.34f, 0.12f), 0.95f);
	}
}

void AAetherisWorld::AttachMesh(AActor* Owner, UStaticMesh* Mesh, const FVector& Rel, const FVector& Scale, const FLinearColor& Color, float Rough, float Metal, FName TexName)
{
	if (!Owner || !Mesh) return;
	UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(Owner);
	Comp->SetStaticMesh(Mesh);
	Comp->SetRelativeLocation(Rel);
	Comp->SetRelativeScale3D(Scale);
	Comp->SetMaterial(0, FAetherisAssets::Get().MakeLit(this, Color, Rough, Metal, FAetherisAssets::Get().Tex(TexName)));
	Comp->SetMobility(EComponentMobility::Movable);
	Comp->SetCastShadow(true);
	Comp->SetupAttachment(Owner->GetRootComponent());
	Comp->RegisterComponent();
	Owner->AddInstanceComponent(Comp);
}

AActor* AAetherisWorld::SpawnBuilding(int32 X, int32 Y, const FBuildingDef& Def)
{
	AAetherisProp* A = GetWorld()->SpawnActor<AAetherisProp>(TileToWorld(X, Y, HeightAt(X, Y)), FRotator::ZeroRotator);
	if (!A) return nullptr;

	if (Def.bRoad)
	{
		const bool bN = Sim.Get(X, Y - 1) && Sim.Get(X, Y - 1)->bRoad;
		const bool bS = Sim.Get(X, Y + 1) && Sim.Get(X, Y + 1)->bRoad;
		const bool bE = Sim.Get(X + 1, Y) && Sim.Get(X + 1, Y)->bRoad;
		const bool bW = Sim.Get(X - 1, Y) && Sim.Get(X - 1, Y)->bRoad;
		AttachMesh(A, CubeMesh, FVector(0, 0, 10.f), FVector(3.95f, 3.95f, 0.1f), FLinearColor(0.35f, 0.36f, 0.38f), 0.55f, 0.08f, TEXT("asphalt"));
		AttachMesh(A, CubeMesh, FVector(0, 160.f, 14.f), FVector(3.95f, 0.55f, 0.06f), FLinearColor(0.62f, 0.58f, 0.5f), 0.85f, 0.f, TEXT("stone"));
		AttachMesh(A, CubeMesh, FVector(0, -160.f, 14.f), FVector(3.95f, 0.55f, 0.06f), FLinearColor(0.62f, 0.58f, 0.5f), 0.85f, 0.f, TEXT("stone"));
		if (bE || bW) AttachMesh(A, CubeMesh, FVector(0, 0, 16.f), FVector(2.6f, 0.08f, 0.04f), FLinearColor(0.9f, 0.78f, 0.28f), 0.35f);
		if (bN || bS) AttachMesh(A, CubeMesh, FVector(0, 0, 16.f), FVector(0.08f, 2.6f, 0.04f), FLinearColor(0.9f, 0.78f, 0.28f), 0.35f);
		if ((X + Y) % 3 == 0)
		{
			AttachMesh(A, CylinderMesh, FVector(150.f, 150.f, 90.f), FVector(0.12f, 0.12f, 1.8f), FLinearColor(0.12f, 0.12f, 0.14f), 0.4f, 0.35f);
			AttachMesh(A, SphereMesh, FVector(150.f, 150.f, 190.f), FVector(0.22f, 0.22f, 0.22f), FLinearColor(1.f, 0.85f, 0.45f), 0.2f, 0.1f);
		}
		return A;
	}

	const float H = Def.Height;
	const FName Facade = (Def.Category == TEXT("homes") || Def.Category == TEXT("shops")) ? TEXT("brick") : TEXT("plaster");
	AttachMesh(A, CubeMesh, FVector(0, 0, 18.f), FVector(2.9f, 2.7f, 0.22f), FLinearColor(0.72f, 0.68f, 0.58f), 0.85f, 0.f, TEXT("stone"));

	if (Def.Id == TEXT("cottage") || Def.Id == TEXT("villa") || Def.Id == TEXT("inn"))
	{
		const float W = Def.Id == TEXT("inn") ? 3.1f : (Def.Id == TEXT("villa") ? 2.9f : 2.45f);
		AttachMesh(A, CubeMesh, FVector(0, 0, H * 0.5f + 20.f), FVector(W, W * 0.88f, H / 100.f), Def.Color, 0.72f, 0.04f, Facade);
		AttachMesh(A, CubeMesh, FVector(0, W * 46.f, H * 0.42f), FVector(W * 0.72f, 0.05f, H / 150.f), FLinearColor(0.85f, 0.9f, 0.95f), 0.15f, 0.2f, TEXT("windows"));
		AttachMesh(A, ConeMesh, FVector(0, 0, H + 90.f), FVector(W + 0.7f, W + 0.7f, 1.5f), FLinearColor(0.7f, 0.28f, 0.18f), 0.65f, 0.05f, TEXT("roof"));
		AttachMesh(A, CubeMesh, FVector(0, W * 48.f, 70.f), FVector(0.35f, 0.08f, 0.7f), FLinearColor(0.12f, 0.08f, 0.06f), 0.7f);
		if (Def.Id != TEXT("cottage"))
		{
			AttachMesh(A, CylinderMesh, FVector(W * 40.f, -40.f, H + 40.f), FVector(0.28f, 0.28f, 2.2f), FLinearColor(0.45f, 0.38f, 0.32f), 0.85f, 0.f, TEXT("stone"));
		}
	}
	else if (Def.Id == TEXT("apartments") || Def.Id == TEXT("tower"))
	{
		const float W = Def.Id == TEXT("tower") ? 2.15f : 2.7f;
		AttachMesh(A, CubeMesh, FVector(0, 0, H * 0.5f + 20.f), FVector(W, W * 0.92f, H / 100.f), Def.Color, 0.45f, 0.12f, TEXT("plaster"));
		const int32 Floors = Def.Id == TEXT("tower") ? 14 : 7;
		for (int32 F = 0; F < Floors; ++F)
		{
			const float Z = 80.f + F * (H / Floors);
			AttachMesh(A, CubeMesh, FVector(0, W * 47.f, Z), FVector(W * 0.86f, 0.05f, 0.55f), FLinearColor(0.55f, 0.72f, 0.82f), 0.12f, 0.35f, TEXT("windows"));
		}
		AttachMesh(A, CubeMesh, FVector(0, 0, H + 40.f), FVector(W * 0.7f, W * 0.7f, 0.18f), FLinearColor(0.2f, 0.22f, 0.24f), 0.4f, 0.2f);
	}
	else if (Def.Id == TEXT("shop"))
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, H * 0.5f + 20.f), FVector(2.6f, 2.3f, H / 100.f), Def.Color, 0.7f, 0.04f, TEXT("brick"));
		AttachMesh(A, CubeMesh, FVector(0, 120.f, 90.f), FVector(1.9f, 0.06f, 0.85f), FLinearColor(0.75f, 0.88f, 0.95f), 0.12f, 0.25f, TEXT("windows"));
		AttachMesh(A, CubeMesh, FVector(0, 130.f, 150.f), FVector(2.2f, 0.55f, 0.08f), FLinearColor(0.72f, 0.18f, 0.14f), 0.55f);
		AttachMesh(A, CubeMesh, FVector(0, 0, H + 40.f), FVector(2.75f, 2.45f, 0.16f), FLinearColor(0.55f, 0.22f, 0.16f), 0.7f, 0.05f, TEXT("roof"));
	}
	else if (Def.Id == TEXT("workshop"))
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, 160.f), FVector(3.1f, 2.4f, 2.8f), Def.Color, 0.8f, 0.05f, TEXT("plaster"));
		AttachMesh(A, CubeMesh, FVector(0, 0, 330.f), FVector(3.3f, 2.6f, 0.35f), FLinearColor(0.28f, 0.24f, 0.2f), 0.55f, 0.15f);
		AttachMesh(A, CylinderMesh, FVector(80.f, -70.f, 420.f), FVector(0.35f, 0.35f, 2.6f), FLinearColor(0.32f, 0.3f, 0.28f), 0.45f, 0.3f);
	}
	else if (Def.Id == TEXT("mill"))
	{
		AttachMesh(A, CylinderMesh, FVector(0, 0, 400.f), FVector(1.1f, 1.1f, 8.f), FLinearColor(0.75f, 0.72f, 0.64f), 0.8f, 0.f, TEXT("plaster"));
		AttachMesh(A, CubeMesh, FVector(180.f, 0, 820.f), FVector(3.4f, 0.2f, 0.35f), FLinearColor(0.9f, 0.88f, 0.8f), 0.85f);
		AttachMesh(A, CubeMesh, FVector(0, 180.f, 820.f), FVector(0.2f, 3.4f, 0.35f), FLinearColor(0.9f, 0.88f, 0.8f), 0.85f);
	}
	else if (Def.Id == TEXT("water"))
	{
		AttachMesh(A, CylinderMesh, FVector(0, 0, 500.f), FVector(0.7f, 0.7f, 10.f), FLinearColor(0.72f, 0.7f, 0.64f), 0.8f, 0.f, TEXT("stone"));
		AttachMesh(A, CylinderMesh, FVector(0, 0, 1050.f), FVector(2.2f, 2.2f, 1.6f), Def.Color, 0.55f, 0.2f);
	}
	else if (Def.Id == TEXT("power"))
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, 180.f), FVector(3.2f, 2.6f, 3.2f), Def.Color, 0.55f, 0.18f, TEXT("plaster"));
		AttachMesh(A, CylinderMesh, FVector(-90.f, 40.f, 520.f), FVector(1.1f, 1.1f, 5.2f), FLinearColor(0.7f, 0.72f, 0.74f), 0.35f, 0.15f);
		AttachMesh(A, CylinderMesh, FVector(90.f, -20.f, 480.f), FVector(0.9f, 0.9f, 4.6f), FLinearColor(0.68f, 0.7f, 0.72f), 0.35f, 0.15f);
	}
	else if (Def.Id == TEXT("park"))
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, 8.f), FVector(3.6f, 3.6f, 0.08f), FLinearColor(0.16f, 0.38f, 0.14f), 0.95f, 0.f, TEXT("grass"));
		AttachMesh(A, ConeMesh, FVector(-80.f, 60.f, 160.f), FVector(0.9f, 0.9f, 1.4f), FLinearColor(0.12f, 0.3f, 0.1f), 0.95f);
		AttachMesh(A, ConeMesh, FVector(90.f, -40.f, 140.f), FVector(0.7f, 0.7f, 1.15f), FLinearColor(0.14f, 0.32f, 0.12f), 0.95f);
		AttachMesh(A, CubeMesh, FVector(20.f, 10.f, 22.f), FVector(0.9f, 0.35f, 0.12f), FLinearColor(0.42f, 0.28f, 0.16f), 0.8f);
	}
	else if (Def.Id == TEXT("dock"))
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, 16.f), FVector(3.4f, 1.4f, 0.16f), FLinearColor(0.42f, 0.28f, 0.16f), 0.85f, 0.f, TEXT("stone"));
		AttachMesh(A, CubeMesh, FVector(0, 80.f, 70.f), FVector(1.6f, 1.1f, 1.1f), Def.Color, 0.75f, 0.04f, TEXT("plaster"));
		AttachMesh(A, CubeMesh, FVector(0, 80.f, 140.f), FVector(1.8f, 1.3f, 0.12f), FLinearColor(0.28f, 0.18f, 0.1f), 0.7f);
	}
	else if (Def.Id == TEXT("fire"))
	{
		AttachMesh(A, CubeMesh, FVector(-40.f, 0, 180.f), FVector(2.8f, 2.4f, 3.2f), Def.Color, 0.7f, 0.05f, TEXT("brick"));
		AttachMesh(A, CubeMesh, FVector(-40.f, 125.f, 70.f), FVector(1.4f, 0.08f, 0.9f), FLinearColor(0.08f, 0.08f, 0.09f), 0.4f);
		AttachMesh(A, CylinderMesh, FVector(110.f, -40.f, 280.f), FVector(0.55f, 0.55f, 5.2f), FLinearColor(0.7f, 0.7f, 0.68f), 0.6f, 0.1f, TEXT("stone"));
	}
	else if (Def.Id == TEXT("cityhall"))
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, H * 0.42f), FVector(3.2f, 2.6f, H / 120.f), Def.Color, 0.7f, 0.04f, TEXT("stone"));
		AttachMesh(A, CubeMesh, FVector(0, 140.f, 160.f), FVector(2.4f, 0.18f, 2.4f), FLinearColor(0.88f, 0.84f, 0.74f), 0.55f, 0.05f, TEXT("stone"));
		AttachMesh(A, SphereMesh, FVector(0, 0, H + 80.f), FVector(1.6f, 1.6f, 1.15f), FLinearColor(0.55f, 0.42f, 0.22f), 0.35f, 0.2f);
	}
	else if (Def.Id == TEXT("beacon"))
	{
		AttachMesh(A, CylinderMesh, FVector(0, 0, 600.f), FVector(1.f, 1.f, 12.f), FLinearColor(0.7f, 0.68f, 0.6f), 0.75f, 0.08f, TEXT("stone"));
		AttachMesh(A, SphereMesh, FVector(0, 0, 1300.f), FVector(1.2f, 1.2f, 1.2f), FLinearColor(0.3f, 0.9f, 0.85f), 0.2f, 0.4f);
	}
	else if (Def.Id == TEXT("observatory"))
	{
		AttachMesh(A, CylinderMesh, FVector(0, 0, 280.f), FVector(2.1f, 2.1f, 5.2f), Def.Color, 0.55f, 0.08f, TEXT("stone"));
		AttachMesh(A, SphereMesh, FVector(0, 0, 620.f), FVector(2.3f, 2.3f, 1.6f), FLinearColor(0.42f, 0.4f, 0.55f), 0.25f, 0.15f);
		AttachMesh(A, CylinderMesh, FVector(70.f, 40.f, 780.f), FVector(0.35f, 0.35f, 2.4f), FLinearColor(0.2f, 0.2f, 0.22f), 0.4f, 0.3f);
	}
	else
	{
		AttachMesh(A, CubeMesh, FVector(0, 0, H * 0.5f + 20.f), FVector(2.55f, 2.35f, H / 100.f), Def.Color, 0.72f, 0.04f, Facade);
		AttachMesh(A, CubeMesh, FVector(0, 122.f, H * 0.45f), FVector(1.8f, 0.04f, H / 140.f), FLinearColor(0.85f, 0.9f, 0.95f), 0.15f, 0.2f, TEXT("windows"));
	}
	return A;
}

void AAetherisWorld::RebuildTile(int32 X, int32 Y)
{
	const FIntPoint Key(X, Y);
	if (AActor* Old = TileActors.FindRef(Key))
	{
		Old->Destroy();
		TileActors.Remove(Key);
	}
	const FCityTile* Tile = Sim.Get(X, Y);
	if (!Tile || (Tile->BuildingId.IsNone() && !Tile->bRoad)) return;
	const FBuildingDef* Def = AetherisCatalog::Find(Tile->bRoad ? FName(TEXT("road")) : Tile->BuildingId);
	if (!Def) return;
	if (AActor* Built = SpawnBuilding(X, Y, *Def))
	{
		TileActors.Add(Key, Built);
	}
}

FVector AAetherisWorld::TileToWorld(int32 X, int32 Y, float ExtraZ) const
{
	const float Origin = -(Sim.Size * TileSize) * 0.5f + TileSize * 0.5f;
	return FVector(Origin + X * TileSize, Origin + Y * TileSize, ExtraZ);
}

bool AAetherisWorld::WorldToTile(const FVector& WorldPos, int32& OutX, int32& OutY) const
{
	const float Origin = -(Sim.Size * TileSize) * 0.5f;
	OutX = FMath::FloorToInt((WorldPos.X - Origin) / TileSize);
	OutY = FMath::FloorToInt((WorldPos.Y - Origin) / TileSize);
	return OutX >= 0 && OutY >= 0 && OutX < Sim.Size && OutY < Sim.Size;
}

bool AAetherisWorld::TryPlaceAt(const FVector& WorldPos)
{
	int32 X, Y;
	if (!WorldToTile(WorldPos, X, Y)) return false;
	FString Reason;
	if (!Sim.CanPlace(CurrentTool, X, Y, Reason))
	{
		LastMessage = Reason;
		Audio.Play(TEXT("error"), 0.7f);
		return false;
	}
	if (!Sim.Place(CurrentTool, X, Y)) return false;
	RebuildTile(X, Y);
	if (CurrentTool == TEXT("road")) RefreshRoadNeighbors(X, Y);
	const FBuildingDef* Def = AetherisCatalog::Find(CurrentTool);
	LastMessage = FString::Printf(TEXT("Raised %s."), Def ? *Def->Name : TEXT("structure"));
	Audio.Play(Def && Def->bRoad ? TEXT("place") : TEXT("construction"), 0.85f);
	return true;
}

bool AAetherisWorld::TryRazeAt(const FVector& WorldPos)
{
	int32 X, Y;
	if (!WorldToTile(WorldPos, X, Y)) return false;
	int32 Refund = 0;
	if (!Sim.Demolish(X, Y, Refund))
	{
		LastMessage = TEXT("Nothing to remove.");
		Audio.Play(TEXT("error"), 0.55f);
		return false;
	}
	RebuildTile(X, Y);
	RefreshRoadNeighbors(X, Y);
	LastMessage = FString::Printf(TEXT("Razed. Treasury +$%d"), Refund);
	Audio.Play(TEXT("demolish"), 0.8f);
	return true;
}

void AAetherisWorld::SetTool(FName Id)
{
	bRazeMode = (Id == TEXT("bulldoze"));
	if (bRazeMode)
	{
		LastMessage = TEXT("Raze — click a plot to salvage 40%.");
		Audio.Play(TEXT("ui_click"), 0.6f);
		return;
	}
	if (!AetherisCatalog::Find(Id)) return;
	CurrentTool = Id;
	LastMessage = FString::Printf(TEXT("Tool: %s  ·  $%d"), *AetherisCatalog::Find(Id)->Name, AetherisCatalog::Find(Id)->Cost);
	Audio.Play(TEXT("ui_click"), 0.6f);
}

void AAetherisWorld::UpdateHover(const FVector& WorldPos)
{
	if (!HoverTile) return;
	int32 X, Y;
	if (!WorldToTile(WorldPos, X, Y))
	{
		HoverTile->SetActorHiddenInGame(true);
		return;
	}
	HoverTile->SetActorHiddenInGame(false);
	HoverTile->SetActorLocation(TileToWorld(X, Y, HeightAt(X, Y) + 4.f));
	FString Reason;
	const bool bOk = bRazeMode || Sim.CanPlace(CurrentTool, X, Y, Reason);
	float GhostH = 0.12f;
	if (!bRazeMode)
	{
		if (const FBuildingDef* Def = AetherisCatalog::Find(CurrentTool))
		{
			GhostH = FMath::Clamp(Def->Height / 100.f, 0.18f, 18.f);
		}
	}
	if (UStaticMeshComponent* Comp = HoverTile->FindComponentByClass<UStaticMeshComponent>())
	{
		Comp->SetRelativeScale3D(FVector(3.55f, 3.55f, GhostH));
		Comp->SetRelativeLocation(FVector(0.f, 0.f, GhostH * 50.f));
		Comp->SetVectorParameterValueOnMaterials(TEXT("Color"), bOk ? FVector(0.18f, 0.82f, 0.7f) : FVector(0.88f, 0.18f, 0.16f));
	}
}

void AAetherisWorld::RefreshRoadNeighbors(int32 X, int32 Y)
{
	const int32 OX[] = { 1, -1, 0, 0 };
	const int32 OY[] = { 0, 0, 1, -1 };
	for (int32 I = 0; I < 4; ++I)
	{
		const FCityTile* N = Sim.Get(X + OX[I], Y + OY[I]);
		if (N && N->bRoad) RebuildTile(N->X, N->Y);
	}
}

void AAetherisWorld::OnSimTick()
{
	if (bPaused) return;
	Sim.Tick();
}
