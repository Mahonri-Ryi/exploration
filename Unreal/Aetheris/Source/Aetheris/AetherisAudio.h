#pragma once

#include "CoreMinimal.h"

class USoundWave;
class UAudioComponent;
class UWorld;

class FAetherisAudio
{
public:
	void Init(UWorld* World);
	void Play(FName Name, float Volume = 1.f);
	void SetDayNight(float Night);
	void SetVolumes(float InMaster, float InSfx, float InAmbient);

private:
	TWeakObjectPtr<UWorld> WorldPtr;
	TObjectPtr<UAudioComponent> DayLoop = nullptr;
	TObjectPtr<UAudioComponent> NightLoop = nullptr;
	float NightBlend = 0.f;
	float Master = 1.f;
	float Sfx = 1.f;
	float Ambient = 0.85f;
};
