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
#include "Sound/SoundWaveProcedural.h"

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
		if (USoundWave* S = LoadWavFile(Name, AudDir / FString::Printf(TEXT("%s.wav"), Name)))
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

void FAetherisAssets::Prime(FName Name)
{
	USoundWave* Wave = Sfx(Name);
	const TSharedRef<TArray<uint8>>* Buf = Pcm.Find(Name);
	USoundWaveProcedural* Proc = Cast<USoundWaveProcedural>(Wave);
	if (!Proc || !Buf || (*Buf)->Num() == 0) return;
	Proc->QueueAudio((*Buf)->GetData(), (*Buf)->Num());
}

USoundWave* FAetherisAssets::LoadWavFile(FName Name, const FString& Path)
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

	const int32 Channels = *Info.pChannels;
	const int32 SampleRate = *Info.pSamplesPerSec;
	const int32 Bits = FMath::Max(8, static_cast<int32>(*Info.pBitsPerSample));
	const float Duration = static_cast<float>(Info.SampleDataSize) / static_cast<float>(FMath::Max(1, SampleRate * Channels * (Bits / 8)));

	TSharedRef<TArray<uint8>> Samples = MakeShared<TArray<uint8>>();
	Samples->Append(Info.SampleDataStart, Info.SampleDataSize);
	Pcm.Add(Name, Samples);

	USoundWaveProcedural* Wave = NewObject<USoundWaveProcedural>(GetTransientPackage(), NAME_None, RF_Transient);
	Wave->SetSampleRate(SampleRate);
	Wave->NumChannels = Channels;
	Wave->Duration = Duration;
	Wave->bLooping = Path.Contains(TEXT("ambient"));
	Wave->SoundGroup = SOUNDGROUP_Default;
	Wave->bProcedural = true;
	Wave->QueueAudio(Samples->GetData(), Samples->Num());
	if (Wave->bLooping)
	{
		Wave->OnSoundWaveProceduralUnderflow.BindLambda([Samples](USoundWaveProcedural* Proc, int32)
		{
			if (Proc && Samples->Num() > 0)
			{
				Proc->QueueAudio(Samples->GetData(), Samples->Num());
			}
		});
	}
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
