#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CitySim.h"
#include "AetherisWorld.generated.h"

class UProceduralMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UMaterialInstanceDynamic;

UCLASS()
class AETHERIS_API AAetherisWorld : public AActor
{
	GENERATED_BODY()

public:
	AAetherisWorld();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	FCitySim Sim;
	FName CurrentTool = TEXT("road");
	FString LastMessage;
	bool bPaused = false;

	bool TryPlaceAt(const FVector& WorldPos);
	bool TryRazeAt(const FVector& WorldPos);
	bool WorldToTile(const FVector& WorldPos, int32& OutX, int32& OutY) const;
	FVector TileToWorld(int32 X, int32 Y, float ExtraZ = 0.f) const;
	void RebuildTile(int32 X, int32 Y);
	void SetTool(FName Id);

	static constexpr float TileSize = 400.f;

protected:
	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Terrain;

	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Water;

	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<AActor>> TileActors;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CubeMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> SphereMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> ConeMesh;

	UPROPERTY()
	TObjectPtr<UStaticMesh> CylinderMesh;

	void SpawnAtmosphere();
	void BuildLandscape();
	void SpawnWildTrees();
	AActor* SpawnBuilding(int32 X, int32 Y, const FBuildingDef& Def);
	UMaterialInstanceDynamic* MakeLit(const FLinearColor& Color, float Roughness, float Metallic);
	float HeightAt(int32 X, int32 Y) const;
	void AttachMesh(AActor* Owner, UStaticMesh* Mesh, const FVector& Rel, const FVector& Scale, const FLinearColor& Color, float Rough = 0.7f, float Metal = 0.05f);

	FTimerHandle SimTimer;
	void OnSimTick();
};
