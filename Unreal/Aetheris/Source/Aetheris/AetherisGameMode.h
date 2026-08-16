#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "AetherisGameMode.generated.h"

UCLASS()
class AETHERIS_API AAetherisGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AAetherisGameMode();

	virtual void BeginPlay() override;

	UPROPERTY()
	TObjectPtr<class AAetherisWorld> Vale;
};
