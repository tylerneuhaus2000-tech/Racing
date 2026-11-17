using UnityEngine;

namespace Gridline.Native
{
    [DefaultExecutionOrder(-1000)]
    public sealed class GridlineBootstrap : MonoBehaviour
    {
        private const string RuntimeRootName = "__GridlineNativeRuntime";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Object.FindAnyObjectByType<GridlineBootstrap>() != null)
            {
                return;
            }

            GameObject runtimeRoot = new GameObject(RuntimeRootName);
            DontDestroyOnLoad(runtimeRoot);
            runtimeRoot.AddComponent<GridlineBootstrap>();
        }

        private void Awake()
        {
            // GLB loading and QA telemetry must continue when the macOS window
            // is behind the editor or terminal. This also keeps manual testing
            // deterministic when focus changes during a drive.
            Application.runInBackground = true;
            Application.targetFrameRate = ReadTargetFrameRate();
            QualitySettings.vSyncCount = 0;
            // Browser reference runs the car at 120 Hz while rendering can stay
            // at 60 Hz on the iPad target.
            Time.fixedDeltaTime = 1f / 120f;
            Time.maximumDeltaTime = 0.08f;

            if (GetComponent<GridlineInputRouter>() == null)
            {
                gameObject.AddComponent<GridlineInputRouter>();
            }
            if (GetComponent<GridlinePerformanceProbe>() == null)
            {
                gameObject.AddComponent<GridlinePerformanceProbe>();
            }
            GridlineRuntimeBuilder.BuildIfNeeded();
            GridlineGameState.ReturnToMenu();
        }

        private static int ReadTargetFrameRate()
        {
            string[] args = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length; i += 1)
            {
                string argument = args[i];
                string value = argument.StartsWith("-gridline-fps=", System.StringComparison.OrdinalIgnoreCase)
                    ? argument.Substring("-gridline-fps=".Length)
                    : argument.Equals("-gridline-fps", System.StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length
                        ? args[i + 1]
                        : string.Empty;
                if (int.TryParse(value, out int requested) && requested >= 15 && requested <= 240)
                {
                    return requested;
                }
            }

            return 60;
        }
    }
}
