#pragma once

#include "CoreMinimal.h"

class UTexture2D;
class USoundWave;
class UMaterialInstanceDynamic;

class FAetherisAssets
{
public:
	static FAetherisAssets& Get();
	void Load();

	UTexture2D* Tex(FName Name) const;
	USoundWave* Sfx(FName Name) const;
	UMaterialInstanceDynamic* MakeLit(UObject* Outer, const FLinearColor& Color, float Roughness, float Metallic, UTexture2D* Map = nullptr) const;

	FString ContentRoot;

private:
	TMap<FName, TObjectPtr<UTexture2D>> Textures;
	TMap<FName, TObjectPtr<USoundWave>> Sounds;
	bool bLoaded = false;

	UTexture2D* LoadTextureFile(const FString& Path);
	USoundWave* LoadWavFile(const FString& Path);
};
