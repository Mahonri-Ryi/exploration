#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "AetherisHUD.generated.h"

UCLASS()
class AETHERIS_API AAetherisHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;
};
