#include "AetherisHUD.h"
#include "AetherisWorld.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Kismet/GameplayStatics.h"

void AAetherisHUD::DrawHUD()
{
	Super::DrawHUD();
	AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
	if (!Vale || !Canvas) return;

	const FCityStats S = Vale->Sim.Stats();
	const FString Line = FString::Printf(
		TEXT("AETHERIS   %s   $%d   Souls %d   Power %d/%d   Water %d/%d   %s"),
		*S.Era, S.Money, S.Population, S.PowerSupply, S.PowerDemand, S.WaterSupply, S.WaterDemand, *Vale->CurrentTool.ToString());

	FCanvasTextItem Title(FVector2D(28.f, 22.f), FText::FromString(Line), GEngine->GetSmallFont(), FLinearColor(1.f, 0.92f, 0.72f));
	Title.EnableShadow(FLinearColor(0.f, 0.f, 0.f, 0.7f));
	Canvas->DrawItem(Title);

	FCanvasTextItem Hint(
		FVector2D(28.f, Canvas->SizeY - 48.f),
		FText::FromString(Vale->LastMessage),
		GEngine->GetSmallFont(),
		FLinearColor(0.85f, 0.9f, 0.95f));
	Hint.EnableShadow(FLinearColor::Black);
	Canvas->DrawItem(Hint);

	FCanvasTextItem Keys(
		FVector2D(28.f, Canvas->SizeY - 78.f),
		FText::FromString(TEXT("WASD pan  ·  MMB orbit  ·  Wheel zoom  ·  LMB place  ·  RMB raze  ·  Space pause")),
		GEngine->GetSmallFont(),
		FLinearColor(0.7f, 0.74f, 0.78f));
	Canvas->DrawItem(Keys);
}
