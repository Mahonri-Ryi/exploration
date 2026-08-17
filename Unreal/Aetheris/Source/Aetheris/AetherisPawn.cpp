#include "AetherisPawn.h"
#include "AetherisHUD.h"
#include "AetherisWorld.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

AAetherisPawn::AAetherisPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	Pivot = CreateDefaultSubobject<USceneComponent>(TEXT("Pivot"));
	SetRootComponent(Pivot);
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Pivot);
	Camera->bUsePawnControlRotation = false;
	Camera->FieldOfView = 42.f;
}

void AAetherisPawn::BeginPlay()
{
	Super::BeginPlay();
	Focus = FVector(0.f, 0.f, 80.f);
	ApplyCamera();
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		PC->bShowMouseCursor = true;
		PC->bEnableClickEvents = true;
		PC->bEnableMouseOverEvents = true;
		FInputModeGameAndUI Mode;
		Mode.SetHideCursorDuringCapture(false);
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		PC->SetInputMode(Mode);
	}
}

void AAetherisPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &AAetherisPawn::MoveForward);
	PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &AAetherisPawn::MoveRight);
	PlayerInputComponent->BindAxis(TEXT("OrbitYaw"), this, &AAetherisPawn::Turn);
	PlayerInputComponent->BindAxis(TEXT("OrbitPitch"), this, &AAetherisPawn::Look);
	PlayerInputComponent->BindAxis(TEXT("Zoom"), this, &AAetherisPawn::Zoom);
	PlayerInputComponent->BindAction(TEXT("Place"), IE_Pressed, this, &AAetherisPawn::PlacePressed);
	PlayerInputComponent->BindAction(TEXT("Place"), IE_Released, this, &AAetherisPawn::PlaceReleased);
	PlayerInputComponent->BindAction(TEXT("Raze"), IE_Pressed, this, &AAetherisPawn::RotatePressed);
	PlayerInputComponent->BindAction(TEXT("Raze"), IE_Released, this, &AAetherisPawn::RotateReleased);
	PlayerInputComponent->BindAction(TEXT("OrbitHold"), IE_Pressed, this, &AAetherisPawn::PanPressed);
	PlayerInputComponent->BindAction(TEXT("OrbitHold"), IE_Released, this, &AAetherisPawn::PanReleased);
	PlayerInputComponent->BindAction(TEXT("Pause"), IE_Pressed, this, &AAetherisPawn::TogglePause);
	PlayerInputComponent->BindAction(TEXT("RotateLeft"), IE_Pressed, this, &AAetherisPawn::RotateLeft);
	PlayerInputComponent->BindAction(TEXT("RotateRight"), IE_Pressed, this, &AAetherisPawn::RotateRight);
	PlayerInputComponent->BindAction(TEXT("ResetCamera"), IE_Pressed, this, &AAetherisPawn::ResetView);
	PlayerInputComponent->BindAction(TEXT("RazeHotkey"), IE_Pressed, this, &AAetherisPawn::RazeHotkey);
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
	const float Dist = FMath::Lerp(2200.f, 14000.f, ZoomAlpha);
	const float Pan = Dist * 0.55f * DeltaSeconds;
	const FRotator YawRot(0.f, Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawRot).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawRot).GetUnitAxis(EAxis::Y);
	Focus += (Forward * MoveInput.Y + Right * MoveInput.X) * Pan;
	MoveInput = FVector2D::ZeroVector;
	EdgeScroll(DeltaSeconds);
	ClampFocus();

	if (bPanning)
	{
		if (APlayerController* PC = Cast<APlayerController>(GetController()))
		{
			float DX = 0.f, DY = 0.f;
			PC->GetInputMouseDelta(DX, DY);
			Focus += (-Right * DX + -Forward * DY) * Dist * 0.012f;
		}
	}

	ApplyCamera();

	AAetherisWorld* Vale = FindWorld();
	FVector Hit;
	if (Vale && TraceCursor(Hit))
	{
		Vale->UpdateHover(Hit);
		if (bPainting)
		{
			int32 X, Y;
			if (Vale->WorldToTile(Hit, X, Y) && LastPaint != FIntPoint(X, Y))
			{
				LastPaint = FIntPoint(X, Y);
				if (Vale->bRazeMode) Vale->TryRazeAt(Hit);
				else Vale->TryPlaceAt(Hit);
			}
		}
	}
}

void AAetherisPawn::ApplyCamera()
{
	const float Dist = FMath::Lerp(2200.f, 14000.f, ZoomAlpha);
	const float Pitch = FMath::Lerp(-28.f, -58.f, ZoomAlpha);
	const FRotator Rot(Pitch, Yaw, 0.f);
	const FVector CamLoc = Focus - Rot.Vector() * Dist + FVector(0.f, 0.f, 120.f);
	SetActorLocation(Focus);
	Camera->SetWorldLocation(CamLoc);
	Camera->SetWorldRotation((Focus - CamLoc).Rotation());
	Camera->SetFieldOfView(FMath::Lerp(38.f, 48.f, ZoomAlpha));
}

void AAetherisPawn::EdgeScroll(float DeltaSeconds)
{
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || bRotating || bPanning) return;
	float MX, MY;
	if (!PC->GetMousePosition(MX, MY)) return;
	int32 SX = 0, SY = 0;
	PC->GetViewportSize(SX, SY);
	const float Margin = 18.f;
	const float Dist = FMath::Lerp(2200.f, 14000.f, ZoomAlpha);
	const float Speed = Dist * 0.42f * DeltaSeconds;
	const FRotator YawRot(0.f, Yaw, 0.f);
	const FVector Forward = FRotationMatrix(YawRot).GetUnitAxis(EAxis::X);
	const FVector Right = FRotationMatrix(YawRot).GetUnitAxis(EAxis::Y);
	if (MX <= Margin) Focus -= Right * Speed;
	if (MX >= SX - Margin) Focus += Right * Speed;
	if (MY <= Margin) Focus += Forward * Speed;
	if (MY >= SY - Margin) Focus -= Forward * Speed;
}

void AAetherisPawn::ClampFocus()
{
	const float Limit = 40.f * 400.f * 0.48f;
	Focus.X = FMath::Clamp(Focus.X, -Limit, Limit);
	Focus.Y = FMath::Clamp(Focus.Y, -Limit, Limit);
	Focus.Z = 80.f;
}

void AAetherisPawn::MoveForward(float Value) { MoveInput.Y += Value; }
void AAetherisPawn::MoveRight(float Value) { MoveInput.X += Value; }

void AAetherisPawn::Turn(float Value)
{
	if (bRotating) Yaw += Value * 1.8f;
}

void AAetherisPawn::Look(float Value)
{
	if (bRotating) ZoomAlpha = FMath::Clamp(ZoomAlpha - Value * 0.012f, 0.f, 1.f);
}

void AAetherisPawn::Zoom(float Value)
{
	ZoomAlpha = FMath::Clamp(ZoomAlpha - Value * 0.08f, 0.f, 1.f);
}

void AAetherisPawn::RotateLeft() { Yaw -= 45.f; }
void AAetherisPawn::RotateRight() { Yaw += 45.f; }
void AAetherisPawn::ResetView()
{
	Focus = FVector::ZeroVector;
	Yaw = -45.f;
	ZoomAlpha = 0.45f;
}

void AAetherisPawn::PlacePressed()
{
	if (AAetherisHUD* HUD = FindHUD())
	{
		if (HUD->ConsumeClick()) return;
	}
	bPainting = true;
	LastPaint = FIntPoint(INDEX_NONE, INDEX_NONE);
	FVector Hit;
	if (AAetherisWorld* Vale = FindWorld())
	{
		if (TraceCursor(Hit))
		{
			if (Vale->bRazeMode) Vale->TryRazeAt(Hit);
			else Vale->TryPlaceAt(Hit);
			int32 X, Y;
			if (Vale->WorldToTile(Hit, X, Y)) LastPaint = FIntPoint(X, Y);
		}
	}
}

void AAetherisPawn::PlaceReleased() { bPainting = false; }
void AAetherisPawn::RotatePressed() { bRotating = true; }
void AAetherisPawn::RotateReleased() { bRotating = false; }
void AAetherisPawn::PanPressed() { bPanning = true; }
void AAetherisPawn::PanReleased() { bPanning = false; }

void AAetherisPawn::RazeHotkey()
{
	if (AAetherisWorld* Vale = FindWorld()) Vale->SetTool(TEXT("bulldoze"));
}

void AAetherisPawn::TogglePause()
{
	if (AAetherisWorld* Vale = FindWorld())
	{
		Vale->bPaused = !Vale->bPaused;
		Vale->LastMessage = Vale->bPaused ? TEXT("Paused") : TEXT("The vale lives.");
	}
}

void AAetherisPawn::ToolHotkey(int32 Index)
{
	AAetherisWorld* Vale = FindWorld();
	if (!Vale) return;
	const FName Tools[] = { NAME_None, TEXT("road"), TEXT("cottage"), TEXT("mill"), TEXT("water"), TEXT("shop"), TEXT("park"), TEXT("workshop") };
	if (Index >= 1 && Index <= 7) Vale->SetTool(Tools[Index]);
}

AAetherisWorld* AAetherisPawn::FindWorld() const
{
	return Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
}

AAetherisHUD* AAetherisPawn::FindHUD() const
{
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		return Cast<AAetherisHUD>(PC->GetHUD());
	}
	return nullptr;
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
	if (PC->DeprojectMousePositionToWorld(World, Dir) && FMath::Abs(Dir.Z) > KINDA_SMALL_NUMBER)
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
