#include "AetherisPawn.h"
#include "AetherisWorld.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

AAetherisPawn::AAetherisPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	Boom = CreateDefaultSubobject<USpringArmComponent>(TEXT("Boom"));
	SetRootComponent(Boom);
	Boom->TargetArmLength = 9000.f;
	Boom->bDoCollisionTest = false;
	Boom->SetRelativeRotation(FRotator(-42.f, -45.f, 0.f));
	Boom->bEnableCameraLag = true;
	Boom->CameraLagSpeed = 8.f;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Boom);
	Camera->bUsePawnControlRotation = false;
}

void AAetherisPawn::BeginPlay()
{
	Super::BeginPlay();
	SetActorLocation(FVector(0.f, 0.f, 400.f));
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		PC->bShowMouseCursor = true;
		PC->bEnableClickEvents = true;
		FInputModeGameAndUI Mode;
		Mode.SetHideCursorDuringCapture(false);
		PC->SetInputMode(Mode);
	}
}

void AAetherisPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &AAetherisPawn::MoveForward);
	PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &AAetherisPawn::MoveRight);
	PlayerInputComponent->BindAxis(TEXT("OrbitYaw"), this, &AAetherisPawn::OrbitYaw);
	PlayerInputComponent->BindAxis(TEXT("OrbitPitch"), this, &AAetherisPawn::OrbitPitch);
	PlayerInputComponent->BindAxis(TEXT("Zoom"), this, &AAetherisPawn::Zoom);
	PlayerInputComponent->BindAction(TEXT("Place"), IE_Pressed, this, &AAetherisPawn::Place);
	PlayerInputComponent->BindAction(TEXT("Raze"), IE_Pressed, this, &AAetherisPawn::Raze);
	PlayerInputComponent->BindAction(TEXT("Pause"), IE_Pressed, this, &AAetherisPawn::TogglePause);
	PlayerInputComponent->BindAction(TEXT("OrbitHold"), IE_Pressed, this, &AAetherisPawn::OrbitHoldPressed);
	PlayerInputComponent->BindAction(TEXT("OrbitHold"), IE_Released, this, &AAetherisPawn::OrbitHoldReleased);
	PlayerInputComponent->BindAction(TEXT("Tool1"), IE_Pressed, this, &AAetherisPawn::Tool1);
	PlayerInputComponent->BindAction(TEXT("Tool2"), IE_Pressed, this, &AAetherisPawn::Tool2);
	PlayerInputComponent->BindAction(TEXT("Tool3"), IE_Pressed, this, &AAetherisPawn::Tool3);
	PlayerInputComponent->BindAction(TEXT("Tool4"), IE_Pressed, this, &AAetherisPawn::Tool4);
	PlayerInputComponent->BindAction(TEXT("Tool5"), IE_Pressed, this, &AAetherisPawn::Tool5);
	PlayerInputComponent->BindAction(TEXT("Tool6"), IE_Pressed, this, &AAetherisPawn::Tool6);
	PlayerInputComponent->BindAction(TEXT("Tool7"), IE_Pressed, this, &AAetherisPawn::Tool7);
}

void AAetherisPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!MoveInput.IsNearlyZero())
	{
		const FRotator Yaw(0.f, Boom->GetRelativeRotation().Yaw, 0.f);
		const FVector Forward = FRotationMatrix(Yaw).GetUnitAxis(EAxis::X);
		const FVector Right = FRotationMatrix(Yaw).GetUnitAxis(EAxis::Y);
		AddActorWorldOffset((Forward * MoveInput.Y + Right * MoveInput.X) * 4200.f * DeltaSeconds);
		MoveInput = FVector2D::ZeroVector;
	}
}

void AAetherisPawn::MoveForward(float Value) { MoveInput.Y += Value; }
void AAetherisPawn::MoveRight(float Value) { MoveInput.X += Value; }

void AAetherisPawn::OrbitYaw(float Value)
{
	if (bOrbiting) Boom->AddRelativeRotation(FRotator(0.f, Value * 1.6f, 0.f));
}

void AAetherisPawn::OrbitPitch(float Value)
{
	if (!bOrbiting) return;
	FRotator R = Boom->GetRelativeRotation();
	R.Pitch = FMath::Clamp(R.Pitch + Value * 1.4f, -80.f, -12.f);
	Boom->SetRelativeRotation(R);
}

void AAetherisPawn::Zoom(float Value)
{
	Boom->TargetArmLength = FMath::Clamp(Boom->TargetArmLength - Value * 900.f, 1800.f, 18000.f);
}

void AAetherisPawn::OrbitHoldPressed() { bOrbiting = true; }
void AAetherisPawn::OrbitHoldReleased() { bOrbiting = false; }

AAetherisWorld* AAetherisPawn::FindWorld() const
{
	return Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
}

bool AAetherisPawn::TraceCursor(FVector& Out) const
{
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC) return false;
	FHitResult Hit;
	if (PC->GetHitResultUnderCursorByChannel(ECC_Visibility, true, Hit))
	{
		Out = Hit.ImpactPoint;
		return true;
	}
	FVector World, Dir;
	if (PC->DeprojectMousePositionToWorld(World, Dir))
	{
		const float T = -World.Z / Dir.Z;
		if (T > 0.f)
		{
			Out = World + Dir * T;
			return true;
		}
	}
	return false;
}

void AAetherisPawn::Place()
{
	FVector P;
	if (AAetherisWorld* Vale = FindWorld())
	{
		if (TraceCursor(P)) Vale->TryPlaceAt(P);
	}
}

void AAetherisPawn::Raze()
{
	FVector P;
	if (AAetherisWorld* Vale = FindWorld())
	{
		if (TraceCursor(P)) Vale->TryRazeAt(P);
	}
}

void AAetherisPawn::TogglePause()
{
	if (AAetherisWorld* Vale = FindWorld())
	{
		Vale->bPaused = !Vale->bPaused;
		Vale->LastMessage = Vale->bPaused ? TEXT("Paused") : TEXT("The vale lives.");
	}
}

void AAetherisPawn::Tool1() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("road")); }
void AAetherisPawn::Tool2() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("cottage")); }
void AAetherisPawn::Tool3() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("mill")); }
void AAetherisPawn::Tool4() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("water")); }
void AAetherisPawn::Tool5() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("shop")); }
void AAetherisPawn::Tool6() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("park")); }
void AAetherisPawn::Tool7() { if (AAetherisWorld* V = FindWorld()) V->SetTool(TEXT("workshop")); }
