#include "AetherisSettings.h"
#include "Aetheris.h"
#include "AetherisAudio.h"
#include "GameFramework/InputSettings.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerInput.h"
#include "GameFramework/GameUserSettings.h"
#include "Engine/Engine.h"
#include "HAL/FileManager.h"
#include "Misc/ConfigCacheIni.h"
#include "Misc/Paths.h"

FAetherisSettings& FAetherisSettings::Get()
{
	static FAetherisSettings Inst;
	if (!Inst.BindList.Num()) Inst.InitBinds();
	return Inst;
}

void FAetherisSettings::InitBinds()
{
	BindList.Reset();
	auto Act = [this](const TCHAR* Id, const TCHAR* Label, const TCHAR* Map, const FKey& Key)
	{
		FAetherisBind B;
		B.Id = Id;
		B.Label = Label;
		B.Mapping = Map;
		B.Default = Key;
		B.Current = Key;
		BindList.Add(B);
	};
	auto Axis = [this](const TCHAR* Id, const TCHAR* Label, const TCHAR* Map, float Scale, const FKey& Key)
	{
		FAetherisBind B;
		B.Id = Id;
		B.Label = Label;
		B.Mapping = Map;
		B.AxisScale = Scale;
		B.Default = Key;
		B.Current = Key;
		BindList.Add(B);
	};
	Axis(TEXT("pan_fwd"), TEXT("Pan forward"), TEXT("MoveForward"), 1.f, EKeys::W);
	Axis(TEXT("pan_back"), TEXT("Pan back"), TEXT("MoveForward"), -1.f, EKeys::S);
	Axis(TEXT("pan_right"), TEXT("Pan right"), TEXT("MoveRight"), 1.f, EKeys::D);
	Axis(TEXT("pan_left"), TEXT("Pan left"), TEXT("MoveRight"), -1.f, EKeys::A);
	Act(TEXT("rot_left"), TEXT("Rotate left"), TEXT("RotateLeft"), EKeys::Q);
	Act(TEXT("rot_right"), TEXT("Rotate right"), TEXT("RotateRight"), EKeys::E);
	Act(TEXT("reset_cam"), TEXT("Reset camera"), TEXT("ResetCamera"), EKeys::R);
	Act(TEXT("orbit"), TEXT("Orbit camera"), TEXT("Raze"), EKeys::RightMouseButton);
	Act(TEXT("drag_pan"), TEXT("Drag pan"), TEXT("OrbitHold"), EKeys::MiddleMouseButton);
	Act(TEXT("place"), TEXT("Place / paint"), TEXT("Place"), EKeys::LeftMouseButton);
	Act(TEXT("pause"), TEXT("Pause"), TEXT("Pause"), EKeys::SpaceBar);
	Act(TEXT("raze"), TEXT("Raze tool"), TEXT("RazeHotkey"), EKeys::X);
	Act(TEXT("tool1"), TEXT("Avenue"), TEXT("Tool1"), EKeys::One);
	Act(TEXT("tool2"), TEXT("Cottage"), TEXT("Tool2"), EKeys::Two);
	Act(TEXT("tool3"), TEXT("Windmill"), TEXT("Tool3"), EKeys::Three);
	Act(TEXT("tool4"), TEXT("Water tower"), TEXT("Tool4"), EKeys::Four);
	Act(TEXT("tool5"), TEXT("Boutique"), TEXT("Tool5"), EKeys::Five);
	Act(TEXT("tool6"), TEXT("Park"), TEXT("Tool6"), EKeys::Six);
	Act(TEXT("tool7"), TEXT("Workshop"), TEXT("Tool7"), EKeys::Seven);
	Act(TEXT("menu"), TEXT("Settings menu"), TEXT("Settings"), EKeys::Escape);
}

FString FAetherisSettings::ConfigPath() const
{
	return FPaths::ProjectSavedDir() / TEXT("Config/AetherisUser.ini");
}

FAetherisBind* FAetherisSettings::FindBind(FName Id)
{
	for (FAetherisBind& B : BindList) if (B.Id == Id) return &B;
	return nullptr;
}

const FAetherisBind* FAetherisSettings::FindBind(FName Id) const
{
	for (const FAetherisBind& B : BindList) if (B.Id == Id) return &B;
	return nullptr;
}

void FAetherisSettings::Load()
{
	InitBinds();
	const FString Path = ConfigPath();
	if (!FPaths::FileExists(Path)) return;
	GConfig->LoadFile(Path);
	GConfig->GetInt(TEXT("Aetheris"), TEXT("Quality"), Quality, Path);
	GConfig->GetInt(TEXT("Aetheris"), TEXT("WindowMode"), WindowMode, Path);
	GConfig->GetInt(TEXT("Aetheris"), TEXT("FpsCap"), FpsCap, Path);
	GConfig->GetFloat(TEXT("Aetheris"), TEXT("ResScale"), ResScale, Path);
	GConfig->GetBool(TEXT("Aetheris"), TEXT("VSync"), bVSync, Path);
	GConfig->GetFloat(TEXT("Aetheris"), TEXT("Master"), Master, Path);
	GConfig->GetFloat(TEXT("Aetheris"), TEXT("Sfx"), Sfx, Path);
	GConfig->GetFloat(TEXT("Aetheris"), TEXT("Ambient"), Ambient, Path);
	GConfig->GetFloat(TEXT("Aetheris"), TEXT("Sensitivity"), Sensitivity, Path);
	GConfig->GetBool(TEXT("Aetheris"), TEXT("EdgeScroll"), bEdgeScroll, Path);
	GConfig->GetBool(TEXT("Aetheris"), TEXT("InvertY"), bInvertY, Path);
	GConfig->GetBool(TEXT("Aetheris"), TEXT("ShowFps"), bShowFps, Path);
	Quality = FMath::Clamp(Quality, 0, 3);
	WindowMode = FMath::Clamp(WindowMode, 0, 2);
	ResScale = FMath::Clamp(ResScale, 0.5f, 1.f);
	Master = FMath::Clamp(Master, 0.f, 1.f);
	Sfx = FMath::Clamp(Sfx, 0.f, 1.f);
	Ambient = FMath::Clamp(Ambient, 0.f, 1.f);
	Sensitivity = FMath::Clamp(Sensitivity, 0.4f, 2.5f);
	for (FAetherisBind& B : BindList)
	{
		FString KeyName;
		if (GConfig->GetString(TEXT("AetherisBinds"), *B.Id.ToString(), KeyName, Path) && !KeyName.IsEmpty())
		{
			const FKey Key(*KeyName);
			if (Key.IsValid()) B.Current = Key;
		}
	}
}

void FAetherisSettings::Save() const
{
	const FString Path = ConfigPath();
	IFileManager::Get().MakeDirectory(*FPaths::GetPath(Path), true);
	GConfig->SetInt(TEXT("Aetheris"), TEXT("Quality"), Quality, Path);
	GConfig->SetInt(TEXT("Aetheris"), TEXT("WindowMode"), WindowMode, Path);
	GConfig->SetInt(TEXT("Aetheris"), TEXT("FpsCap"), FpsCap, Path);
	GConfig->SetFloat(TEXT("Aetheris"), TEXT("ResScale"), ResScale, Path);
	GConfig->SetBool(TEXT("Aetheris"), TEXT("VSync"), bVSync, Path);
	GConfig->SetFloat(TEXT("Aetheris"), TEXT("Master"), Master, Path);
	GConfig->SetFloat(TEXT("Aetheris"), TEXT("Sfx"), Sfx, Path);
	GConfig->SetFloat(TEXT("Aetheris"), TEXT("Ambient"), Ambient, Path);
	GConfig->SetFloat(TEXT("Aetheris"), TEXT("Sensitivity"), Sensitivity, Path);
	GConfig->SetBool(TEXT("Aetheris"), TEXT("EdgeScroll"), bEdgeScroll, Path);
	GConfig->SetBool(TEXT("Aetheris"), TEXT("InvertY"), bInvertY, Path);
	GConfig->SetBool(TEXT("Aetheris"), TEXT("ShowFps"), bShowFps, Path);
	for (const FAetherisBind& B : BindList)
	{
		GConfig->SetString(TEXT("AetherisBinds"), *B.Id.ToString(), *B.Current.ToString(), Path);
	}
	GConfig->Flush(false, Path);
}

void FAetherisSettings::ResetDefaults()
{
	Quality = 3;
	WindowMode = 1;
	FpsCap = 0;
	ResScale = 1.f;
	bVSync = true;
	Master = 1.f;
	Sfx = 1.f;
	Ambient = 0.85f;
	Sensitivity = 1.f;
	bEdgeScroll = true;
	bInvertY = false;
	bShowFps = false;
	InitBinds();
}

void FAetherisSettings::ApplyGraphics() const
{
	if (!GEngine) return;
	if (UGameUserSettings* User = GEngine->GetGameUserSettings())
	{
		User->SetOverallScalabilityLevel(Quality);
		User->SetVSyncEnabled(bVSync);
		User->SetResolutionScaleNormalized(ResScale);
		const EWindowMode::Type Mode = WindowMode == 0 ? EWindowMode::Windowed : (WindowMode == 2 ? EWindowMode::Fullscreen : EWindowMode::WindowedFullscreen);
		User->SetFullscreenMode(Mode);
		User->ApplySettings(false);
	}
	GEngine->Exec(nullptr, *FString::Printf(TEXT("t.MaxFPS %d"), FpsCap));
}

void FAetherisSettings::ApplyAudio(FAetherisAudio& Audio) const
{
	Audio.SetVolumes(Master, Sfx, Ambient);
}

void FAetherisSettings::ApplyBindings(APlayerController* PC) const
{
	UInputSettings* Input = GetMutableDefault<UInputSettings>();
	if (!Input) return;

	TSet<FName> Ours;
	for (const FAetherisBind& B : BindList) Ours.Add(B.Mapping);

	TArray<FInputActionKeyMapping> Actions = Input->GetActionMappings();
	for (const FInputActionKeyMapping& Map : Actions)
	{
		if (Ours.Contains(Map.ActionName)) Input->RemoveActionMapping(Map, false);
	}
	TArray<FInputAxisKeyMapping> Axes = Input->GetAxisMappings();
	for (const FInputAxisKeyMapping& Map : Axes)
	{
		if (Ours.Contains(Map.AxisName) && Map.Key.IsValid() && !Map.Key.IsAnalog() && Map.Key != EKeys::MouseWheelAxis)
		{
			Input->RemoveAxisMapping(Map, false);
		}
	}
	for (const FAetherisBind& B : BindList)
	{
		if (B.AxisScale != 0.f)
		{
			Input->AddAxisMapping(FInputAxisKeyMapping(B.Mapping, B.Current, B.AxisScale), false);
		}
		else
		{
			Input->AddActionMapping(FInputActionKeyMapping(B.Mapping, B.Current), false);
		}
	}
	Input->AddActionMapping(FInputActionKeyMapping(TEXT("Settings"), EKeys::F10), false);
	Input->SaveKeyMappings();
	if (PC && PC->PlayerInput)
	{
		PC->PlayerInput->ForceRebuildingKeyMaps(true);
	}
	UE_LOG(LogAetheris, Log, TEXT("Applied %d key bindings"), BindList.Num());
}

void FAetherisSettings::CaptureBind(FName Id, const FKey& Key)
{
	if (FAetherisBind* B = FindBind(Id))
	{
		B->Current = Key;
	}
}
