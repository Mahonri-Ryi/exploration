#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "InputCoreTypes.h"
#include "AetherisHUD.generated.h"

UCLASS()
class AETHERIS_API AAetherisHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;
	bool ConsumeClick();
	void ToggleSettings();
	bool IsMenuOpen() const { return bSettingsOpen; }
	bool IsListening() const { return !ListeningBind.IsNone(); }
	bool CancelListen();
	bool BlocksWorld() const { return bSettingsOpen || !ListeningBind.IsNone(); }
	void CaptureKey(const FKey& Key);

	FName OpenCategory = TEXT("roads");

private:
	enum class EBoxKind : uint8 { Category, Tool, Setting };

	struct FHitBox
	{
		FName Id;
		FVector2D Min;
		FVector2D Max;
		EBoxKind Kind = EBoxKind::Category;
	};

	TArray<FHitBox> Boxes;
	FName Hovered;
	FName SettingsTab = TEXT("graphics");
	FName ListeningBind;
	bool bSettingsOpen = false;

	void DrawBox(const FVector2D& P, const FVector2D& S, const FLinearColor& Color);
	void AddBox(FName Id, const FVector2D& P, const FVector2D& S, EBoxKind Kind);
	bool Hit(const FVector2D& Mouse, FName& OutId, EBoxKind& OutKind) const;
	void DrawLabel(const FVector2D& P, const FString& Text, const FLinearColor& Color);
	void DrawSettings();
	void DrawChoice(const FVector2D& P, const FString& Label, const TArray<TPair<FName, FString>>& Choices, FName Selected);
	void DrawStepper(const FVector2D& P, const FString& Label, const FString& Value, FName DownId, FName UpId);
	void DrawToggle(const FVector2D& P, const FString& Label, bool bOn, FName Id);
	void HandleSetting(FName Id);
};
