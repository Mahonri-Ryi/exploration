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
	bool ConsumeClick();

	FName OpenCategory = TEXT("roads");

private:
	struct FHitBox
	{
		FName Id;
		FVector2D Min;
		FVector2D Max;
		bool bCategory = false;
	};

	TArray<FHitBox> Boxes;
	FName Hovered;

	void DrawBox(const FVector2D& P, const FVector2D& S, const FLinearColor& Color);
	void AddBox(FName Id, const FVector2D& P, const FVector2D& S, bool bCategory);
	bool Hit(const FVector2D& Mouse, FName& OutId, bool& bCategory) const;
};
