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

private:
	TWeakObjectPtr<UWorld> WorldPtr;
	TObjectPtr<UAudioComponent> DayLoop = nullptr;
	TObjectPtr<UAudioComponent> NightLoop = nullptr;
};
