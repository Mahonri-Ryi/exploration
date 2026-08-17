#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "AetherisPawn.generated.h"

class UCameraComponent;
class AAetherisWorld;
class AAetherisHUD;

UCLASS()
class AETHERIS_API AAetherisPawn : public APawn
{
	GENERATED_BODY()

public:
	AAetherisPawn();

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void BeginPlay() override;

	FVector Focus = FVector::ZeroVector;
	float Yaw = -45.f;
	float ZoomAlpha = 0.45f;

protected:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USceneComponent> Pivot;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UCameraComponent> Camera;

	void MoveForward(float Value);
	void MoveRight(float Value);
	void Turn(float Value);
	void Look(float Value);
	void Zoom(float Value);
	void RotateLeft();
	void RotateRight();
	void ResetView();
	void PlacePressed();
	void PlaceReleased();
	void RotatePressed();
	void RotateReleased();
	void PanPressed();
	void PanReleased();
	void RazeHotkey();
	void TogglePause();
	void ToggleSettingsMenu();
	void ToolHotkey(int32 Index);
	bool MenuBlocks() const;
	bool PollRebind();
	void Tool1() { ToolHotkey(1); }
	void Tool2() { ToolHotkey(2); }
	void Tool3() { ToolHotkey(3); }
	void Tool4() { ToolHotkey(4); }
	void Tool5() { ToolHotkey(5); }
	void Tool6() { ToolHotkey(6); }
	void Tool7() { ToolHotkey(7); }

	AAetherisWorld* FindWorld() const;
	AAetherisHUD* FindHUD() const;
	bool TraceCursor(FVector& Out) const;
	void ApplyCamera();
	void EdgeScroll(float DeltaSeconds);
	void ClampFocus();

	bool bPainting = false;
	bool bRotating = false;
	bool bPanning = false;
	FVector2D MoveInput = FVector2D::ZeroVector;
	FIntPoint LastPaint = FIntPoint(INDEX_NONE, INDEX_NONE);
};
