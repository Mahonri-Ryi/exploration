using UnrealBuildTool;

public class Aetheris : ModuleRules
{
	public Aetheris(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

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
