#include "AetherisAudio.h"
#include "AetherisAssets.h"
#include "Components/AudioComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundWave.h"

void FAetherisAudio::Init(UWorld* World)
{
	WorldPtr = World;
	if (!World) return;
	FAetherisAssets::Get().Load();
	FAetherisAssets::Get().Prime(TEXT("ambient_day"));
	if (USoundWave* Day = FAetherisAssets::Get().Sfx(TEXT("ambient_day")))
	{
		DayLoop = UGameplayStatics::SpawnSound2D(World, Day, 0.32f, 1.f, 0.f, nullptr, true, false);
		if (DayLoop) DayLoop->bIsUISound = true;
	}
	FAetherisAssets::Get().Prime(TEXT("ambient_night"));
	if (USoundWave* Night = FAetherisAssets::Get().Sfx(TEXT("ambient_night")))
	{
		NightLoop = UGameplayStatics::SpawnSound2D(World, Night, 0.f, 1.f, 0.f, nullptr, true, false);
		if (NightLoop) NightLoop->bIsUISound = true;
	}
	Play(TEXT("whoosh"), 0.85f);
}

void FAetherisAudio::Play(FName Name, float Volume)
{
	UWorld* World = WorldPtr.Get();
	USoundWave* Wave = FAetherisAssets::Get().Sfx(Name);
	if (!World || !Wave) return;
	FAetherisAssets::Get().Prime(Name);
	UGameplayStatics::PlaySound2D(World, Wave, Volume, 1.f, 0.f);
}

void FAetherisAudio::SetDayNight(float Night)
{
	const float N = FMath::Clamp(Night, 0.f, 1.f);
	if (DayLoop) DayLoop->SetVolumeMultiplier((1.f - N) * 0.34f);
	if (NightLoop) NightLoop->SetVolumeMultiplier(N * 0.3f);
}
