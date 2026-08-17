#include "AetherisHUD.h"
#include "AetherisWorld.h"
#include "Catalog.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Kismet/GameplayStatics.h"

void AAetherisHUD::DrawBox(const FVector2D& P, const FVector2D& S, const FLinearColor& Color)
{
	FCanvasTileItem Tile(P, S, Color);
	Tile.BlendMode = SE_BLEND_Translucent;
	Canvas->DrawItem(Tile);
}

void AAetherisHUD::AddBox(FName Id, const FVector2D& P, const FVector2D& S, bool bCategory)
{
	FHitBox Box;
	Box.Id = Id;
	Box.Min = P;
	Box.Max = P + S;
	Box.bCategory = bCategory;
	Boxes.Add(Box);
}

bool AAetherisHUD::Hit(const FVector2D& Mouse, FName& OutId, bool& bCategory) const
{
	for (int32 I = Boxes.Num() - 1; I >= 0; --I)
	{
		const FHitBox& B = Boxes[I];
		if (Mouse.X >= B.Min.X && Mouse.X <= B.Max.X && Mouse.Y >= B.Min.Y && Mouse.Y <= B.Max.Y)
		{
			OutId = B.Id;
			bCategory = B.bCategory;
			return true;
		}
	}
	return false;
}

void AAetherisHUD::DrawHUD()
{
	Super::DrawHUD();
	Boxes.Reset();
	AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
	if (!Vale || !Canvas || !GEngine) return;

	const FCityStats S = Vale->Sim.Stats();
	DrawBox(FVector2D(0.f, 0.f), FVector2D(Canvas->SizeX, 56.f), FLinearColor(0.04f, 0.05f, 0.07f, 0.72f));
	const FString Top = FString::Printf(
		TEXT("AETHERIS    %s    $%s    Souls %d    Power %d / %d    Water %d / %d    %s"),
		*S.Era,
		*FText::AsNumber(S.Money).ToString(),
		S.Population,
		S.PowerSupply, S.PowerDemand,
		S.WaterSupply, S.WaterDemand,
		Vale->bPaused ? TEXT("Paused") : TEXT("Live"));
	FCanvasTextItem Title(FVector2D(24.f, 16.f), FText::FromString(Top), GEngine->GetSmallFont(), FLinearColor(1.f, 0.93f, 0.74f));
	Title.EnableShadow(FLinearColor(0, 0, 0, 0.65f));
	Canvas->DrawItem(Title);

	const float DockH = 132.f;
	const float DockY = Canvas->SizeY - DockH;
	DrawBox(FVector2D(0.f, DockY), FVector2D(Canvas->SizeX, DockH), FLinearColor(0.05f, 0.055f, 0.07f, 0.82f));

	float CX = 20.f;
	const float CY = DockY + 12.f;
	for (const FToolCategory& Cat : AetherisCatalog::Categories())
	{
		const bool bOn = OpenCategory == Cat.Id;
		const FVector2D P(CX, CY);
		const FVector2D Sz(86.f, 28.f);
		DrawBox(P, Sz, bOn ? FLinearColor(0.72f, 0.55f, 0.18f, 0.95f) : FLinearColor(0.12f, 0.13f, 0.16f, 0.9f));
		FCanvasTextItem Lab(P + FVector2D(10.f, 6.f), FText::FromString(Cat.Label), GEngine->GetSmallFont(), FLinearColor::White);
		Canvas->DrawItem(Lab);
		AddBox(Cat.Id, P, Sz, true);
		CX += 92.f;
	}

	float TX = 20.f;
	const float TY = DockY + 52.f;
	for (const FToolCategory& Cat : AetherisCatalog::Categories())
	{
		if (Cat.Id != OpenCategory) continue;
		for (const FName& Tool : Cat.Tools)
		{
			const FBuildingDef* Def = AetherisCatalog::Find(Tool);
			const FString Label = Tool == TEXT("bulldoze") ? TEXT("Raze") : (Def ? Def->Name : Tool.ToString());
			const int32 Cost = Def ? Def->Cost : 0;
			const bool bSel = (Tool == TEXT("bulldoze") && Vale->bRazeMode) || (!Vale->bRazeMode && Vale->CurrentTool == Tool);
			const FVector2D P(TX, TY);
			const FVector2D Sz(150.f, 64.f);
			DrawBox(P, Sz, bSel ? FLinearColor(0.18f, 0.42f, 0.4f, 0.95f) : FLinearColor(0.1f, 0.11f, 0.14f, 0.92f));
			FCanvasTextItem Name(P + FVector2D(10.f, 10.f), FText::FromString(Label), GEngine->GetSmallFont(), FLinearColor(0.95f, 0.93f, 0.88f));
			Canvas->DrawItem(Name);
			if (Cost > 0)
			{
				FCanvasTextItem Price(P + FVector2D(10.f, 34.f), FText::FromString(FString::Printf(TEXT("$%d"), Cost)), GEngine->GetSmallFont(), FLinearColor(0.82f, 0.7f, 0.32f));
				Canvas->DrawItem(Price);
			}
			AddBox(Tool, P, Sz, false);
			TX += 158.f;
		}
	}

	FCanvasTextItem Hint(
		FVector2D(24.f, DockY - 28.f),
		FText::FromString(Vale->LastMessage),
		GEngine->GetSmallFont(),
		FLinearColor(0.82f, 0.86f, 0.9f));
	Hint.EnableShadow(FLinearColor::Black);
	Canvas->DrawItem(Hint);

	FCanvasTextItem Keys(
		FVector2D(Canvas->SizeX - 620.f, 18.f),
		FText::FromString(TEXT("WASD pan  ·  Q/E rotate  ·  RMB orbit  ·  MMB pan  ·  Wheel zoom  ·  X raze")),
		GEngine->GetSmallFont(),
		FLinearColor(0.65f, 0.68f, 0.72f));
	Canvas->DrawItem(Keys);

	if (APlayerController* PC = GetOwningPlayerController())
	{
		float MX = 0.f, MY = 0.f;
		if (PC->GetMousePosition(MX, MY))
		{
			FName Id;
			bool bCategory = false;
			const FName Next = Hit(FVector2D(MX, MY), Id, bCategory) ? Id : NAME_None;
			if (!Next.IsNone() && Next != Hovered)
			{
				Vale->Audio.Play(TEXT("ui_hover"), 0.28f);
			}
			Hovered = Next;
		}
	}
}

bool AAetherisHUD::ConsumeClick()
{
	APlayerController* PC = GetOwningPlayerController();
	AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
	if (!PC || !Vale) return false;
	float MX, MY;
	if (!PC->GetMousePosition(MX, MY)) return false;
	FName Id;
	bool bCategory = false;
	if (!Hit(FVector2D(MX, MY), Id, bCategory)) return false;
	if (bCategory)
	{
		OpenCategory = Id;
		if (Id == TEXT("raze")) Vale->SetTool(TEXT("bulldoze"));
		return true;
	}
	Vale->SetTool(Id);
	return true;
}
