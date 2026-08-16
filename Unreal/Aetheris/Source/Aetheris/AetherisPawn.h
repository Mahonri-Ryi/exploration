#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "AetherisPawn.generated.h"

class UCameraComponent;
class USpringArmComponent;
class AAetherisWorld;

UCLASS()
class AETHERIS_API AAetherisPawn : public APawn
{
	GENERATED_BODY()

public:
	AAetherisPawn();

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void BeginPlay() override;

protected:
	UPROPERTY(VisibleAnywhere)
	TObjectPtr<USpringArmComponent> Boom;

	UPROPERTY(VisibleAnywhere)
	TObjectPtr<UCameraComponent> Camera;

	void MoveForward(float Value);
	void MoveRight(float Value);
	void OrbitYaw(float Value);
	void OrbitPitch(float Value);
	void Zoom(float Value);
	void Place();
	void Raze();
	void TogglePause();
	void OrbitHoldPressed();
	void OrbitHoldReleased();
	void Tool1();
	void Tool2();
	void Tool3();
	void Tool4();
	void Tool5();
	void Tool6();
	void Tool7();

	AAetherisWorld* FindWorld() const;
	bool TraceCursor(FVector& Out) const;

	bool bOrbiting = false;
	FVector2D MoveInput = FVector2D::ZeroVector;
};
