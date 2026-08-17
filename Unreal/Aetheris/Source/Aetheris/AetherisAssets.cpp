#include "AetherisAssets.h"
#include "Aetheris.h"
#include "Audio.h"
#include "Engine/Texture2D.h"
#include "ImageUtils.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Sound/SoundWave.h"

FAetherisAssets& FAetherisAssets::Get()
{
	static FAetherisAssets Inst;
	return Inst;
}

void FAetherisAssets::Load()
{
	if (bLoaded) return;
	ContentRoot = FPaths::ProjectContentDir() / TEXT("Runtime");
	const FString TexDir = ContentRoot / TEXT("Textures");
	const FString AudDir = ContentRoot / TEXT("Audio");

	const TPair<FName, FString> TexFiles[] = {
		{ TEXT("grass"), TEXT("photo_grass.jpg") },
		{ TEXT("grassProc"), TEXT("grass.png") },
		{ TEXT("asphalt"), TEXT("photo_asphalt.jpg") },
		{ TEXT("asphaltProc"), TEXT("asphalt.png") },
		{ TEXT("brick"), TEXT("brick.png") },
		{ TEXT("plaster"), TEXT("plaster.png") },
		{ TEXT("stone"), TEXT("stone.png") },
		{ TEXT("roof"), TEXT("roof.png") },
		{ TEXT("sand"), TEXT("sand.png") },
		{ TEXT("water"), TEXT("water.png") },
		{ TEXT("windows"), TEXT("windows.png") },
	};
	for (const auto& Pair : TexFiles)
	{
		if (UTexture2D* T = LoadTextureFile(TexDir / Pair.Value))
		{
			Textures.Add(Pair.Key, T);
		}
	}

	const TCHAR* Waves[] = {
		TEXT("ui_click"), TEXT("ui_hover"), TEXT("place"), TEXT("construction"), TEXT("demolish"),
		TEXT("error"), TEXT("coin"), TEXT("unlock"), TEXT("whoosh"), TEXT("fire"),
		TEXT("ambient_day"), TEXT("ambient_night")
	};
	for (const TCHAR* Name : Waves)
	{
		if (USoundWave* S = LoadWavFile(AudDir / FString::Printf(TEXT("%s.wav"), Name)))
		{
			Sounds.Add(Name, S);
		}
	}
	bLoaded = true;
	UE_LOG(LogAetheris, Log, TEXT("Loaded %d textures and %d sounds from %s"), Textures.Num(), Sounds.Num(), *ContentRoot);
}

UTexture2D* FAetherisAssets::Tex(FName Name) const
{
	if (const TObjectPtr<UTexture2D>* Found = Textures.Find(Name)) return Found->Get();
	return nullptr;
}

USoundWave* FAetherisAssets::Sfx(FName Name) const
{
	if (const TObjectPtr<USoundWave>* Found = Sounds.Find(Name)) return Found->Get();
	return nullptr;
}

UTexture2D* FAetherisAssets::LoadTextureFile(const FString& Path)
{
	if (!FPaths::FileExists(Path))
	{
		UE_LOG(LogAetheris, Warning, TEXT("Missing texture %s"), *Path);
		return nullptr;
	}
	UTexture2D* Tex2D = FImageUtils::ImportFileAsTexture2D(Path);
	if (Tex2D)
	{
		Tex2D->AddToRoot();
		Tex2D->SRGB = true;
		Tex2D->UpdateResource();
	}
	return Tex2D;
}

USoundWave* FAetherisAssets::LoadWavFile(const FString& Path)
{
	TArray<uint8> Raw;
	if (!FFileHelper::LoadFileToArray(Raw, *Path) || Raw.Num() < 44)
	{
		UE_LOG(LogAetheris, Warning, TEXT("Missing wav %s"), *Path);
		return nullptr;
	}
	FWaveModInfo Info;
	if (!Info.ReadWaveInfo(Raw.GetData(), Raw.Num()))
	{
		UE_LOG(LogAetheris, Warning, TEXT("Bad wav %s"), *Path);
		return nullptr;
	}
	USoundWave* Wave = NewObject<USoundWave>(GetTransientPackage(), NAME_None, RF_Transient);
	const int32 Channels = *Info.pChannels;
	const int32 SampleRate = *Info.pSamplesPerSec;
	Wave->SetSampleRate(SampleRate);
	Wave->NumChannels = Channels;
	Wave->RawPCMDataSize = Info.SampleDataSize;
	Wave->Duration = static_cast<float>(Info.SampleDataSize) / (SampleRate * Channels * (*Info.pBitsPerSample / 8));
	Wave->RawPCMData = static_cast<uint8*>(FMemory::Malloc(Info.SampleDataSize));
	FMemory::Memcpy(Wave->RawPCMData, Info.SampleDataStart, Info.SampleDataSize);
	Wave->bLooping = Path.Contains(TEXT("ambient"));
	Wave->AddToRoot();
	return Wave;
}

UMaterialInstanceDynamic* FAetherisAssets::MakeLit(UObject* Outer, const FLinearColor& Color, float Roughness, float Metallic, UTexture2D* Map) const
{
	UMaterial* Base = LoadObject<UMaterial>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (!Base) Base = UMaterial::GetDefaultMaterial(MD_Surface);
	UMaterialInstanceDynamic* Mid = UMaterialInstanceDynamic::Create(Base, Outer);
	if (!Mid) return nullptr;
	Mid->SetVectorParameterValue(TEXT("Color"), Color);
	Mid->SetScalarParameterValue(TEXT("Roughness"), Roughness);
	Mid->SetScalarParameterValue(TEXT("Metallic"), Metallic);
	if (Map)
	{
		Mid->SetTextureParameterValue(TEXT("Texture"), Map);
		Mid->SetTextureParameterValue(TEXT("BaseColor"), Map);
	}
	return Mid;
}
