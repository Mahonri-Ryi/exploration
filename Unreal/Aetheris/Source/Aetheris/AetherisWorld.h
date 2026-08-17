#pragma once

#include "CoreMinimal.h"
#include "AetherisAudio.h"
#include "CitySim.h"
#include "GameFramework/Actor.h"
#include "AetherisWorld.generated.h"

class UProceduralMeshComponent;
class UStaticMesh;
class UMaterialInstanceDynamic;
class AAetherisProp;

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
	bool bRazeMode = false;

	bool TryPlaceAt(const FVector& WorldPos);
	bool TryRazeAt(const FVector& WorldPos);
	bool WorldToTile(const FVector& WorldPos, int32& OutX, int32& OutY) const;
	FVector TileToWorld(int32 X, int32 Y, float ExtraZ = 0.f) const;
	void RebuildTile(int32 X, int32 Y);
	void SetTool(FName Id);
	void UpdateHover(const FVector& WorldPos);

	static constexpr float TileSize = 400.f;
	FAetherisAudio Audio;

protected:
	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Terrain;

	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Water;

	UPROPERTY()
	TMap<FIntPoint, TObjectPtr<AActor>> TileActors;

	UPROPERTY()
	TObjectPtr<AAetherisProp> HoverTile;

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
	void AttachMesh(AActor* MeshOwner, UStaticMesh* Mesh, const FVector& Rel, const FVector& Scale, const FLinearColor& Color, float Rough = 0.7f, float Metal = 0.05f, FName TexName = NAME_None);
	float HeightAt(int32 X, int32 Y) const;
	void RefreshRoadNeighbors(int32 X, int32 Y);

	FTimerHandle SimTimer;
	void OnSimTick();
};
