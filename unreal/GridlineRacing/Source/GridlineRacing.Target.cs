using UnrealBuildTool;

public class GridlineRacingTarget : TargetRules
{
    public GridlineRacingTarget(TargetInfo target) : base(target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
        ExtraModuleNames.Add("GridlineRacing");
    }
}
