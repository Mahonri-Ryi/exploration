#include "AetherisGameMode.h"
#include "AetherisHUD.h"
#include "AetherisPawn.h"
#include "AetherisWorld.h"
#include "Aetheris.h"

AAetherisGameMode::AAetherisGameMode()
{
	DefaultPawnClass = AAetherisPawn::StaticClass();
	HUDClass = AAetherisHUD::StaticClass();
}

void AAetherisGameMode::BeginPlay()
{
	Super::BeginPlay();
	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Vale = GetWorld()->SpawnActor<AAetherisWorld>(FVector::ZeroVector, FRotator::ZeroRotator, P);
	UE_LOG(LogAetheris, Log, TEXT("Aetheris GameMode spawned the vale."));
}
