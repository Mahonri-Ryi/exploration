#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "AetherisProp.generated.h"

UCLASS()
class AETHERIS_API AAetherisProp : public AActor
{
	GENERATED_BODY()

public:
	AAetherisProp();

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USceneComponent> Root;
};
