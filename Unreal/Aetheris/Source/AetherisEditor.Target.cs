using UnrealBuildTool;

public class AetherisEditorTarget : TargetRules
{
	public AetherisEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("Aetheris");
	}
}
