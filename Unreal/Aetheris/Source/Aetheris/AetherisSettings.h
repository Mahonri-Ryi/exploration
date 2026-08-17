#pragma once

#include "CoreMinimal.h"
#include "InputCoreTypes.h"

class APlayerController;
class FAetherisAudio;

struct FAetherisBind
{
	FName Id;
	FString Label;
	FName Mapping;
	float AxisScale = 0.f;
	FKey Default;
	FKey Current;
};

class FAetherisSettings
{
public:
	static FAetherisSettings& Get();

	void Load();
	void Save() const;
	void ResetDefaults();
	void ApplyGraphics() const;
	void ApplyAudio(FAetherisAudio& Audio) const;
	void ApplyBindings(APlayerController* PC) const;
	void CaptureBind(FName Id, const FKey& Key);

	const TArray<FAetherisBind>& Binds() const { return BindList; }
	FAetherisBind* FindBind(FName Id);
	const FAetherisBind* FindBind(FName Id) const;

	int32 Quality = 3;
	int32 WindowMode = 1;
	int32 FpsCap = 0;
	float ResScale = 1.f;
	bool bVSync = true;
	float Master = 1.f;
	float Sfx = 1.f;
	float Ambient = 0.85f;
	float Sensitivity = 1.f;
	bool bEdgeScroll = true;
	bool bInvertY = false;
	bool bShowFps = false;

private:
	TArray<FAetherisBind> BindList;
	void InitBinds();
	FString ConfigPath() const;
};
