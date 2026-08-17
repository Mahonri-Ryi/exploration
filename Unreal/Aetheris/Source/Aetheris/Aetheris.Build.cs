using UnrealBuildTool;

public class Aetheris : ModuleRules
{
	public Aetheris(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"ProceduralMeshComponent",
			"UMG",
			"Slate",
			"SlateCore",
			"ImageWrapper",
			"AudioMixer"
		});
	}
}
