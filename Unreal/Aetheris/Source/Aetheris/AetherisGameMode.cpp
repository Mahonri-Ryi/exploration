#include "AetherisGameMode.h"
#include "AetherisHUD.h"
#include "AetherisPawn.h"
#include "AetherisSettings.h"
#include "AetherisWorld.h"
#include "Aetheris.h"
#include "Engine/Engine.h"

AAetherisGameMode::AAetherisGameMode()
{
	DefaultPawnClass = AAetherisPawn::StaticClass();
	HUDClass = AAetherisHUD::StaticClass();
	PlayerControllerClass = APlayerController::StaticClass();
}

void AAetherisGameMode::BeginPlay()
{
	Super::BeginPlay();
	FAetherisSettings::Get().Load();
	FAetherisSettings::Get().ApplyGraphics();
	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Vale = GetWorld()->SpawnActor<AAetherisWorld>(FVector::ZeroVector, FRotator::ZeroRotator, P);
	UE_LOG(LogAetheris, Log, TEXT("Aetheris GameMode spawned the vale."));
	if (GEngine)
	{
		GEngine->AddOnScreenDebugMessage(-1, 12.f, FColor::Yellow, TEXT("Aetheris is running. Use the bottom dock to build. Esc = Settings."));
	}
}
