#include "AetherisHUD.h"
#include "AetherisSettings.h"
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

void AAetherisHUD::AddBox(FName Id, const FVector2D& P, const FVector2D& S, EBoxKind Kind)
{
	FHitBox Box;
	Box.Id = Id;
	Box.Min = P;
	Box.Max = P + S;
	Box.Kind = Kind;
	Boxes.Add(Box);
}

bool AAetherisHUD::Hit(const FVector2D& Mouse, FName& OutId, EBoxKind& OutKind) const
{
	for (int32 I = Boxes.Num() - 1; I >= 0; --I)
	{
		const FHitBox& B = Boxes[I];
		if (Mouse.X >= B.Min.X && Mouse.X <= B.Max.X && Mouse.Y >= B.Min.Y && Mouse.Y <= B.Max.Y)
		{
			OutId = B.Id;
			OutKind = B.Kind;
			return true;
		}
	}
	return false;
}

void AAetherisHUD::DrawLabel(const FVector2D& P, const FString& Text, const FLinearColor& Color)
{
	FCanvasTextItem Item(P, FText::FromString(Text), GEngine->GetSmallFont(), Color);
	Item.EnableShadow(FLinearColor(0, 0, 0, 0.55f));
	Canvas->DrawItem(Item);
}

void AAetherisHUD::ToggleSettings()
{
	if (CancelListen()) return;
	bSettingsOpen = !bSettingsOpen;
	if (AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass())))
	{
		Vale->Audio.Play(TEXT("ui_click"), 0.55f);
		Vale->LastMessage = bSettingsOpen ? TEXT("Settings — graphics, sound, and key bindings.") : TEXT("The vale lives.");
	}
}

bool AAetherisHUD::CancelListen()
{
	if (ListeningBind.IsNone()) return false;
	ListeningBind = NAME_None;
	return true;
}

void AAetherisHUD::CaptureKey(const FKey& Key)
{
	if (ListeningBind.IsNone()) return;
	FAetherisSettings& S = FAetherisSettings::Get();
	S.CaptureBind(ListeningBind, Key);
	S.Save();
	if (APlayerController* PC = GetOwningPlayerController()) S.ApplyBindings(PC);
	ListeningBind = NAME_None;
	if (AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass())))
	{
		Vale->Audio.Play(TEXT("ui_click"), 0.5f);
	}
}

void AAetherisHUD::DrawChoice(const FVector2D& P, const FString& Label, const TArray<TPair<FName, FString>>& Choices, FName Selected)
{
	DrawLabel(P, Label, FLinearColor(0.82f, 0.84f, 0.88f));
	float X = P.X + 210.f;
	for (const TPair<FName, FString>& C : Choices)
	{
		const bool bOn = C.Key == Selected;
		const FVector2D Btn(X, P.Y - 4.f);
		const FVector2D Sz(88.f, 26.f);
		DrawBox(Btn, Sz, bOn ? FLinearColor(0.72f, 0.55f, 0.18f, 0.95f) : FLinearColor(0.12f, 0.13f, 0.16f, 0.92f));
		DrawLabel(Btn + FVector2D(10.f, 5.f), C.Value, FLinearColor::White);
		AddBox(C.Key, Btn, Sz, EBoxKind::Setting);
		X += 94.f;
	}
}

void AAetherisHUD::DrawStepper(const FVector2D& P, const FString& Label, const FString& Value, FName DownId, FName UpId)
{
	DrawLabel(P, Label, FLinearColor(0.82f, 0.84f, 0.88f));
	const FVector2D Down(P.X + 210.f, P.Y - 4.f);
	const FVector2D Up(P.X + 360.f, P.Y - 4.f);
	DrawBox(Down, FVector2D(36.f, 26.f), FLinearColor(0.14f, 0.15f, 0.18f, 0.95f));
	DrawBox(Up, FVector2D(36.f, 26.f), FLinearColor(0.14f, 0.15f, 0.18f, 0.95f));
	DrawLabel(Down + FVector2D(12.f, 5.f), TEXT("-"), FLinearColor::White);
	DrawLabel(Up + FVector2D(12.f, 5.f), TEXT("+"), FLinearColor::White);
	DrawLabel(FVector2D(P.X + 258.f, P.Y), Value, FLinearColor(1.f, 0.93f, 0.74f));
	AddBox(DownId, Down, FVector2D(36.f, 26.f), EBoxKind::Setting);
	AddBox(UpId, Up, FVector2D(36.f, 26.f), EBoxKind::Setting);
}

void AAetherisHUD::DrawToggle(const FVector2D& P, const FString& Label, bool bOn, FName Id)
{
	DrawLabel(P, Label, FLinearColor(0.82f, 0.84f, 0.88f));
	const FVector2D Btn(P.X + 210.f, P.Y - 4.f);
	DrawBox(Btn, FVector2D(88.f, 26.f), bOn ? FLinearColor(0.18f, 0.42f, 0.4f, 0.95f) : FLinearColor(0.12f, 0.13f, 0.16f, 0.92f));
	DrawLabel(Btn + FVector2D(18.f, 5.f), bOn ? TEXT("On") : TEXT("Off"), FLinearColor::White);
	AddBox(Id, Btn, FVector2D(88.f, 26.f), EBoxKind::Setting);
}

void AAetherisHUD::DrawSettings()
{
	FAetherisSettings& S = FAetherisSettings::Get();
	const float W = 920.f;
	const float H = 640.f;
	const float X = (Canvas->SizeX - W) * 0.5f;
	const float Y = (Canvas->SizeY - H) * 0.5f - 10.f;
	DrawBox(FVector2D(0.f, 0.f), FVector2D(Canvas->SizeX, Canvas->SizeY), FLinearColor(0.02f, 0.02f, 0.03f, 0.62f));
	AddBox(TEXT("set_backdrop"), FVector2D(0.f, 0.f), FVector2D(Canvas->SizeX, Canvas->SizeY), EBoxKind::Setting);
	DrawBox(FVector2D(X, Y), FVector2D(W, H), FLinearColor(0.06f, 0.07f, 0.09f, 0.96f));
	AddBox(TEXT("set_panel"), FVector2D(X, Y), FVector2D(W, H), EBoxKind::Setting);
	DrawLabel(FVector2D(X + 24.f, Y + 18.f), TEXT("SETTINGS"), FLinearColor(1.f, 0.93f, 0.74f));
	DrawLabel(FVector2D(X + 24.f, Y + 40.f), TEXT("Esc or F10 closes  ·  click a key then press a new one to rebind"), FLinearColor(0.6f, 0.63f, 0.68f));

	const FVector2D Close(X + W - 110.f, Y + 16.f);
	DrawBox(Close, FVector2D(86.f, 28.f), FLinearColor(0.28f, 0.14f, 0.12f, 0.95f));
	DrawLabel(Close + FVector2D(22.f, 6.f), TEXT("Close"), FLinearColor::White);
	AddBox(TEXT("set_close"), Close, FVector2D(86.f, 28.f), EBoxKind::Setting);

	const TPair<FName, FString> Tabs[] = {
		{ TEXT("graphics"), TEXT("Graphics") },
		{ TEXT("sound"), TEXT("Sound") },
		{ TEXT("controls"), TEXT("Controls") },
		{ TEXT("game"), TEXT("Game") },
	};
	float TX = X + 24.f;
	for (const TPair<FName, FString>& Tab : Tabs)
	{
		const bool bOn = SettingsTab == Tab.Key;
		const FVector2D P(TX, Y + 68.f);
		DrawBox(P, FVector2D(120.f, 30.f), bOn ? FLinearColor(0.72f, 0.55f, 0.18f, 0.95f) : FLinearColor(0.11f, 0.12f, 0.15f, 0.95f));
		DrawLabel(P + FVector2D(18.f, 7.f), Tab.Value, FLinearColor::White);
		AddBox(FName(*FString::Printf(TEXT("tab_%s"), *Tab.Key.ToString())), P, FVector2D(120.f, 30.f), EBoxKind::Setting);
		TX += 128.f;
	}

	float RY = Y + 120.f;
	const float LX = X + 36.f;
	if (SettingsTab == TEXT("graphics"))
	{
		DrawChoice(FVector2D(LX, RY), TEXT("Quality"), {
			{ TEXT("qual_0"), TEXT("Low") }, { TEXT("qual_1"), TEXT("Medium") }, { TEXT("qual_2"), TEXT("High") }, { TEXT("qual_3"), TEXT("Epic") }
		}, FName(*FString::Printf(TEXT("qual_%d"), S.Quality)));
		RY += 44.f;
		DrawChoice(FVector2D(LX, RY), TEXT("Window"), {
			{ TEXT("win_0"), TEXT("Windowed") }, { TEXT("win_1"), TEXT("Borderless") }, { TEXT("win_2"), TEXT("Fullscreen") }
		}, FName(*FString::Printf(TEXT("win_%d"), S.WindowMode)));
		RY += 44.f;
		DrawStepper(FVector2D(LX, RY), TEXT("Resolution scale"), FString::Printf(TEXT("%d%%"), FMath::RoundToInt(S.ResScale * 100.f)), TEXT("res_down"), TEXT("res_up"));
		RY += 44.f;
		DrawToggle(FVector2D(LX, RY), TEXT("Vertical sync"), S.bVSync, TEXT("vsync"));
		RY += 44.f;
		const int32 CapSel = S.FpsCap == 30 ? 0 : (S.FpsCap == 60 ? 1 : (S.FpsCap == 120 ? 2 : 3));
		DrawChoice(FVector2D(LX, RY), TEXT("Frame cap"), {
			{ TEXT("fps_30"), TEXT("30") }, { TEXT("fps_60"), TEXT("60") }, { TEXT("fps_120"), TEXT("120") }, { TEXT("fps_0"), TEXT("Unlimited") }
		}, CapSel == 0 ? TEXT("fps_30") : (CapSel == 1 ? TEXT("fps_60") : (CapSel == 2 ? TEXT("fps_120") : TEXT("fps_0"))));
		RY += 56.f;
		DrawLabel(FVector2D(LX, RY), TEXT("Quality drives shadows, view distance, effects, and textures through Unreal scalability."), FLinearColor(0.55f, 0.58f, 0.62f));
	}
	else if (SettingsTab == TEXT("sound"))
	{
		DrawStepper(FVector2D(LX, RY), TEXT("Master"), FString::Printf(TEXT("%d%%"), FMath::RoundToInt(S.Master * 100.f)), TEXT("master_down"), TEXT("master_up"));
		RY += 44.f;
		DrawStepper(FVector2D(LX, RY), TEXT("Effects"), FString::Printf(TEXT("%d%%"), FMath::RoundToInt(S.Sfx * 100.f)), TEXT("sfx_down"), TEXT("sfx_up"));
		RY += 44.f;
		DrawStepper(FVector2D(LX, RY), TEXT("Ambience"), FString::Printf(TEXT("%d%%"), FMath::RoundToInt(S.Ambient * 100.f)), TEXT("amb_down"), TEXT("amb_up"));
		RY += 52.f;
		DrawToggle(FVector2D(LX, RY), TEXT("Mute master"), S.Master <= 0.01f, TEXT("mute"));
		RY += 48.f;
		DrawLabel(FVector2D(LX, RY), TEXT("Ambience is the day/night bed. Effects are placement, UI, and construction."), FLinearColor(0.55f, 0.58f, 0.62f));
	}
	else if (SettingsTab == TEXT("controls"))
	{
		DrawStepper(FVector2D(LX, RY), TEXT("Orbit sensitivity"), FString::Printf(TEXT("%.1fx"), S.Sensitivity), TEXT("sens_down"), TEXT("sens_up"));
		RY += 40.f;
		DrawToggle(FVector2D(LX, RY), TEXT("Invert orbit Y"), S.bInvertY, TEXT("inverty"));
		RY += 40.f;
		const TArray<FAetherisBind>& Binds = S.Binds();
		const int32 Mid = (Binds.Num() + 1) / 2;
		for (int32 I = 0; I < Binds.Num(); ++I)
		{
			const FAetherisBind& B = Binds[I];
			const float Col = I < Mid ? 0.f : 430.f;
			const float Row = I < Mid ? float(I) : float(I - Mid);
			const FVector2D P(LX + Col, RY + Row * 28.f);
			DrawLabel(P, B.Label, FLinearColor(0.8f, 0.82f, 0.86f));
			const FVector2D Btn(P.X + 150.f, P.Y - 3.f);
			const bool bListen = ListeningBind == B.Id;
			DrawBox(Btn, FVector2D(150.f, 24.f), bListen ? FLinearColor(0.72f, 0.55f, 0.18f, 0.95f) : FLinearColor(0.12f, 0.13f, 0.16f, 0.95f));
			DrawLabel(Btn + FVector2D(8.f, 4.f), bListen ? TEXT("Press a key…") : B.Current.GetDisplayName().ToString(), FLinearColor::White);
			AddBox(FName(*FString::Printf(TEXT("bind_%s"), *B.Id.ToString())), Btn, FVector2D(150.f, 24.f), EBoxKind::Setting);
		}
	}
	else
	{
		DrawToggle(FVector2D(LX, RY), TEXT("Edge scroll"), S.bEdgeScroll, TEXT("edgescroll"));
		RY += 44.f;
		DrawToggle(FVector2D(LX, RY), TEXT("Show FPS"), S.bShowFps, TEXT("showfps"));
		RY += 56.f;
		const FVector2D Reset(LX, RY);
		DrawBox(Reset, FVector2D(200.f, 32.f), FLinearColor(0.32f, 0.16f, 0.12f, 0.95f));
		DrawLabel(Reset + FVector2D(28.f, 8.f), TEXT("Reset all defaults"), FLinearColor::White);
		AddBox(TEXT("reset_all"), Reset, FVector2D(200.f, 32.f), EBoxKind::Setting);
		RY += 48.f;
		DrawLabel(FVector2D(LX, RY), TEXT("Settings save to Saved/Config/AetherisUser.ini and apply immediately."), FLinearColor(0.55f, 0.58f, 0.62f));
	}
}

void AAetherisHUD::HandleSetting(FName Id)
{
	FAetherisSettings& S = FAetherisSettings::Get();
	AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
	APlayerController* PC = GetOwningPlayerController();
	const FString IdStr = Id.ToString();

	if (Id == TEXT("set_panel")) return;
	if (Id == TEXT("set_backdrop") || Id == TEXT("set_close"))
	{
		if (!ListeningBind.IsNone()) { ListeningBind = NAME_None; return; }
		bSettingsOpen = false;
		if (Vale) Vale->LastMessage = TEXT("The vale lives.");
		return;
	}
	if (IdStr.StartsWith(TEXT("tab_")))
	{
		SettingsTab = FName(*IdStr.RightChop(4));
		ListeningBind = NAME_None;
		if (Vale) Vale->Audio.Play(TEXT("ui_click"), 0.4f);
		return;
	}
	if (IdStr.StartsWith(TEXT("bind_")))
	{
		ListeningBind = FName(*IdStr.RightChop(5));
		if (Vale) Vale->Audio.Play(TEXT("ui_click"), 0.4f);
		return;
	}

	auto Step = [](float& V, int32 Dir, float Lo, float Hi, float Amt)
	{
		V = FMath::Clamp(V + Dir * Amt, Lo, Hi);
	};

	if (Id == TEXT("qual_0") || Id == TEXT("qual_1") || Id == TEXT("qual_2") || Id == TEXT("qual_3"))
	{
		S.Quality = FCString::Atoi(*IdStr.RightChop(5));
		S.ApplyGraphics();
	}
	else if (Id == TEXT("win_0") || Id == TEXT("win_1") || Id == TEXT("win_2"))
	{
		S.WindowMode = FCString::Atoi(*IdStr.RightChop(4));
		S.ApplyGraphics();
	}
	else if (Id == TEXT("res_down")) { Step(S.ResScale, -1, 0.5f, 1.f, 0.1f); S.ApplyGraphics(); }
	else if (Id == TEXT("res_up")) { Step(S.ResScale, 1, 0.5f, 1.f, 0.1f); S.ApplyGraphics(); }
	else if (Id == TEXT("vsync")) { S.bVSync = !S.bVSync; S.ApplyGraphics(); }
	else if (Id == TEXT("fps_30")) { S.FpsCap = 30; S.ApplyGraphics(); }
	else if (Id == TEXT("fps_60")) { S.FpsCap = 60; S.ApplyGraphics(); }
	else if (Id == TEXT("fps_120")) { S.FpsCap = 120; S.ApplyGraphics(); }
	else if (Id == TEXT("fps_0")) { S.FpsCap = 0; S.ApplyGraphics(); }
	else if (Id == TEXT("master_down")) { Step(S.Master, -1, 0.f, 1.f, 0.1f); if (Vale) S.ApplyAudio(Vale->Audio); }
	else if (Id == TEXT("master_up")) { Step(S.Master, 1, 0.f, 1.f, 0.1f); if (Vale) S.ApplyAudio(Vale->Audio); }
	else if (Id == TEXT("sfx_down")) { Step(S.Sfx, -1, 0.f, 1.f, 0.1f); if (Vale) S.ApplyAudio(Vale->Audio); }
	else if (Id == TEXT("sfx_up")) { Step(S.Sfx, 1, 0.f, 1.f, 0.1f); if (Vale) S.ApplyAudio(Vale->Audio); }
	else if (Id == TEXT("amb_down")) { Step(S.Ambient, -1, 0.f, 1.f, 0.1f); if (Vale) S.ApplyAudio(Vale->Audio); }
	else if (Id == TEXT("amb_up")) { Step(S.Ambient, 1, 0.f, 1.f, 0.1f); if (Vale) S.ApplyAudio(Vale->Audio); }
	else if (Id == TEXT("mute"))
	{
		S.Master = S.Master <= 0.01f ? 1.f : 0.f;
		if (Vale) S.ApplyAudio(Vale->Audio);
	}
	else if (Id == TEXT("sens_down")) Step(S.Sensitivity, -1, 0.4f, 2.5f, 0.1f);
	else if (Id == TEXT("sens_up")) Step(S.Sensitivity, 1, 0.4f, 2.5f, 0.1f);
	else if (Id == TEXT("inverty")) S.bInvertY = !S.bInvertY;
	else if (Id == TEXT("edgescroll")) S.bEdgeScroll = !S.bEdgeScroll;
	else if (Id == TEXT("showfps")) S.bShowFps = !S.bShowFps;
	else if (Id == TEXT("reset_all"))
	{
		S.ResetDefaults();
		S.ApplyGraphics();
		if (Vale) S.ApplyAudio(Vale->Audio);
		if (PC) S.ApplyBindings(PC);
	}
	else return;

	S.Save();
	if (Vale) Vale->Audio.Play(TEXT("ui_click"), 0.4f);
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
	DrawLabel(FVector2D(24.f, 16.f), Top, FLinearColor(1.f, 0.93f, 0.74f));

	const FVector2D SetBtn(Canvas->SizeX - 118.f, 12.f);
	DrawBox(SetBtn, FVector2D(100.f, 32.f), bSettingsOpen ? FLinearColor(0.72f, 0.55f, 0.18f, 0.95f) : FLinearColor(0.14f, 0.15f, 0.18f, 0.92f));
	DrawLabel(SetBtn + FVector2D(16.f, 8.f), TEXT("Settings"), FLinearColor::White);
	AddBox(TEXT("set_open"), SetBtn, FVector2D(100.f, 32.f), EBoxKind::Setting);

	if (FAetherisSettings::Get().bShowFps)
	{
		const float Fps = 1.f / FMath::Max(0.0001f, GetWorld()->GetDeltaSeconds());
		DrawLabel(FVector2D(Canvas->SizeX - 220.f, 18.f), FString::Printf(TEXT("%d FPS"), FMath::RoundToInt(Fps)), FLinearColor(0.7f, 0.85f, 0.7f));
	}

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
		DrawLabel(P + FVector2D(10.f, 6.f), Cat.Label, FLinearColor::White);
		AddBox(Cat.Id, P, Sz, EBoxKind::Category);
		CX += 92.f;
	}

	float ToolX = 20.f;
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
			const FVector2D P(ToolX, TY);
			const FVector2D Sz(150.f, 64.f);
			DrawBox(P, Sz, bSel ? FLinearColor(0.18f, 0.42f, 0.4f, 0.95f) : FLinearColor(0.1f, 0.11f, 0.14f, 0.92f));
			DrawLabel(P + FVector2D(10.f, 10.f), Label, FLinearColor(0.95f, 0.93f, 0.88f));
			if (Cost > 0) DrawLabel(P + FVector2D(10.f, 34.f), FString::Printf(TEXT("$%d"), Cost), FLinearColor(0.82f, 0.7f, 0.32f));
			AddBox(Tool, P, Sz, EBoxKind::Tool);
			ToolX += 158.f;
		}
	}

	DrawLabel(FVector2D(24.f, DockY - 28.f), Vale->LastMessage, FLinearColor(0.82f, 0.86f, 0.9f));
	DrawLabel(FVector2D(24.f, 36.f), TEXT("Esc / F10 settings"), FLinearColor(0.55f, 0.58f, 0.62f));

	if (bSettingsOpen) DrawSettings();

	if (APlayerController* PC = GetOwningPlayerController())
	{
		float MX = 0.f, MY = 0.f;
		if (PC->GetMousePosition(MX, MY))
		{
			FName Id;
			EBoxKind Kind = EBoxKind::Category;
			const FName Next = Hit(FVector2D(MX, MY), Id, Kind) ? Id : NAME_None;
			if (!Next.IsNone() && Next != Hovered && Next != TEXT("set_backdrop"))
			{
				Vale->Audio.Play(TEXT("ui_hover"), 0.22f);
			}
			Hovered = Next;
		}
	}
}

bool AAetherisHUD::ConsumeClick()
{
	APlayerController* PC = GetOwningPlayerController();
	AAetherisWorld* Vale = Cast<AAetherisWorld>(UGameplayStatics::GetActorOfClass(this, AAetherisWorld::StaticClass()));
	if (!PC || !Vale) return bSettingsOpen;
	float MX, MY;
	if (!PC->GetMousePosition(MX, MY)) return bSettingsOpen;
	FName Id;
	EBoxKind Kind = EBoxKind::Category;
	if (!Hit(FVector2D(MX, MY), Id, Kind)) return bSettingsOpen;
	if (Kind == EBoxKind::Setting)
	{
		if (Id == TEXT("set_open")) ToggleSettings();
		else HandleSetting(Id);
		return true;
	}
	if (bSettingsOpen) return true;
	if (Kind == EBoxKind::Category)
	{
		OpenCategory = Id;
		if (Id == TEXT("raze")) Vale->SetTool(TEXT("bulldoze"));
		return true;
	}
	Vale->SetTool(Id);
	return true;
}
