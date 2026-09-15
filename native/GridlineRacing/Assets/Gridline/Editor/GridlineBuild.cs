#if UNITY_EDITOR
using System.IO;
using UnityEditor;

namespace Gridline.Native.Editor
{
    public static class GridlineBuild
    {
        private static readonly string[] Scenes =
        {
            "Assets/Scenes/Bootstrap.unity"
        };

        [MenuItem("Gridline/Build/macOS App")]
        public static void BuildMac()
        {
            Directory.CreateDirectory("Builds/macOS");
            BuildPipeline.BuildPlayer(Scenes, "Builds/macOS/Gridline.app", BuildTarget.StandaloneOSX, BuildOptions.None);
        }

        [MenuItem("Gridline/Build/Windows 64-bit")]
        public static void BuildWindows()
        {
            Directory.CreateDirectory("Builds/Windows");
            BuildPipeline.BuildPlayer(Scenes, "Builds/Windows/Gridline.exe", BuildTarget.StandaloneWindows64, BuildOptions.None);
        }
    }
}
#endif
