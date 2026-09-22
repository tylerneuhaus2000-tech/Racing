using UnrealBuildTool;

public class GridlineRacingEditorTarget : TargetRules
{
    public GridlineRacingEditorTarget(TargetInfo target) : base(target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
        ExtraModuleNames.Add("GridlineRacing");
    }
}
